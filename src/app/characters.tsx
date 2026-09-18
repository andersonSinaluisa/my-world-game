import { router } from 'expo-router';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CharacterPreview } from '@/game/character-preview';
import { MAX_CHARACTERS } from '@/game/facade';
import { useGame, useGameSession } from '@/game/game-context';
import { COLORS, IconButton, type ShakeHandle } from '@/ui/buttons';

/**
 * Character list (HU-GAME-022 R4): one portrait per character with its color frame, plus "new".
 * With 12 characters "new" shows a lock and shakes instead of opening the creator (R2). No text.
 */
export default function CharactersScreen() {
  const game = useGame();
  const session = useGameSession();
  const get = useCallback(() => game.selectors.characters(), [game]);
  const characters = useSyncExternalStore(game.subscribe, get, get);
  const newButton = useRef<ShakeHandle>(null);
  const catalog = game.selectors.characterCatalog();
  if (!session || !catalog) return null;
  const full = characters.length >= MAX_CHARACTERS;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton label={game.t('ui.back.label')} glyph="◀" color={COLORS.sky} onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {characters.map((c) => {
          const body = catalog.bodyTypes.find((b) => b.id === c.appearance.bodyType) ?? catalog.bodyTypes[0];
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={game.t('ui.characters.edit')}
              onPress={() => router.push({ pathname: '/creator', params: { id: c.id } })}
              style={[styles.portrait, { borderColor: c.colorTag ?? COLORS.ink }]}>
              <CharacterPreview layers={game.selectors.characterLayers(c.id)} textures={session.textures} bodyHeight={body.height} crop="head" />
            </Pressable>
          );
        })}
        <IconButton
          ref={newButton}
          size={120}
          label={game.t(full ? 'ui.characters.full' : 'ui.characters.new')}
          glyph={full ? '🔒' : '+'}
          color={full ? '#DDDDDD' : '#7ED957'}
          onPress={() => (full ? newButton.current?.shake() : router.push('/creator'))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper },
  header: { flexDirection: 'row', padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, padding: 16, justifyContent: 'center', alignItems: 'center' },
  portrait: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, overflow: 'hidden', backgroundColor: '#CDEFE3' },
});
