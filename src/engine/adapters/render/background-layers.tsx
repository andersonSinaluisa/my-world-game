import { Group, Image } from '@shopify/react-native-skia';
import { memo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { visibleChunks } from '../../scene/culling';
import { WORLD_HEIGHT, type BackgroundChunk, type BackgroundLayer } from '../../scene/scene-types';
import type { TextureStore } from './texture-store';
import { useTexture } from './use-texture';

const Chunk = memo(function Chunk({ chunk, y, textures }: { chunk: BackgroundChunk; y: number; textures: TextureStore }) {
  const image = useTexture(textures, chunk.asset);
  if (!image) return null;
  return <Image image={image} x={chunk.x} y={y} width={chunk.width} height={WORLD_HEIGHT} fit="fill" />;
});

const Layer = memo(function Layer({
  layer,
  cameraX,
  cullX,
  viewportW,
  textures,
}: {
  layer: BackgroundLayer;
  cameraX: SharedValue<number>;
  cullX: number;
  viewportW: number;
  textures: TextureStore;
}) {
  const parallax = layer.parallax ?? 1;
  // Inside the camera group everything already moves by −cameraX; parallax layers move back by cameraX·(1−p).
  const transform = useDerivedValue(() => [{ translateX: cameraX.get() * (1 - parallax) }], [parallax]);
  // Chunk culling (HU-GAME-008 R3) uses the thresholded camera position, never per frame.
  const chunks = visibleChunks(layer, cullX, viewportW);
  return (
    <Group transform={transform}>
      {chunks.map((chunk) => (
        <Chunk key={`${chunk.asset}@${chunk.x}`} chunk={chunk} y={layer.y ?? 0} textures={textures} />
      ))}
    </Group>
  );
});

export function BackgroundLayers(props: {
  layers: BackgroundLayer[];
  cameraX: SharedValue<number>;
  cullX: number;
  viewportW: number;
  textures: TextureStore;
}) {
  return (
    <>
      {props.layers.map((layer) => (
        <Layer key={layer.id} layer={layer} {...props} />
      ))}
    </>
  );
}
