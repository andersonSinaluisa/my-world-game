import { Canvas, Group } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { CharacterSprite } from '@/engine/adapters/render/character-sprite';
import type { TextureStore } from '@/engine/adapters/render/texture-store';
import type { CharacterLayerData } from '@/engine/characters/layers';

/** World height framed by the preview: the tallest body canvas plus a margin (placeholder art is 460). */
const FULL_FRAME = 500;
/** Portraits frame the top part of the body (HU-GAME-022 R4, proposal: cropped to the head). */
const HEAD_FRAME = 220;

export interface CharacterPreviewProps {
  layers: CharacterLayerData[];
  textures: TextureStore;
  /** Body height in world units, to frame the head of portraits. */
  bodyHeight?: number;
  crop?: 'full' | 'head';
  style?: StyleProp<ViewStyle>;
}

/**
 * The same character renderer as the game, in its own Skia canvas (creator preview and portraits).
 * Layers come from `previewCharacterLayers(draft)` or `characterLayers(id)`.
 */
export function CharacterPreview({ layers, textures, bodyHeight = 300, crop = 'full', style }: CharacterPreviewProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const frame = crop === 'head' ? HEAD_FRAME : FULL_FRAME;
  const scale = size ? size.h / frame : 1;
  // full: feet near the bottom; head: the head (top of the body) near the top of the frame.
  const originY = crop === 'head' ? bodyHeight + 20 : frame - 20;
  return (
    <View style={[styles.fill, style]} onLayout={onLayout} pointerEvents="none">
      {size && (
        <Canvas style={styles.fill}>
          <Group transform={[{ translateX: size.w / 2 }, { scale }]}>
            <CharacterSprite id="preview" layers={layers} transform={{ x: 0, y: originY }} textures={textures} />
          </Group>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
