import { loadData, Skia, type SkImage } from '@shopify/react-native-skia';

import type { AssetKey } from '../../core/types';
import type { AssetRegistry } from './asset-registry';
import { DEFAULT_TEXTURE_BUDGET_BYTES, GLOBAL_SCOPE, TextureCache } from './texture-cache';

type Listener = (image: SkImage | null) => void;

/**
 * Loads Skia images by AssetKey through the LRU TextureCache (RENDERING §6).
 * De-duplicates in-flight loads so N sprites sharing an asset trigger a single decode.
 */
export class TextureStore {
  private readonly cache: TextureCache<SkImage>;
  private readonly inflight = new Map<string, Promise<SkImage | null>>();
  private activeScene = GLOBAL_SCOPE;

  constructor(
    readonly registry: AssetRegistry,
    budgetBytes = DEFAULT_TEXTURE_BUDGET_BYTES,
  ) {
    this.cache = new TextureCache<SkImage>(budgetBytes, (_key, image) => image.dispose?.());
  }

  get usedBytes(): number {
    return this.cache.usedBytes;
  }

  setActiveScene(sceneId: string): void {
    this.activeScene = sceneId;
    this.cache.setActiveScene(sceneId);
  }

  peek(key: AssetKey): SkImage | undefined {
    return this.cache.get(key);
  }

  load(key: AssetKey, scope = this.activeScene): Promise<SkImage | null> {
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const entry = this.registry.resolve(key);
    if (!entry) return Promise.resolve(null);
    const promise = loadData(entry.source, (data) => Skia.Image.MakeImageFromEncoded(data)).then((image) => {
      this.inflight.delete(key);
      if (image) this.cache.set(key, image, { w: entry.w, h: entry.h }, scope);
      return image;
    });
    this.inflight.set(key, promise);
    return promise;
  }

  subscribeLoad(key: AssetKey, listener: Listener): () => void {
    let active = true;
    this.load(key).then((image) => {
      if (active) listener(image);
    });
    return () => {
      active = false;
    };
  }
}
