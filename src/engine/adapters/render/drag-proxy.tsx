import { Group, Image } from '@shopify/react-native-skia';
import { useAnimatedReaction, useDerivedValue, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import type { Transform } from '../../components/base';
import type { CharacterLayerData } from '../../characters/layers';
import type { AssetKey } from '../../core/types';
import { CharacterSprite } from './character-sprite';
import type { TextureStore } from './texture-store';
import { useTexture } from './use-texture';

/** HU-GAME-027 R5: default lift and scale of the dragged item. */
export const DEFAULT_LIFT_OFFSET = 16;
export const DRAG_PROXY_SCALE = 1.05;

/** An item carried by the dragged furniture, relative to its pivot (HU-GAME-030 R4). */
export interface CarriedVisual {
  id: string;
  asset: AssetKey;
  x: number;
  y: number;
  pivot: { x: number; y: number };
  size?: { w: number; h: number };
}

function CarriedImage({ item, textures }: { item: CarriedVisual; textures: TextureStore }) {
  const image = useTexture(textures, item.asset);
  const native = textures.registry.size(item.asset);
  const w = item.size?.w ?? native?.w ?? 0;
  const h = item.size?.h ?? native?.h ?? 0;
  if (!image || !w || !h) return null;
  return <Image image={image} x={item.x - item.pivot.x * w} y={item.y - item.pivot.y * h} width={w} height={h} fit="fill" />;
}

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
  carried?: CarriedVisual[];
}

/**
 * The dragged item, drawn above everything and moved on the UI thread (INPUT_SYSTEM §3).
 * The World does not change until dragEnd; the original sprite is hidden meanwhile.
 */
export function DragProxy({ asset, transform, pivot, size, grabOffset, liftOffset, pointerX, pointerY, textures, carried }: DragProxyProps) {
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
      {carried?.map((c) => <CarriedImage key={c.id} item={c} textures={textures} />)}
    </Group>
  );
}

/** HU-GAME-014 R7: max swing of a dangling character, in radians, and how fast it follows the finger. */
export const MAX_SWING = 0.35;
const SWING_PER_UNIT = 0.012;

export interface CharacterDragProxyProps {
  id: string;
  layers: CharacterLayerData[];
  transform: Transform;
  grabOffset: { x: number; y: number };
  liftOffset?: number;
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  textures: TextureStore;
}

/**
 * Dragged character: the same layer stack, lifted, scaled 1.05 and swinging with the horizontal speed of
 * the finger. Everything runs on the UI thread (no JS per frame, INPUT_SYSTEM §3).
 */
export function CharacterDragProxy({ id, layers, transform, grabOffset, liftOffset, pointerX, pointerY, textures }: CharacterDragProxyProps) {
  const lift = liftOffset ?? DEFAULT_LIFT_OFFSET;
  const swing = useSharedValue(0);
  const lastX = useSharedValue<number | null>(null);
  useAnimatedReaction(
    () => pointerX.get(),
    (x) => {
      const prev = lastX.get();
      lastX.set(x);
      if (prev === null) return;
      const target = Math.max(-MAX_SWING, Math.min(MAX_SWING, -(x - prev) * SWING_PER_UNIT));
      swing.set(withSpring(target, { damping: 8, stiffness: 120 }, () => {
        swing.set(withSpring(0, { damping: 6, stiffness: 80 }));
      }));
    },
  );
  const motion = useDerivedValue(() => ({
    dx: pointerX.get() - grabOffset.x - transform.x,
    dy: pointerY.get() - grabOffset.y - lift - transform.y,
    rotate: swing.get(),
    scale: DRAG_PROXY_SCALE,
  }));
  return <CharacterSprite id={id} layers={layers} transform={transform} textures={textures} motion={motion} />;
}
