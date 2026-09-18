import { ColorMatrix, Group, Image, Oval } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { Transform } from '../../components/base';
import type { CharacterLayerData } from '../../characters/layers';
import type { TextureStore } from './texture-store';
import { breathPhase, tintMatrix } from './tint';
import { useTexture } from './use-texture';

/** RENDERING §9: idle breathing, ±1.5 % on the Y scale. */
export const BREATH_AMPLITUDE = 0.015;

function LayerImage({ layer, textures }: { layer: CharacterLayerData; textures: TextureStore }) {
  const image = useTexture(textures, layer.asset!);
  const native = textures.registry.size(layer.asset!);
  const matrix = useMemo(() => (layer.tint ? tintMatrix(layer.tint) : undefined), [layer.tint]);
  if (!image || !native) return null;
  if (layer.held) {
    const { anchor, scale, pivot, size } = layer.held;
    const w = size?.w ?? native.w;
    const h = size?.h ?? native.h;
    return (
      <Group transform={[{ translateX: anchor.x }, { translateY: anchor.y }, { scale }]}>
        <Image image={image} x={-pivot.x * w} y={-pivot.y * h} width={w} height={h} fit="fill" />
      </Group>
    );
  }
  // Character layers share one canvas whose pivot is the bottom center (CHARACTER_SCHEMA §3).
  const dx = layer.offset?.x ?? 0;
  const dy = layer.offset?.y ?? 0;
  return (
    <Image image={image} x={-native.w / 2 + dx} y={-native.h + dy} width={native.w} height={native.h} fit="fill">
      {matrix && <ColorMatrix matrix={matrix} />}
    </Image>
  );
}

export interface CharacterSpriteProps {
  id: string;
  layers: CharacterLayerData[];
  transform: Transform;
  textures: TextureStore;
  /** Shared breathing clock in radians (RENDERING §9). Absent = no breathing (dangle, proxies). */
  breath?: SharedValue<number>;
  /** Drag proxy only: offset from transform (finger − grab point, lift) and swing rotation in radians. */
  motion?: SharedValue<{ dx: number; dy: number; rotate: number; scale: number }>;
}

/**
 * A character drawn as one Skia Group of its layers (CHARACTER_SYSTEM §2). Layers come from the memoized
 * engine selector, so this re-renders only when the look changes; breathing runs on the UI thread.
 */
export const CharacterSprite = memo(function CharacterSprite({ id, layers, transform, textures, breath, motion }: CharacterSpriteProps) {
  const { x, y, scale = 1, flipX = false } = transform;
  const phase = useMemo(() => breathPhase(id), [id]);
  const matrix = useDerivedValue(() => {
    const b = breath ? 1 + BREATH_AMPLITUDE * Math.sin(breath.get() + phase) : 1;
    const m = motion ? motion.get() : { dx: 0, dy: 0, rotate: 0, scale: 1 };
    return [
      { translateX: x + m.dx },
      { translateY: y + m.dy },
      { rotate: m.rotate },
      { scaleX: (flipX ? -1 : 1) * scale * m.scale },
      { scaleY: scale * b * m.scale },
    ];
  }, [x, y, scale, flipX, phase]);
  return (
    <Group transform={matrix}>
      {layers.map((l) =>
        l.shadow ? (
          <Oval key={l.layer} x={-l.shadow.rx} y={-l.shadow.ry} width={l.shadow.rx * 2} height={l.shadow.ry * 2} color="rgba(62,44,74,0.18)" />
        ) : (
          <LayerImage key={l.layer} layer={l} textures={textures} />
        ),
      )}
    </Group>
  );
});
