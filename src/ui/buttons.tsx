import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/** UI_UX_GUIDELINES: HUD and menu targets are at least 64 dp (DEFINITION_OF_DONE §6). */
export const TOUCH_MIN = 64;

export const COLORS = {
  ink: '#3E2C4A',
  paper: '#FFF6E9',
  accent: '#FF8A3D',
  sky: '#4FB3F6',
  selected: '#FFD23F',
  panel: 'rgba(62,44,74,0.85)',
};

export interface ShakeHandle {
  /** Soft rejection feedback: a short horizontal shake, no text (AC-REJECT-01). */
  shake(): void;
}

export interface IconButtonProps {
  label: string;
  onPress: () => void;
  icon?: ImageSourcePropType;
  glyph?: string;
  color?: string;
  size?: number;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Wordless button: an icon, a glyph or a color swatch. Always has an i18n accessibilityLabel.
 * The selected option gets a thick border and a slightly bigger scale (HU-GAME-018 R7).
 */
export const IconButton = forwardRef<ShakeHandle, IconButtonProps>(function IconButton(
  { label, onPress, icon, glyph, color, size = TOUCH_MIN, selected, disabled, style, children },
  ref,
) {
  const dx = useSharedValue(0);
  useImperativeHandle(ref, () => ({
    shake() {
      dx.set(withSequence(withTiming(-10, { duration: 60 }), withTiming(10, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 })));
    },
  }));
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: dx.get() }, { scale: selected ? 1.08 : 1 }] }));
  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!selected, disabled: !!disabled }}
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size * 0.28, backgroundColor: color ?? '#FFFFFF' },
          selected && styles.selected,
          disabled && styles.disabled,
        ]}>
        {icon ? <Image source={icon} style={{ width: size * 0.82, height: size * 0.82 }} resizeMode="contain" /> : null}
        {glyph ? <Text style={[styles.glyph, { fontSize: size * 0.45 }]}>{glyph}</Text> : null}
        {children}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(62,44,74,0.15)',
  },
  selected: { borderColor: COLORS.selected, borderWidth: 6 },
  disabled: { opacity: 0.5 },
  glyph: { color: COLORS.ink, fontWeight: '800' },
});
