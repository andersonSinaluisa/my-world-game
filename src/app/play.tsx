import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent, type LayoutRectangle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backpack } from '@/game/backpack';
import { GateGear } from '@/game/gate-gear';
import { useGame, useGameSession } from '@/game/game-context';
import { useActiveScene } from '@/game/hooks';
import { SceneView, type CameraController } from '@/game/scene-view';
import { COLORS, IconButton } from '@/ui/buttons';

/** Extra margin around the backpack button that still counts as dropping on it (children's fingers). */
const DROP_SLOP = 12;

/**
 * Play screen (HU-GAME-053/054): measures the screen, loads the save or starts a new game, then shows
 * the world with its HUD: back, characters (EPIC-005) and the backpack (EPIC-010). No text.
 */
export default function PlayScreen() {
  const game = useGame();
  const session = useGameSession();
  const scene = useActiveScene();
  const [started, setStarted] = useState(false);
  const camera = useRef<CameraController>(null);
  const backpack = useRef<LayoutRectangle | null>(null);

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

  // The backpack button is the first drop candidate when the finger is over it (HU-GAME-037 R3).
  const uiTargetAt = useCallback((x: number, y: number) => {
    const r = backpack.current;
    if (!r) return undefined;
    const inside = x >= r.x - DROP_SLOP && x <= r.x + r.width + DROP_SLOP && y >= r.y - DROP_SLOP && y <= r.y + r.height + DROP_SLOP;
    return inside ? ('inventory' as const) : undefined;
  }, []);

  if (!session) return null;
  return (
    <View style={styles.root} onLayout={onLayout}>
      {scene ? (
        <SceneView textures={session.textures} cameraRef={camera} uiTargetAt={uiTargetAt} />
      ) : (
        <ActivityIndicator style={styles.fill} size="large" color={COLORS.ink} />
      )}
      <SafeAreaView style={styles.hud} pointerEvents="box-none" edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topRow} pointerEvents="box-none">
          <IconButton
            label={game.t('ui.back.label')}
            glyph="◀"
            color={COLORS.panel}
            onPress={() => {
              void session.flush();
              router.back();
            }}
          />
          <View style={styles.topRight} pointerEvents="box-none">
            <IconButton label={game.t('ui.play.characters')} glyph="☺" color={COLORS.selected} onPress={() => router.push('/characters')} />
            <GateGear onPassed={() => router.push('/settings')} />
          </View>
        </View>
        {/* Bottom center: away from the auto-scroll edge zones (HU-GAME-037 open question). */}
        <View style={styles.bottomRow} pointerEvents="box-none">
          {scene && <Backpack cameraRef={camera} onBounds={(r) => (backpack.current = r)} />}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper },
  fill: { flex: 1 },
  hud: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  bottomRow: { alignItems: 'center', paddingBottom: 12 },
  topRight: { flexDirection: 'row', gap: 12 },
});
