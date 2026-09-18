import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { grade, type Grade, type Metric } from '@/engine/perf/budgets';

import { useGame, useGameSession } from './game-context';

/** Refresh rate of the overlay: 2 Hz, so it does not cost what it measures (HU-GAME-071 RN-3). */
export const PERF_SAMPLE_MS = 500;

const GRADE_COLOR: Record<Grade, string> = { ok: '#7CE38B', warning: '#FFD166', critical: '#FF6B6B' };

type Row = { metric: Metric; label: string; value: number | undefined; unit: string };

/** Frames counted over `ms` → frames per second, rounded. */
export function fps(frames: number, ms: number): number {
  return ms > 0 ? Math.round((frames * 1000) / ms) : 0;
}

/**
 * Dev-only performance overlay (HU-GAME-071). Never mounted in release builds: the play screen renders it
 * behind `__DEV__`. UI FPS comes from the UI thread (useFrameCallback), JS FPS from requestAnimationFrame.
 */
export function PerfOverlay() {
  const game = useGame();
  const session = useGameSession();
  const { width } = useWindowDimensions();
  const uiFrames = useSharedValue(0);
  const [rows, setRows] = useState<Row[]>([]);

  useFrameCallback(() => {
    'worklet';
    uiFrames.set(uiFrames.get() + 1);
  });

  useEffect(() => {
    let jsFrames = 0;
    let raf = 0;
    const tick = () => {
      jsFrames += 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      const cameraX = game.selectors.cameraX();
      const rendered = cameraX === undefined ? undefined : game.selectors.visibleEntities({ cameraX, viewportW: width }).length;
      const perf = game.selectors.perf();
      setRows([
        { metric: 'uiFps', label: 'UI', value: fps(uiFrames.get(), elapsed), unit: 'fps' },
        { metric: 'jsFps', label: 'JS', value: fps(jsFrames, elapsed), unit: 'fps' },
        { metric: 'renderedEntities', label: 'mounted', value: rendered, unit: '' },
        { metric: 'loadedEntities', label: 'loaded', value: perf.loadedEntities, unit: '' },
        { metric: 'textureMb', label: 'tex', value: session ? Math.round(session.textures.usedBytes / 1e6) : undefined, unit: 'MB' },
        { metric: 'transitionMs', label: 'scene', value: perf.lastTransitionMs, unit: 'ms' },
        { metric: 'flushMs', label: 'save', value: session?.lastFlushMs, unit: 'ms' },
      ]);
      uiFrames.set(0);
      jsFrames = 0;
    }, PERF_SAMPLE_MS);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [game, session, width, uiFrames]);

  return (
    <View style={styles.box} pointerEvents="none" accessible={false}>
      {rows.map((r) => (
        <Text key={r.metric} style={[styles.text, { color: r.value === undefined ? '#ccc' : GRADE_COLOR[grade(r.metric, r.value)] }]}>
          {r.label} {r.value ?? '–'}
          {r.unit}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 8, bottom: 8, padding: 6, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  text: { fontSize: 11, fontFamily: 'monospace', lineHeight: 14 },
});
