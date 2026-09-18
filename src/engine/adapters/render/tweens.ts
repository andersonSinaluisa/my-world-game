import {
  cancelAnimation,
  Easing,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { TweenPresetId } from '../../components/base';

/**
 * Presentation tweens (ANIMATION_GUIDELINES §2, HU-GAME-009). Offsets are applied on top of the
 * logical transform; they never touch the World. Every preset lasts ≤ 400 ms and returns to rest.
 */
export interface TweenValues {
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  scaleX: SharedValue<number>;
  scaleY: SharedValue<number>;
  rotation: SharedValue<number>; // radians
}

const ease = Easing.inOut(Easing.quad);
const deg = (d: number) => (d * Math.PI) / 180;

export const PRESET_DURATION_MS: Record<TweenPresetId, number> = {
  bounce: 280,
  squash: 180,
  wiggle: 360,
  pulse: 400,
  shake: 240,
  spin: 400,
};

export function resetTween(v: TweenValues): void {
  'worklet';
  for (const sv of [v.offsetX, v.offsetY, v.scaleX, v.scaleY, v.rotation]) cancelAnimation(sv);
  v.offsetX.set(0);
  v.offsetY.set(0);
  v.scaleX.set(1);
  v.scaleY.set(1);
  v.rotation.set(0);
}

/** Starts a preset, cancelling any tween in progress on the same entity (HU-GAME-009 R8). */
export function runPreset(preset: TweenPresetId, v: TweenValues): void {
  'worklet';
  resetTween(v);
  const t = (value: number, duration: number) => withTiming(value, { duration, easing: ease });
  switch (preset) {
    case 'bounce': {
      const s = withSequence(t(1.12, 90), t(0.96, 90), withSpring(1, { damping: 12, stiffness: 260 }));
      v.scaleX.set(s);
      v.scaleY.set(withSequence(t(1.12, 90), t(0.96, 90), withSpring(1, { damping: 12, stiffness: 260 })));
      break;
    }
    case 'squash':
      v.scaleY.set(withSequence(t(0.85, 60), t(1, 120)));
      v.scaleX.set(withSequence(t(1.1, 60), t(1, 120)));
      break;
    case 'wiggle':
      v.rotation.set(withSequence(t(deg(6), 60), t(deg(-6), 90), t(deg(6), 90), t(deg(-6), 60), t(0, 60)));
      break;
    case 'pulse':
      v.scaleX.set(withSequence(t(1.05, 200), t(1, 200)));
      v.scaleY.set(withSequence(t(1.05, 200), t(1, 200)));
      break;
    case 'shake':
      v.offsetX.set(withSequence(t(8, 40), t(-8, 40), t(8, 40), t(-8, 40), t(8, 40), t(0, 40)));
      break;
    case 'spin':
      v.scaleX.set(withSequence(t(-1, 200), t(1, 200)));
      v.offsetY.set(withSequence(t(-30, 200), t(0, 200)));
      break;
  }
}
