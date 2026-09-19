import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { COLORS } from '@/ui/buttons';

import { useGame, useGameSession } from './game-context';
import { FADE_MS, LOADING_INDICATOR_MS, type TransitionPhase } from './transition-director';

const IDLE = (): TransitionPhase => 'idle';

/** Current transition phase of the session ('idle' without one). */
export function useTransitionPhase(): TransitionPhase {
  const session = useGameSession();
  const t = session?.transition;
  return useSyncExternalStore(t ? (l) => t.subscribe(l) : () => () => {}, t ? () => t.phase : IDLE, t ? () => t.phase : IDLE);
}

/**
 * Full-screen fade of HU-GAME-050: 300 ms to the scene's palette color, a wordless bouncing indicator if
 * the load passes 600 ms, 300 ms back. It also swallows every touch while visible (RN-4).
 */
export function TransitionOverlay() {
  const game = useGame();
  const session = useGameSession();
  const phase = useTransitionPhase();
  const opacity = useSharedValue(0);
  const bounce = useSharedValue(0);
  const [slowFlag, setSlowFlag] = useState(false);
  const slow = phase === 'loading' && slowFlag;
  // The target scene stays known until the fade-in ends; idle is invisible, so its color does not matter.
  const color = game.selectors.transitionColor(session?.transition.targetSceneId);

  useEffect(() => {
    const visible = phase === 'out' || phase === 'loading';
    opacity.set(withTiming(visible ? 1 : 0, { duration: FADE_MS, easing: Easing.inOut(Easing.quad) }));
    if (phase !== 'loading') return;
    const timer = setTimeout(() => setSlowFlag(true), LOADING_INDICATOR_MS);
    return () => {
      clearTimeout(timer);
      setSlowFlag(false);
    };
  }, [phase, opacity]);

  useEffect(() => {
    bounce.set(slow ? withRepeat(withSequence(withTiming(-18, { duration: 260 }), withTiming(0, { duration: 260 })), -1) : 0);
  }, [slow, bounce]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const dot = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.get() }] }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: color }, fade]}
      pointerEvents={phase === 'idle' ? 'none' : 'auto'}
      accessibilityElementsHidden={phase === 'idle'}
      importantForAccessibility={phase === 'idle' ? 'no-hide-descendants' : 'auto'}>
      {slow ? (
        <View style={styles.row} testID="transition-loading">
          {[0, 1, 2].map((i) => (
            <Animated.View key={i} style={[styles.dot, i === 1 && dot]} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 14 },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.accent },
});
