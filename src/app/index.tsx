import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAX_CHARACTERS } from '@/game/facade';
import { useGame, useGameSession } from '@/game/game-context';
import { GateGear } from '@/game/gate-gear';
import { COLORS, IconButton } from '@/ui/buttons';

type Mode = 'loading' | 'save' | 'none' | 'incompatible' | 'failed';

/**
 * Title screen (HU-GAME-073). With a save: Continue (main) and Create character. Without one: only Create
 * character. An incompatible save shows an adult notice and no Continue. The gear opens the parental gate.
 * Icons only, with i18n accessibility labels; no ads, links or purchases.
 */
export default function TitleScreen() {
  const game = useGame();
  const session = useGameSession();
  const [mode, setMode] = useState<Mode>('loading');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void session?.inspect().then((m) => alive && setMode(m));
      return () => {
        alive = false;
      };
    }, [session]),
  );

  const createCharacter = () => {
    const full = game.selectors.characters().length >= MAX_CHARACTERS;
    router.push(full ? '/characters' : '/creator'); // RN-4
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gear}>
        <GateGear onPassed={() => router.push('/settings')} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {game.t('ui.title.label')}
      </Text>
      {mode === 'loading' && <ActivityIndicator size="large" color={COLORS.ink} />}
      {mode !== 'loading' && (
        <View style={styles.row}>
          {mode === 'save' && (
            <IconButton label={game.t('ui.play.label')} glyph="▶" color={COLORS.accent} size={140} onPress={() => router.push('/play')} />
          )}
          <IconButton
            label={game.t('ui.title.create')}
            glyph="☺+"
            color={mode === 'save' ? COLORS.selected : COLORS.accent}
            size={mode === 'save' ? 100 : 140}
            onPress={createCharacter}
          />
        </View>
      )}
      {(mode === 'incompatible' || mode === 'failed') && (
        <Text style={styles.notice} accessibilityRole="alert">
          {game.t(mode === 'incompatible' ? 'ui.title.incompatible' : 'ui.title.saveFailed')}
        </Text>
      )}
      {__DEV__ && (
        <Link href="/dev-render" asChild>
          <Pressable style={styles.dev} accessibilityLabel="Open render sandbox">
            <Text style={styles.devText}>Render sandbox (dev)</Text>
          </Pressable>
        </Link>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper, gap: 24 },
  gear: { position: 'absolute', top: 16, right: 16 },
  title: { fontSize: 48, fontWeight: '800', color: COLORS.ink },
  row: { flexDirection: 'row', gap: 32, alignItems: 'center' },
  notice: { maxWidth: 420, textAlign: 'center', color: COLORS.ink, fontSize: 14 },
  dev: { position: 'absolute', bottom: 16, left: 16, minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.sky },
  devText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
