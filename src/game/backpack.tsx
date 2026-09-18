import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { Image, StyleSheet, View, type LayoutRectangle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { COLORS, IconButton, TOUCH_MIN, type ShakeHandle } from '@/ui/buttons';

import { useGame, useGameSession } from './game-context';
import type { CameraController } from './scene-view';

export interface BackpackProps {
  cameraRef: RefObject<CameraController | null>;
  /** Window rect of the button, for HUD drop detection (HU-GAME-037 R3). */
  onBounds: (rect: LayoutRectangle) => void;
}

const SLOT = TOUCH_MIN + 8;

/**
 * Backpack HUD (EPIC-010): the button is a drop target (store_in_backpack), bounces on success and
 * shakes on rejection (AC-REJECT-01). Tapping it opens a tray with the slots; dragging a slot out to the
 * world takes the item out (takeFromInventory) and continues as a normal drag. No text.
 */
export function Backpack({ cameraRef, onBounds }: BackpackProps) {
  const game = useGame();
  const session = useGameSession();
  const get = useCallback(() => game.selectors.inventorySlots(), [game]);
  const slots = useSyncExternalStore(game.subscribe, get, get);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const button = useRef<ShakeHandle>(null);
  const holder = useRef<View>(null);
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  useEffect(
    () =>
      game.events.subscribe((batch) => {
        for (const e of batch) {
          if (e.type === 'interactionPerformed' && e.uiTarget === 'inventory') {
            pop.set(withSequence(withSpring(1.2, { damping: 6 }), withSpring(1)));
          }
          if (e.type === 'interactionRejected' && e.uiTarget === 'inventory') button.current?.shake();
        }
      }),
    [game, pop],
  );

  const measure = () => holder.current?.measureInWindow((x, y, width, height) => onBounds({ x, y, width, height }));
  const used = slots.filter((s) => s.entityId).length;
  const label = game.t('ui.backpack.label');

  return (
    <View style={styles.root} pointerEvents="box-none">
      {open && (
        <View style={[styles.tray, dragging && styles.trayHidden]} accessibilityLabel={game.t('ui.backpack.tray')}>
          {slots.map((s) => (
            <TraySlot
              key={s.slot}
              slot={s.slot}
              label={s.name ? game.t(s.name) : game.t('ui.backpack.empty')}
              source={s.asset ? session?.assetSource(s.asset) : undefined}
              onDragStart={(x, y) => {
                const ok = s.entityId ? cameraRef.current?.externalDrag.begin(s.slot, x, y) ?? false : false;
                if (ok) setDragging(true);
                return ok;
              }}
              onDragMove={(x, y) => cameraRef.current?.externalDrag.move(x, y)}
              onDragEnd={(x, y, success) => {
                cameraRef.current?.externalDrag.end(x, y, success);
                setDragging(false);
                setOpen(false);
              }}
            />
          ))}
        </View>
      )}
      <Animated.View ref={holder} style={popStyle} onLayout={measure} collapsable={false}>
        <IconButton ref={button} label={label} glyph="🎒" color={COLORS.accent} size={80} selected={open} onPress={() => setOpen((o) => !o)}>
          <View style={styles.dots}>
            {slots.map((s) => (
              <View key={s.slot} style={[styles.dot, s.slot < used && styles.dotFull]} />
            ))}
          </View>
        </IconButton>
      </Animated.View>
    </View>
  );
}

interface TraySlotProps {
  slot: number;
  label: string;
  source?: number;
  onDragStart: (xDp: number, yDp: number) => boolean;
  onDragMove: (xDp: number, yDp: number) => void;
  onDragEnd: (xDp: number, yDp: number, success: boolean) => void;
}

/** One slot of the tray. An empty slot starts nothing (HU-GAME-038 R5). */
function TraySlot({ label, source, onDragStart, onDragMove, onDragEnd }: TraySlotProps) {
  const pan = useMemo(() => {
    // Gesture state lives in this closure: callbacks run on the JS thread (runOnJS), one gesture at a time.
    const state = { active: false };
    const end = (x: number, y: number, success: boolean) => {
      if (state.active) onDragEnd(x, y, success);
      state.active = false;
    };
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(6)
      .onStart((e) => {
        state.active = onDragStart(e.absoluteX, e.absoluteY);
      })
      .onUpdate((e) => {
        if (state.active) onDragMove(e.absoluteX, e.absoluteY);
      })
      .onEnd((e, success) => end(e.absoluteX, e.absoluteY, success))
      .onFinalize((e, success) => end(e.absoluteX, e.absoluteY, success));
  }, [onDragStart, onDragMove, onDragEnd]);
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.slot} accessibilityRole="button" accessibilityLabel={label}>
        {source !== undefined && <Image source={source} style={styles.slotImage} resizeMode="contain" />}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  tray: {
    position: 'absolute',
    bottom: 96,
    width: SLOT * 6 + 7 * 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,246,233,0.95)',
    borderWidth: 4,
    borderColor: COLORS.accent,
  },
  trayHidden: { opacity: 0 },
  slot: { width: SLOT, height: SLOT, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(62,44,74,0.15)' },
  slotImage: { width: SLOT - 12, height: SLOT - 12 },
  dots: { position: 'absolute', bottom: 4, flexDirection: 'row', flexWrap: 'wrap', width: 48, gap: 2, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotFull: { backgroundColor: '#FFFFFF' },
});
