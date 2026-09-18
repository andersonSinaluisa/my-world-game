import { Group, Image } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { Transform } from '../../components/base';
import type { AssetKey } from '../../core/types';
import type { TextureStore } from './texture-store';
import { useTexture } from './use-texture';

/** HU-GAME-027 R5: default lift and scale of the dragged item. */
export const DEFAULT_LIFT_OFFSET = 16;
export const DRAG_PROXY_SCALE = 1.05;

export interface DragProxyProps {
  asset: AssetKey;
  transform: Transform;
  pivot: { x: number; y: number };
  size?: { w: number; h: number };
  /** Finger position minus the entity pivot at drag start: no visible jump (R5). */
  grabOffset: { x: number; y: number };
  liftOffset?: number;
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  textures: TextureStore;
}

/**
 * The dragged item, drawn above everything and moved on the UI thread (INPUT_SYSTEM §3).
 * The World does not change until dragEnd; the original sprite is hidden meanwhile.
 */
export function DragProxy({ asset, transform, pivot, size, grabOffset, liftOffset, pointerX, pointerY, textures }: DragProxyProps) {
  const image = useTexture(textures, asset);
  const native = textures.registry.size(asset);
  const w = size?.w ?? native?.w ?? 0;
  const h = size?.h ?? native?.h ?? 0;
  const lift = liftOffset ?? DEFAULT_LIFT_OFFSET;
  const scale = (transform.scale ?? 1) * DRAG_PROXY_SCALE;
  const flip = transform.flipX ? -1 : 1;

  const matrix = useDerivedValue(
    () => [
      { translateX: pointerX.get() - grabOffset.x },
      { translateY: pointerY.get() - grabOffset.y - lift },
      { scaleX: flip * scale },
      { scaleY: scale },
    ],
    [grabOffset.x, grabOffset.y, lift, flip, scale],
  );

  if (!image || w === 0 || h === 0) return null;
  return (
    <Group transform={matrix}>
      <Image image={image} x={-pivot.x * w} y={-pivot.y * h} width={w} height={h} fit="fill" />
    </Group>
  );
}
