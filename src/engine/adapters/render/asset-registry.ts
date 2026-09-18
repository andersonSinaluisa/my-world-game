import type { AssetKey } from '../../core/types';
import type { Logger } from '../../core/runtime';

/**
 * AssetKey → bundled module resolution (RENDERING §6, HU-GAME-006 R6).
 * Content refers to assets by key only; this registry is the single place that knows files.
 * The real map is generated from `assets.json` by HU-GAME-068; tests and the sandbox pass their own.
 */
export interface AssetEntry {
  /** Metro module id returned by `require()`. */
  source: number;
  w: number;
  h: number;
}

export class MissingAssetError extends Error {
  constructor(readonly key: AssetKey) {
    super(`Missing asset "${key}" (not in the asset manifest)`);
    this.name = 'MissingAssetError';
  }
}

export class AssetRegistry {
  private warned = new Set<string>();

  constructor(
    private readonly entries: Record<string, AssetEntry>,
    private readonly logger: Logger,
    private readonly dev: boolean,
  ) {}

  has(key: AssetKey): boolean {
    return Object.prototype.hasOwnProperty.call(this.entries, key);
  }

  size(key: AssetKey): { w: number; h: number } | undefined {
    const entry = this.entries[key];
    return entry ? { w: entry.w, h: entry.h } : undefined;
  }

  /**
   * Dev: throws a clear error naming the key. Prod: returns undefined and warns once;
   * the entity is simply not drawn and the game keeps running (HU-GAME-006 R7).
   */
  resolve(key: AssetKey): AssetEntry | undefined {
    const entry = this.entries[key];
    if (entry) return entry;
    if (this.dev) throw new MissingAssetError(key);
    if (!this.warned.has(key)) {
      this.warned.add(key);
      this.logger.warn(`Missing asset "${key}"`);
    }
    return undefined;
  }
}
