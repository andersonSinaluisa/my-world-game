import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SANDBOX_ASSETS } from '@content/sandbox/assets';
import sandbox from '@content/sandbox/render-sandbox.json';
import { useGame } from '@/game/game-context';
import { useVisibleEntities } from '@/game/hooks';
import { SceneView, type CameraController } from '@/game/scene-view';
import { createTextureStore } from '@/game/textures';

const PRESETS = ['bounce', 'wiggle', 'squash', 'pulse', 'shake', 'spin'] as const;
const JUMPS = [960, 2880, 4800, 6720];

/**
 * Dev-only render sandbox (EPIC-002 manual verification): virtual resolution grid, layers/z,
 * camera pan + inertia + jumpTo, culling counters and tween presets. Uses CC0 placeholders.
 */
export default function RenderSandboxScreen() {
  const game = useGame();
  const camera = useRef<CameraController>(null);
  const [grid, setGrid] = useState(true);
  const textures = useMemo(() => createTextureStore(SANDBOX_ASSETS), []);
  const mounted = useVisibleEntities(undefined).length;

  useEffect(() => {
    game.dev.activateScene(sandbox.scene as never, sandbox.entities as never);
  }, [game]);

  if (!__DEV__) return null;

  const playAll = () => {
    const bushes = sandbox.entities.filter((e) => e.id.includes('bush')).slice(0, PRESETS.length);
    bushes.forEach((e, i) => game.dev.playEffect(e.id, PRESETS[i]));
  };

  return (
    <View style={styles.root}>
      <SceneView textures={textures} showGrid={grid} cameraRef={camera} />
      <SafeAreaView style={styles.hud} pointerEvents="box-none" edges={['top', 'left', 'right']}>
        <View style={styles.row} pointerEvents="box-none">
          <HudButton label="◀ Back" onPress={() => router.back()} />
          <HudButton label={grid ? 'Grid on' : 'Grid off'} onPress={() => setGrid((g) => !g)} />
          {JUMPS.map((x, i) => (
            <HudButton key={x} label={`Zone ${i + 1}`} onPress={() => camera.current?.jumpTo(x)} />
          ))}
          <HudButton label="Presets" onPress={playAll} />
          <Text style={styles.info}>
            loaded {sandbox.entities.length} · tex {(textures.usedBytes / 1048576).toFixed(0)} MB · all {mounted}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function HudButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#CDEFE3' },
  hud: { ...StyleSheet.absoluteFill },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8, alignItems: 'center' },
  button: { minHeight: 48, minWidth: 64, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(62,44,74,0.85)' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  info: { color: '#3E2C4A', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(255,246,233,0.85)', padding: 6, borderRadius: 8 },
});
