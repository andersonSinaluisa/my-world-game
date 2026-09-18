import { AssetRegistry, type AssetEntry } from '@/engine/adapters/render/asset-registry';
import { TextureStore } from '@/engine/adapters/render/texture-store';
import { silentLogger, type Logger } from '@/engine/core/runtime';

export type { AssetEntry };
export type { TextureStore };

/**
 * Builds the texture store for a set of bundled assets. Lives in src/game so screens never import
 * engine adapters directly (ARCHITECTURE §2). HU-GAME-068 will feed it the generated asset map.
 */
export function createTextureStore(
  entries: Record<string, AssetEntry>,
  options: { logger?: Logger; dev?: boolean; budgetBytes?: number } = {},
): TextureStore {
  const dev = options.dev ?? (typeof __DEV__ !== 'undefined' ? __DEV__ : true);
  return new TextureStore(new AssetRegistry(entries, options.logger ?? silentLogger, dev), options.budgetBytes);
}
