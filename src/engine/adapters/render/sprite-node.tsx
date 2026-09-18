import { ColorMatrix, Group, Image } from '@shopify/react-native-skia';
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
  /** Valid drop target under the finger (HU-GAME-033): soft outline + slight scale. */
  highlight?: boolean;
}

/** HU-GAME-033 R3: highlighted target. */
const HIGHLIGHT_SCALE = 1.04;
const OUTLINE_SCALE = 1.07;
const WHITE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];

/**
 * One entity sprite (RENDERING §3). Position/scale come from the logical transform; tween offsets
 * (HU-GAME-009) live in SharedValues and animate on the UI thread without React renders.
 */
export const SpriteNode = memo(function SpriteNode({ id, asset, transform, pivot, size, textures, events, highlight }: SpriteNodeProps) {
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

  const { x, y, scale: baseScale = 1, flipX = false, rotation = 0 } = transform;
  const scale = baseScale * (highlight ? HIGHLIGHT_SCALE : 1);
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
      {highlight && (
        // Outline: the same silhouette in white, slightly bigger, behind the sprite (RENDERING §8).
        <Group transform={[{ scale: OUTLINE_SCALE }]} opacity={0.85}>
          <Image image={image} x={-pivot.x * w} y={-pivot.y * h} width={w} height={h} fit="fill">
            <ColorMatrix matrix={WHITE} />
          </Image>
        </Group>
      )}
      <Image image={image} x={-pivot.x * w} y={-pivot.y * h} width={w} height={h} fit="fill" />
    </Group>
  );
});
