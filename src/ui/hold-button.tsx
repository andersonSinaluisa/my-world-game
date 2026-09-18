import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from './buttons';

export interface HoldButtonProps {
  label: string;
  /** How long the finger must stay down (parental gear 3 s, reset confirm 2 s). */
  holdMs: number;
  onComplete: () => void;
  disabled?: boolean;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Press-and-hold button with a progress bar (HU-GAME-074 RN-1, HU-GAME-055 RN-2). Releasing early cancels
 * with no negative feedback.
 */
export function HoldButton({ label, holdMs, onComplete, disabled, size = 64, color = COLORS.panel, style, children }: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = undefined;
    setProgress(0);
  };
  useEffect(() => stop, []);
  const start = () => {
    if (disabled) return;
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / holdMs);
      setProgress(p);
      if (p >= 1) {
        stop();
        onComplete();
      }
    }, 50);
  };
  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, { minWidth: size, minHeight: size, borderRadius: size * 0.28, backgroundColor: color }, disabled && styles.disabled, style]}>
      {children}
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, overflow: 'hidden' },
  disabled: { opacity: 0.4 },
  track: { position: 'absolute', left: 6, right: 6, bottom: 5, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
});
