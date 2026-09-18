/**
 * LRU texture cache with pinning (RENDERING §6, HU-GAME-008 R5).
 * Generic over the image type so it has no Skia import and can be unit-tested in Node.
 * Memory is estimated as w × h × 4 bytes (RGBA). Pinned entries (active scene + globals) are never evicted.
 */
export interface TextureInfo {
  w: number;
  h: number;
}

interface Entry<T> {
  key: string;
  image: T;
  bytes: number;
  scope: string;
}

export const GLOBAL_SCOPE = 'global';

export function estimateBytes(info: TextureInfo): number {
  return info.w * info.h * 4;
}

export class TextureCache<T> {
  private entries = new Map<string, Entry<T>>(); // insertion order = LRU order (oldest first)
  private pinnedScopes = new Set<string>([GLOBAL_SCOPE]);
  private bytes = 0;

  constructor(
    private budgetBytes: number,
    private readonly onEvict?: (key: string, image: T) => void,
  ) {}

  get usedBytes(): number {
    return this.bytes;
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Touch: move to most-recent position.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.image;
  }

  /** Adds an image under a scope (a scene id, or GLOBAL_SCOPE for characters/clothes/UI). */
  set(key: string, image: T, info: TextureInfo, scope: string): void {
    const existing = this.entries.get(key);
    if (existing) {
      this.bytes -= existing.bytes;
      this.entries.delete(key);
    }
    const entry: Entry<T> = { key, image, bytes: estimateBytes(info), scope };
    this.entries.set(key, entry);
    this.bytes += entry.bytes;
    this.evictIfNeeded();
  }

  /** Marks the active scene: its textures and global ones become pinned; the previous scene's are released. */
  setActiveScene(sceneId: string): void {
    const previous = [...this.pinnedScopes].filter((s) => s !== GLOBAL_SCOPE);
    this.pinnedScopes = new Set([GLOBAL_SCOPE, sceneId]);
    for (const scope of previous) {
      if (scope !== sceneId) this.releaseScope(scope);
    }
  }

  releaseScope(scope: string): void {
    for (const entry of [...this.entries.values()]) {
      if (entry.scope === scope) this.evict(entry);
    }
  }

  private evictIfNeeded(): void {
    if (this.bytes <= this.budgetBytes) return;
    for (const entry of [...this.entries.values()]) {
      if (this.bytes <= this.budgetBytes) break;
      if (!this.pinnedScopes.has(entry.scope)) this.evict(entry);
    }
  }

  private evict(entry: Entry<T>): void {
    this.entries.delete(entry.key);
    this.bytes -= entry.bytes;
    this.onEvict?.(entry.key, entry.image);
  }
}

/** PERFORMANCE §2: texture cache target 150 MB. */
export const DEFAULT_TEXTURE_BUDGET_BYTES = 150 * 1024 * 1024;
