import { Circle, Group, matchFont, RoundedRect, Text } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { Platform } from 'react-native';

const H = 56;
const COIN_R = 18;

/**
 * Price label over an unpaid product (HU-GAME-064 RN-8): a coin and the number, drawn the same way for
 * every entity with purchasable.purchased = false. Numbers are the only "text" a child needs here.
 */
export const PriceTag = memo(function PriceTag({ x, y, price }: { x: number; y: number; price: number }) {
  const font = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }), fontSize: 38, fontWeight: 'bold' }), []);
  const label = String(price);
  const textW = font.measureText(label).width;
  const w = COIN_R * 2 + textW + 32;
  return (
    <Group transform={[{ translateX: x - w / 2 }, { translateY: y - H }]}>
      <RoundedRect x={0} y={0} width={w} height={H} r={H / 2} color="#FFFFFF" />
      <RoundedRect x={0} y={0} width={w} height={H} r={H / 2} color="#3E2C4A" style="stroke" strokeWidth={4} />
      <Circle cx={12 + COIN_R} cy={H / 2} r={COIN_R} color="#FFD23F" />
      <Circle cx={12 + COIN_R} cy={H / 2} r={COIN_R} color="#C9971C" style="stroke" strokeWidth={4} />
      <Text x={12 + COIN_R * 2 + 8} y={H / 2 + 13} text={label} font={font} color="#3E2C4A" />
    </Group>
  );
});
