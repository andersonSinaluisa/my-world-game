import { Group, Image } from '@shopify/react-native-skia';
import { memo, useEffect } from 'react';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import type { Transform } from '../../components/base';
import type { EventBus } from '../../core/events';
import type { AssetKey, EntityId } from '../../core/types';
import type { TextureStore } from './texture-store';
import { runPreset, type TweenValues } from './tweens';
import { useTexture } from './use-texture';

export interface SpriteNodeProps {
  id: EntityId;
  asset: AssetKey;
  transform: Transform;
  pivot: { x: number; y: number };
  size?: { w: number; h: number };
  textures: TextureStore;
  events: EventBus;
}

/**
 * One entity sprite (RENDERING §3). Position/scale come from the logical transform; tween offsets
 * (HU-GAME-009) live in SharedValues and animate on the UI thread without React renders.
 */
export const SpriteNode = memo(function SpriteNode({ id, asset, transform, pivot, size, textures, events }: SpriteNodeProps) {
  const image = useTexture(textures, asset);
  const native = textures.registry.size(asset);
  const w = size?.w ?? native?.w ?? 0;
  const h = size?.h ?? native?.h ?? 0;

  const tween: TweenValues = {
    offsetX: useSharedValue(0),
    offsetY: useSharedValue(0),
    scaleX: useSharedValue(1),
    scaleY: useSharedValue(1),
    rotation: useSharedValue(0),
  };

  useEffect(
    () =>
      events.subscribe((batch) => {
        for (const event of batch) {
          if (event.type === 'visualEffect' && event.entityId === id) runPreset(event.preset, tween);
        }
      }),
    // SharedValue objects are stable for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, id],
  );

  const { x, y, scale = 1, flipX = false, rotation = 0 } = transform;
  const matrix = useDerivedValue(
    () => [
      { translateX: x + tween.offsetX.get() },
      { translateY: y + tween.offsetY.get() },
      { rotate: (rotation * Math.PI) / 180 + tween.rotation.get() },
      { scaleX: (flipX ? -1 : 1) * scale * tween.scaleX.get() },
      { scaleY: scale * tween.scaleY.get() },
    ],
    [x, y, scale, flipX, rotation],
  );

  if (!image || w === 0 || h === 0) return null;
  return (
    <Group transform={matrix}>
      <Image image={image} x={-pivot.x * w} y={-pivot.y * h} width={w} height={h} fit="fill" />
    </Group>
  );
});
