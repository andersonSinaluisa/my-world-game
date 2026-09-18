import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGame, useGameSession } from '@/game/game-context';
import { COLORS, IconButton } from '@/ui/buttons';
import { useActiveScene } from '@/game/hooks';
import { SceneView } from '@/game/scene-view';

/**
 * Play screen (HU-GAME-053/054): measures the screen, loads the save or starts a new game, then shows
 * the world. Game HUD (backpack, map…) arrives with its own HUs.
 */
export default function PlayScreen() {
  const game = useGame();
  const session = useGameSession();
  const scene = useActiveScene();
  const [started, setStarted] = useState(false);

  // Back from the creator: center the new character (HU-GAME-023 R4).
  useFocusEffect(
    useCallback(() => {
      const id = session?.takeFocus();
      if (id) game.dispatch({ type: 'focusEntity', entityId: id });
    }, [game, session]),
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (!session || started) return;
      const { width, height } = e.nativeEvent.layout;
      setStarted(true);
      session.setScreenSize(width, height);
      void session.start();
    },
    [session, started],
  );

  if (!session) return null;
  return (
    <View style={styles.root} onLayout={onLayout}>
      {scene ? <SceneView textures={session.textures} /> : <ActivityIndicator style={styles.fill} size="large" color="#3E2C4A" />}
      <SafeAreaView style={styles.hud} pointerEvents="box-none" edges={['top', 'left', 'right']}>
        <View style={styles.hudRow} pointerEvents="box-none">
        <Pressable
          style={styles.back}
          onPress={() => {
            void session.flush();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel={game.t('ui.back.label')}>
          <Text style={styles.backText}>◀</Text>
        </Pressable>
        <IconButton label={game.t('ui.play.characters')} glyph="☺" color={COLORS.selected} onPress={() => router.push('/characters')} style={styles.hudButton} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF6E9' },
  fill: { flex: 1 },
  hud: { ...StyleSheet.absoluteFill },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hudButton: { margin: 16 },
  back: {
    margin: 16,
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(62,44,74,0.85)',
  },
  backText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
});
