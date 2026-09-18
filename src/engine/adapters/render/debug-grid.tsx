import { Group, Line, Rect, vec } from '@shopify/react-native-skia';

import { WORLD_HEIGHT } from '../../scene/scene-types';

const STEP = 120;

/** Dev-only grid (HU-GAME-005 R8): lines every 120 units and a frame for 0..1080 to check the scale. */
export function DebugGrid({ width }: { width: number }) {
  const verticals: number[] = [];
  for (let x = 0; x <= width; x += STEP) verticals.push(x);
  const horizontals: number[] = [];
  for (let y = 0; y <= WORLD_HEIGHT; y += STEP) horizontals.push(y);
  return (
    <Group opacity={0.35}>
      {verticals.map((x) => (
        <Line key={`v${x}`} p1={vec(x, 0)} p2={vec(x, WORLD_HEIGHT)} color={x % 1920 === 0 ? '#E8467C' : '#3E2C4A'} strokeWidth={x % 1920 === 0 ? 6 : 2} />
      ))}
      {horizontals.map((y) => (
        <Line key={`h${y}`} p1={vec(0, y)} p2={vec(width, y)} color="#3E2C4A" strokeWidth={2} />
      ))}
      <Rect x={0} y={0} width={width} height={WORLD_HEIGHT} color="#FF6F61" style="stroke" strokeWidth={8} />
    </Group>
  );
}
