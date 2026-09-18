import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CharacterPreview } from '@/game/character-preview';
import { appearancePatch, changedSlots, draftFromCharacter, newDraft, setGarment, setPart, type CreatorDraft } from '@/game/creator-draft';
import { useGame, useGameSession } from '@/game/game-context';
import { COLORS, IconButton, TOUCH_MIN } from '@/ui/buttons';

type Tab = 'body' | 'skin' | 'face' | 'hair' | 'clothes';
const TABS: Tab[] = ['body', 'skin', 'face', 'hair', 'clothes'];
const SLOT_ORDER = ['top', 'bottom', 'shoes'] as const;

/**
 * Character creator (EPIC-005, HU-GAME-018..023). Wordless: icons and swatches with i18n accessibility
 * labels. The draft is UI state until ✓; the engine is only touched through facade commands.
 */
export default function CreatorScreen() {
  const game = useGame();
  const session = useGameSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const catalog = game.selectors.characterCatalog();
  const original = useMemo(() => (id ? game.selectors.characters().find((c) => c.id === id) : undefined), [game, id]);
  const [draft, setDraft] = useState<CreatorDraft | null>(() =>
    original ? draftFromCharacter(original) : catalog ? newDraft(catalog) : null,
  );
  const [tab, setTab] = useState<Tab>('body');
  const clothes = game.selectors.clothingOptions();

  if (!session || !catalog || !draft) return null;
  const source = (key: string) => {
    const s = session.assetSource(key);
    return s === undefined ? undefined : s;
  };
  const layers = game.selectors.previewCharacterLayers(draft);
  const body = catalog.bodyTypes.find((b) => b.id === draft.appearance.bodyType) ?? catalog.bodyTypes[0];
  const t = (key: string | undefined, fallback: string) => (key ? game.t(key) : fallback);

  const confirm = async () => {
    // First time: the new game starts here, then the character appears in newGame.sceneId (HU-GAME-073 RN-2).
    if (!game.selectors.activeScene()) await session.start();
    if (original) {
      // Edit mode: only the changed fields, plus one setOutfitSlot per changed slot (HU-GAME-022 R6).
      const patch = appearancePatch(original.appearance, draft);
      if (Object.keys(patch).length) game.dispatch({ type: 'updateAppearance', characterId: original.id, patch });
      for (const change of changedSlots(original.outfit, draft)) {
        game.dispatch({ type: 'setOutfitSlot', characterId: original.id, ...change });
      }
      void session.flush();
      router.back();
      return;
    }
    const result = game.dispatch({ type: 'createCharacter', appearance: draft.appearance, outfit: draft.outfit });
    void session.flush();
    if (result.ok && result.entityId) session.requestFocus(result.entityId);
    router.dismissTo('/play');
  };

  const section = (children: React.ReactNode, key: string) => (
    <View key={key} style={styles.grid}>
      {children}
    </View>
  );

  let content: React.ReactNode;
  if (tab === 'body') {
    content = section(
      catalog.bodyTypes.map((b) => (
        <IconButton key={b.id} size={96} label={game.t(b.name)} icon={source(b.icon)} selected={draft.appearance.bodyType === b.id} onPress={() => setDraft(setPart(draft, 'bodyType', b.id))} />
      )),
      'bodies',
    );
  } else if (tab === 'skin') {
    content = section(
      catalog.skinTones.map((s) => (
        <IconButton key={s.id} label={t(s.name, s.id)} color={s.color} selected={draft.appearance.skinTone === s.id} onPress={() => setDraft(setPart(draft, 'skinTone', s.id))} />
      )),
      'skins',
    );
  } else if (tab === 'face') {
    content = [
      section(
        catalog.eyes.map((e) => (
          <IconButton key={e.id} size={80} label={t(e.name, e.id)} icon={source(e.icon)} selected={draft.appearance.eyes === e.id} onPress={() => setDraft(setPart(draft, 'eyes', e.id))} />
        )),
        'eyes',
      ),
      section(
        catalog.mouths.map((m) => (
          <IconButton key={m.id} size={80} label={t(m.name, m.id)} icon={source(m.icon)} selected={draft.appearance.mouth === m.id} onPress={() => setDraft(setPart(draft, 'mouth', m.id))} />
        )),
        'mouths',
      ),
    ];
  } else if (tab === 'hair') {
    content = [
      section(
        catalog.hairStyles.map((h) => (
          <IconButton key={h.id} size={80} label={t(h.name, h.id)} icon={source(h.icon)} selected={draft.appearance.hairStyle === h.id} onPress={() => setDraft(setPart(draft, 'hairStyle', h.id))} />
        )),
        'styles',
      ),
      section(
        catalog.hairColors.map((c) => (
          <IconButton key={c.id} label={t(c.name, c.id)} color={c.color} selected={draft.appearance.hairColor === c.id} onPress={() => setDraft(setPart(draft, 'hairColor', c.id))} />
        )),
        'colors',
      ),
    ];
  } else {
    content = SLOT_ORDER.map((slot) =>
      section(
        clothes
          .filter((c) => c.slot === slot)
          .map((c) => (
            <IconButton key={c.prefabId} size={80} label={game.t(c.name)} icon={source(c.icon)} selected={draft.outfit[slot] === c.prefabId} onPress={() => setDraft(setGarment(draft, slot, c.prefabId))} />
          )),
        slot,
      ),
    );
  }

  const tabIcon: Record<Tab, { icon?: number; color?: string }> = {
    body: { icon: source(body.icon) },
    skin: { color: catalog.skinTones.find((s) => s.id === draft.appearance.skinTone)?.color },
    face: { icon: source(catalog.eyes.find((e) => e.id === draft.appearance.eyes)?.icon ?? '') },
    hair: { icon: source(catalog.hairStyles.find((h) => h.id === draft.appearance.hairStyle)?.icon ?? '') },
    clothes: { icon: source(clothes.find((c) => c.prefabId === draft.outfit.top)?.icon ?? '') },
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.previewPanel}>
        <IconButton label={game.t('ui.back.label')} glyph="◀" color={COLORS.sky} onPress={() => router.back()} style={styles.back} />
        <CharacterPreview layers={layers} textures={session.textures} bodyHeight={body.height} />
      </View>
      <View style={styles.optionsPanel}>
        <View style={styles.tabs}>
          {TABS.map((name) => (
            <IconButton key={name} label={game.t(`ui.creator.tab.${name}`)} icon={tabIcon[name].icon} color={tabIcon[name].color} selected={tab === name} onPress={() => setTab(name)} />
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.options}>{content}</ScrollView>
        <IconButton label={game.t('ui.creator.confirm')} glyph="✓" color="#7ED957" size={88} onPress={() => void confirm()} style={styles.confirm} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.paper },
  previewPanel: { flex: 2, backgroundColor: '#CDEFE3', borderTopRightRadius: 32, borderBottomRightRadius: 32 },
  back: { position: 'absolute', top: 12, left: 12, zIndex: 1 },
  optionsPanel: { flex: 3, padding: 16, gap: 12 },
  tabs: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  options: { gap: 20, paddingBottom: TOUCH_MIN * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  confirm: { position: 'absolute', right: 16, bottom: 16 },
});
