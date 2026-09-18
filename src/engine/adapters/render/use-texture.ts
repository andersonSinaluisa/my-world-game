import type { SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

import type { AssetKey } from '../../core/types';
import type { TextureStore } from './texture-store';

/** Image for an AssetKey, loaded once through the shared TextureStore. Null while loading or missing. */
export function useTexture(store: TextureStore, key: AssetKey): SkImage | null {
  const [loaded, setLoaded] = useState<{ key: AssetKey; image: SkImage | null } | null>(null);
  useEffect(() => {
    if (store.peek(key)) return;
    return store.subscribeLoad(key, (image) => setLoaded({ key, image }));
  }, [store, key]);
  return store.peek(key) ?? (loaded?.key === key ? loaded.image : null);
}
