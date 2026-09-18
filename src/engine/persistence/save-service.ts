import type { GameEngine } from '../core/engine';
import type { GameEvent } from '../core/events';
import { systemScheduler, type Scheduler } from '../core/runtime';
import type { EntityId, SceneId } from '../core/types';
import { parseVersion } from '../content/semver';
import { mergeComponents } from '../content/validate-pack';
import { CURRENT_SAVE_VERSION, MIGRATIONS, migrateSave, type GameSave, type Migration } from './migrations';
import type { PlayerState, SaveSlotData, SaveStore, SavedEntity } from './save-store';
import { isCharacterRow, isRuntimeId, NON_PERSISTED_COMPONENTS, toSavedEntity } from './serializer';
import { isTemporaryPose } from '../characters/character-system';

/** HU-GAME-052 RN-2: debounce of 1000 ms, flushed at most 5 s after the first pending change. */
export const SAVE_DEBOUNCE_MS = 1000;
export const SAVE_MAX_WAIT_MS = 5000;

export type LoadStatus = 'new' | 'loaded' | 'incompatible' | 'failed';

export interface LoadResult {
  status: LoadStatus;
  /** Human-free reason for the log (never shown to the child). */
  detail?: string;
}

export interface SaveServiceOptions {
  slotId?: string;
  scheduler?: Scheduler;
  migrations?: Migration[];
  saveVersion?: number;
}

interface PendingWrite {
  upserts: Map<EntityId, SavedEntity>;
  removals: Set<EntityId>;
  deletes: Set<EntityId>;
  player: boolean;
}

const emptyPending = (): PendingWrite => ({ upserts: new Map(), removals: new Set(), deletes: new Set(), player: false });

/**
 * Autosave + load (SAVE_SYSTEM §2-§5). Pure TS: the store is a port (SQLite adapter or in-memory).
 * - Tracks dirty entities from events; scene loads/unloads are not changes.
 * - Snapshots synchronously (so a scene can unload right after) and writes asynchronously.
 * - Keeps an in-memory copy of the save so re-entering a scene uses the latest diff.
 */
export class SaveService {
  readonly slotId: string;
  private scheduler: Scheduler;
  private migrations: Migration[];
  private saveVersion: number;
  private dirty = new Set<EntityId>();
  private removedNow = new Set<EntityId>();
  private playerDirty = false;
  private debounce: unknown;
  private firstPendingAt: number | undefined;
  private maxWait: unknown;
  private retry: PendingWrite = emptyPending();
  private writing: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void) | undefined;
  /** Latest known persisted state (cache of the store). */
  private rows = new Map<EntityId, SavedEntity>();
  private removed = new Set<EntityId>();
  private slot: SaveSlotData | undefined;

  constructor(
    private readonly engine: GameEngine,
    private readonly store: SaveStore,
    options: SaveServiceOptions = {},
  ) {
    this.slotId = options.slotId ?? 'main';
    this.scheduler = options.scheduler ?? systemScheduler;
    this.migrations = options.migrations ?? MIGRATIONS;
    this.saveVersion = options.saveVersion ?? CURRENT_SAVE_VERSION;
  }

  /** Connects to the engine: event tracking, scene diff provider, snapshot before unload. */
  attach(): this {
    this.unsubscribe = this.engine.events.subscribe((batch) => this.track(batch));
    this.engine.savedSceneProvider = (sceneId) => this.sceneState(sceneId);
    this.engine.beforeSceneUnload = () => this.snapshot();
    return this;
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.cancelTimers();
    this.engine.savedSceneProvider = undefined;
    this.engine.beforeSceneUnload = undefined;
  }

  get hasSave(): boolean {
    return this.slot !== undefined;
  }

  // ---------- tracking (HU-GAME-052) ----------

  private track(batch: readonly GameEvent[]): void {
    const sceneLoad = batch.some((e) => e.type === 'sceneLoaded');
    let changed = false;
    for (const e of batch) {
      switch (e.type) {
        case 'entityCreated':
          if (sceneLoad) continue; // entities instantiated from content/save are not changes
          this.dirty.add(e.id);
          changed = true;
          break;
        case 'entityChanged':
          if (!this.persistentChange(e.id, e.components)) continue;
          this.dirty.add(e.id);
          changed = true;
          break;
        case 'entityMoved':
          this.dirty.add(e.id);
          changed = true;
          break;
        case 'entityRemoved':
          if (e.unload) continue; // left memory with its scene; the save keeps it
          this.dirty.delete(e.id);
          this.removedNow.add(e.id);
          changed = true;
          break;
        case 'playerChanged':
        case 'sceneLoaded':
          this.playerDirty = true;
          changed = true;
          break;
        default:
          break;
      }
    }
    if (changed) this.schedule();
  }

  /** Expression changes and temporary poses are never saved (HU-GAME-014 R9, HU-GAME-015 R6). */
  private persistentChange(id: EntityId, components: readonly string[]): boolean {
    const relevant = components.filter((c) => !NON_PERSISTED_COMPONENTS.has(c));
    if (!relevant.length) return false;
    if (relevant.length === 1 && relevant[0] === 'pose') {
      const pose = this.engine.world.get(id)?.components.pose;
      if (pose && isTemporaryPose(pose.current)) return false;
    }
    return true;
  }

  private schedule(): void {
    const now = this.engine.clock.now();
    this.firstPendingAt ??= now;
    if (this.debounce !== undefined) this.scheduler.clearTimeout(this.debounce);
    this.debounce = this.scheduler.setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
    if (this.maxWait === undefined) {
      this.maxWait = this.scheduler.setTimeout(() => void this.flush(), SAVE_MAX_WAIT_MS);
    }
  }

  private cancelTimers(): void {
    if (this.debounce !== undefined) this.scheduler.clearTimeout(this.debounce);
    if (this.maxWait !== undefined) this.scheduler.clearTimeout(this.maxWait);
    this.debounce = this.maxWait = this.firstPendingAt = undefined;
  }

  /** Synchronous snapshot of pending changes into the retry buffer and the in-memory cache. */
  private snapshot(): void {
    // RN-4: nothing is written while an entity is dragged; it stays dirty until the drop.
    const dragging = this.engine.draggingId;
    for (const id of [...this.dirty]) {
      if (id === dragging) continue;
      this.dirty.delete(id);
      const e = this.engine.world.get(id);
      if (!e || e.location.kind === 'limbo') continue;
      const row = toSavedEntity(e);
      this.retry.upserts.set(id, row);
      this.retry.removals.delete(id);
      this.retry.deletes.delete(id);
      this.rows.set(id, row);
    }
    for (const id of this.removedNow) {
      this.retry.upserts.delete(id);
      this.rows.delete(id);
      if (isRuntimeId(id)) this.retry.deletes.add(id);
      else {
        this.retry.removals.add(id);
        this.removed.add(id);
      }
    }
    this.removedNow.clear();
    if (this.playerDirty) {
      this.retry.player = true;
      this.playerDirty = false;
    }
  }

  /** Writes pending changes in one transaction. Failures keep them pending and never reach the UI (RN-9). */
  flush(): Promise<void> {
    this.cancelTimers();
    this.snapshot();
    const batch = this.retry;
    if (!batch.upserts.size && !batch.removals.size && !batch.deletes.size && !batch.player) return this.writing;
    this.retry = emptyPending();
    const now = new Date(this.engine.clock.now()).toISOString();
    const slot: SaveSlotData | undefined = batch.player || !this.slot ? this.slotRow(now) : undefined;
    if (slot) this.slot = slot;
    this.writing = this.writing
      .then(() =>
        this.store.writeBatch({
          slotId: this.slotId,
          upserts: [...batch.upserts.values()],
          removals: [...batch.removals],
          deletes: [...batch.deletes],
          slot,
        }),
      )
      .catch((error) => {
        this.engine.logger.error('Autosave failed; will retry', { error: String(error) });
        // Merge back so the next trigger retries (newer snapshots win).
        for (const [id, row] of batch.upserts) if (!this.retry.upserts.has(id)) this.retry.upserts.set(id, row);
        batch.removals.forEach((id) => this.retry.removals.add(id));
        batch.deletes.forEach((id) => this.retry.deletes.add(id));
        this.retry.player ||= batch.player || !!slot;
      });
    return this.writing;
  }

  private slotRow(now: string): SaveSlotData {
    const content = this.engine.content;
    return {
      slotId: this.slotId,
      saveVersion: this.saveVersion,
      createdAt: this.slot?.createdAt ?? now,
      updatedAt: now,
      contentVersions: Object.fromEntries((content?.packs() ?? []).map((m) => [m.id, m.version])),
      player: this.engine.playerState as PlayerState,
    };
  }

  // ---------- scene diff (SAVE_SCHEMA §4) ----------

  private sceneState(sceneId: SceneId) {
    const entities = [...this.rows.values()].filter(
      (r) => (r.location.kind === 'scene' && r.location.sceneId === sceneId) || r.location.kind === 'container',
    );
    return { entities, removed: this.removed };
  }

  // ---------- new game / load (HU-GAME-053/054) ----------

  /** New game from the core manifest's `newGame` (CONTENT_PACK_SCHEMA §2). */
  startNewGame(): void {
    const ng = this.engine.content?.newGame();
    if (!ng) throw new Error('No newGame configuration in the content packs');
    const settings = this.engine.playerState.settings;
    this.engine.setPlayerState({
      ...(settings ? { settings } : {}),
      currentSceneId: ng.sceneId,
      wallet: { coins: ng.coins },
      unlocks: [...ng.unlocks],
      inventory: { capacity: ng.inventoryCapacity },
      flags: {},
    });
    this.engine.dispatch({ type: 'enterScene', sceneId: ng.sceneId, spawnId: ng.spawnId });
  }

  async load(): Promise<LoadResult> {
    const slot = await this.store.loadSlot(this.slotId);
    if (!slot) return { status: 'new' };
    // Never open or modify a save written by a newer app (SAVE_SCHEMA §5 rules 4-5).
    if (slot.saveVersion > this.saveVersion) return { status: 'incompatible', detail: `saveVersion ${slot.saveVersion}` };
    const content = this.engine.content;
    for (const [pack, version] of Object.entries(slot.contentVersions)) {
      const installed = content?.manifest(pack)?.version;
      const a = parseVersion(version);
      const b = installed ? parseVersion(installed) : undefined;
      if (a && b && a[0] > b[0]) return { status: 'incompatible', detail: `pack ${pack} ${version} > ${installed}` };
    }
    let save: GameSave = {
      slot,
      entities: await this.store.loadEntities(this.slotId),
      removed: await this.store.loadRemoved(this.slotId),
    };
    if (slot.saveVersion < this.saveVersion) {
      try {
        await this.store.backup(); // before any migration (SAVE_SCHEMA §5 rule 2)
        save = migrateSave(save, this.saveVersion, this.migrations);
        await this.store.replaceAll(save);
      } catch (error) {
        this.engine.logger.error('Save migration failed; restoring backup', { error: String(error) });
        try {
          await this.store.restoreBackup();
        } catch (restoreError) {
          this.engine.logger.error('Backup restore failed', { error: String(restoreError) });
        }
        return { status: 'failed', detail: String(error) };
      }
    }
    this.applyContentDrift(save);
    this.slot = save.slot;
    this.rows = new Map(save.entities.map((e) => [e.id, e]));
    this.removed = new Set(save.removed);
    this.engine.setPlayerState(save.slot.player);
    this.loadGlobals();
    const sceneId = save.slot.player.currentSceneId;
    const ng = content?.newGame();
    let result = sceneId ? this.engine.enterScene(sceneId, 'default') : { ok: false as const, reason: 'unknownScene' as const };
    if (!result.ok && ng) {
      this.engine.logger.warn(`Saved scene "${sceneId}" is unavailable; starting at ${ng.sceneId}`);
      result = this.engine.enterScene(ng.sceneId, ng.spawnId);
    }
    // Loading is not a change: nothing needs writing back.
    this.dirty.clear();
    this.removedNow.clear();
    this.playerDirty = false;
    this.cancelTimers();
    return result.ok ? { status: 'loaded' } : { status: 'failed', detail: result.reason };
  }

  /**
   * Resets the world (SAVE_SYSTEM §6, HU-GAME-055): backup first (no backup → nothing changes), then a new
   * slot from newGame keeping the settings. With keepCharacters, characters and their worn clothes stay and
   * appear at the new-game spawn 120 units apart, standing. Without it the slot is deleted: new game.
   */
  async resetWorld(keepCharacters: boolean): Promise<{ ok: true; status: 'new' | 'loaded' } | { ok: false; reason: 'backupFailed' | 'noContent' }> {
    const ng = this.engine.content?.newGame();
    if (!ng) return { ok: false, reason: 'noContent' };
    await this.flush();
    try {
      await this.store.backup();
    } catch (error) {
      this.engine.logger.error('Backup before reset failed; nothing changed', { error: String(error) });
      return { ok: false, reason: 'backupFailed' };
    }
    const settings = this.engine.playerState.settings;
    const now = new Date(this.engine.clock.now()).toISOString();
    const spawn = this.engine.content?.scene(ng.sceneId)?.spawnPoints.find((s) => s.id === ng.spawnId) ?? { x: 0, y: 960 };
    const kept: SavedEntity[] = [];
    if (keepCharacters) {
      const characters = this.engine.world.all().filter((e) => e.components.character && !e.components.character.isNpc);
      const all = [...new Map([...this.rows.values(), ...characters.map(toSavedEntity)].map((r) => [r.id, r])).values()];
      const chars = all.filter(isCharacterRow).sort((a, b) => a.id.localeCompare(b.id));
      chars.forEach((c, i) => {
        kept.push({
          ...c,
          location: { kind: 'scene', sceneId: ng.sceneId },
          components: { ...c.components, transform: { x: spawn.x + i * 120, y: spawn.y }, pose: { current: 'idle' } },
        });
      });
      const ids = new Set(chars.map((c) => c.id));
      for (const r of all) if (r.location.kind === 'worn' && ids.has(r.location.characterId)) kept.push(r);
    }
    this.cancelTimers();
    this.dirty.clear();
    this.removedNow.clear();
    this.retry = emptyPending();
    this.engine.unloadAll();
    this.dirty.clear();
    this.removedNow.clear();
    this.cancelTimers();
    if (!keepCharacters) {
      await this.store.deleteSlot(this.slotId);
      this.slot = undefined;
      this.rows = new Map();
      this.removed = new Set();
      this.engine.setPlayerState({ settings });
      return { ok: true, status: 'new' };
    }
    const slot: SaveSlotData = {
      slotId: this.slotId,
      saveVersion: this.saveVersion,
      createdAt: now,
      updatedAt: now,
      contentVersions: Object.fromEntries((this.engine.content?.packs() ?? []).map((m) => [m.id, m.version])),
      player: {
        currentSceneId: ng.sceneId,
        wallet: { coins: ng.coins },
        unlocks: [...ng.unlocks],
        inventory: { capacity: ng.inventoryCapacity },
        flags: {},
        ...(settings ? { settings } : {}),
      },
    };
    await this.store.replaceAll({ slot, entities: kept, removed: [] });
    const r = await this.load();
    return r.status === 'loaded' ? { ok: true, status: 'loaded' } : { ok: false, reason: 'backupFailed' };
  }

  /** idAliases / removedIds of the installed packs (SAVE_SCHEMA §5, CONTENT_PACK_SCHEMA §2). */
  private applyContentDrift(save: GameSave): void {
    const content = this.engine.content;
    if (!content) return;
    const kept: SavedEntity[] = [];
    for (const row of save.entities) {
      const id = content.resolveAlias(row.id);
      const prefabId = row.prefabId ? content.resolveAlias(row.prefabId) : undefined;
      if (content.isRemoved(id) || (prefabId && content.isRemoved(prefabId))) continue;
      kept.push({ ...row, id, prefabId });
    }
    save.entities = kept;
    save.removed = save.removed.map((id) => content.resolveAlias(id));
    save.slot = {
      ...save.slot,
      contentVersions: Object.fromEntries(content.packs().map((m) => [m.id, m.version])),
    };
  }

  /**
   * Global entities are loaded for every scene (SAVE_SYSTEM §4 step 5, GAME_ENGINE §3): all characters
   * (whatever scene they are in), then what they hold and wear, and the backpack. Invariants are repaired in prod.
   */
  private loadGlobals(): void {
    const content = this.engine.content;
    for (const row of [...this.rows.values()].filter(isCharacterRow)) {
      if (this.engine.world.has(row.id)) continue;
      this.engine.world.create(this.engine.characters.hydrate({ id: row.id, tags: row.tags ?? ['character'], location: row.location, components: { ...row.components } }));
    }
    const globals = [...this.rows.values()].filter((r) => !isCharacterRow(r) && ['inventory', 'held', 'worn'].includes(r.location.kind));
    for (const row of globals) {
      const prefab = row.prefabId && content?.hasPrefab(row.prefabId) ? content.prefab(row.prefabId) : undefined;
      if (row.prefabId && !prefab) {
        this.engine.logger.warn(`Discarding saved ${row.id}: prefab "${row.prefabId}" no longer exists`);
        this.rows.delete(row.id);
        continue;
      }
      const occupant = this.engine.world.index.occupantOf(row.location);
      const location = occupant ? undefined : row.location;
      if (!location) {
        this.engine.logger.warn(`Invariant repaired: ${row.id} shared a slot; moved to the current scene`);
        // It will be placed in the scene when that scene loads (row relocated to the saved scene).
        const sceneId = this.engine.playerState.currentSceneId;
        const spawn = sceneId ? content?.scene(sceneId)?.spawnPoints.find((s) => s.id === 'default') : undefined;
        if (sceneId && spawn) {
          const components = { ...row.components, transform: { ...(row.components.transform ?? {}), x: spawn.x, y: spawn.y } };
          this.rows.set(row.id, { ...row, location: { kind: 'scene', sceneId }, components });
        }
        continue;
      }
      if (this.engine.world.has(row.id)) continue;
      this.engine.world.create({
        id: row.id,
        prefabId: prefab?.qualifiedId,
        tags: row.tags ?? prefab?.tags ?? [],
        location,
        components: mergeComponents(prefab?.components ?? {}, row.components as Record<string, unknown>),
      });
    }
  }
}
