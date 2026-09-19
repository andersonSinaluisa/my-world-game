import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { COLORS, IconButton, TOUCH_MIN } from '@/ui/buttons';

import { useGame } from './game-context';

/**
 * Coin counter of the HUD (HU-GAME-065 RN-4/RN-5): a coin and the number. Coins up → hop; coins down → a
 * small dip, never a "loss" sound. It is not a button: tapping only bounces it.
 */
export function CoinCounter() {
  const game = useGame();
  const get = useCallback(() => game.selectors.coins(), [game]);
  const coins = useSyncExternalStore(game.subscribe, get, get);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(
    () =>
      game.events.subscribe((batch) => {
        for (const e of batch) {
          if (e.type !== 'walletChanged') continue;
          y.set(withSequence(withTiming(e.delta > 0 ? -12 : 6, { duration: 120 }), withSpring(0, { damping: 8 })));
        }
      }),
    [game, y],
  );

  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }, { scale: scale.get() }] }));
  return (
    <Pressable
      onPress={() => scale.set(withSequence(withSpring(1.15, { damping: 6 }), withSpring(1)))}
      accessibilityRole="text"
      accessibilityLabel={`${coins} ${game.t('ui.wallet.label')}`}>
      <Animated.View style={[styles.counter, anim]}>
        <View style={styles.coin} />
        <Text style={styles.number}>{coins}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Daily gift box (HU-GAME-067 RN-1/RN-2): wobbles while waiting; a tap claims it and it disappears. */
export function GiftBox() {
  const game = useGame();
  const get = useCallback(() => game.selectors.dailyGiftAvailable(), [game]);
  const available = useSyncExternalStore(game.subscribe, get, get);
  const tilt = useSharedValue(0);

  useEffect(() => {
    tilt.set(available ? withRepeat(withSequence(withTiming(-8, { duration: 220 }), withTiming(8, { duration: 220 }), withTiming(0, { duration: 220 })), -1) : 0);
  }, [available, tilt]);

  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.get()}deg` }] }));
  if (!available) return null;
  return (
    <Animated.View style={anim}>
      <IconButton label={game.t('ui.gift.open')} glyph="🎁" color={COLORS.selected} size={TOUCH_MIN} onPress={() => game.dispatch({ type: 'claimDailyGift' })} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 24, backgroundColor: COLORS.panel },
  coin: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFD23F', borderWidth: 4, borderColor: '#C9971C' },
  number: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', minWidth: 44 },
});
