import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CURRENT_SAVE_VERSION } from '@/game/facade';
import { useGame, useGameSession } from '@/game/game-context';
import { IDLE_MS } from '@/game/parental-gate';
import { COLORS } from '@/ui/buttons';
import { HoldButton } from '@/ui/hold-button';

/** HU-GAME-055 RN-2: the reset confirm is held for 2 s. */
const RESET_HOLD_MS = 2000;

/**
 * Settings (HU-GAME-075), always behind the parental gate. Adult UI: text allowed, controls ≥ 48 dp.
 * Sound (HU-GAME-058), language, world reset (HU-GAME-055) and version info. Closes after 60 s idle.
 */
export default function SettingsScreen() {
  const game = useGame();
  const session = useGameSession();
  const get = useCallback(() => game.selectors.settings(), [game]);
  const settings = useSyncExternalStore(game.subscribe, get, get);
  const [resetChoice, setResetChoice] = useState<'all' | 'keep' | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const lastTouch = useRef(0);
  const touch = () => (lastTouch.current = Date.now());

  const close = useCallback(() => {
    void session?.flush(); // RN-4 proposal: flush on close
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [session]);

  // HU-GAME-074 RN-4: 60 s without interaction closes the adult area.
  useEffect(() => {
    lastTouch.current = Date.now();
    const t = setInterval(() => {
      if (Date.now() - lastTouch.current >= IDLE_MS) close();
    }, 1000);
    return () => clearInterval(t);
  }, [close]);

  const set = (key: 'musicVolume' | 'sfxVolume' | 'muted' | 'language', value: number | boolean | string) => {
    touch();
    game.dispatch({ type: 'setSetting', key, value });
    if (key === 'sfxVolume') session?.uiTap(); // HU-GAME-058 RN-2: a sample of the new volume
  };

  const reset = async () => {
    touch();
    if (!session || !resetChoice) return;
    const r = await session.resetWorld(resetChoice === 'keep');
    setResetChoice(undefined);
    if (!r.ok) {
      setNotice(game.t('ui.settings.resetFailed'));
      return;
    }
    router.dismissAll();
    router.replace(r.status === 'new' ? '/' : '/play');
  };

  const core = game.selectors.packVersion('core');
  const language = settings.language ?? (game.t('ui.language.code') === 'en' ? 'en' : 'es');

  return (
    <SafeAreaView style={styles.root} onTouchStart={touch}>
      <View style={styles.header}>
        <Text style={styles.h1}>{game.t('ui.settings.title')}</Text>
        <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel={game.t('ui.gate.close')}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h2}>{game.t('ui.settings.sound')}</Text>
        <Stepper label={game.t('ui.settings.music')} value={settings.musicVolume} onChange={(v) => set('musicVolume', v)} />
        <Stepper label={game.t('ui.settings.effects')} value={settings.sfxVolume} onChange={(v) => set('sfxVolume', v)} />
        <Row label={game.t('ui.settings.mute')}>
          <Choice label={game.t(settings.muted ? 'ui.settings.on' : 'ui.settings.off')} selected={settings.muted} onPress={() => set('muted', !settings.muted)} />
        </Row>

        <Text style={styles.h2}>{game.t('ui.settings.language')}</Text>
        <Row label="">
          <Choice label="Español" selected={language === 'es'} onPress={() => set('language', 'es')} />
          <Choice label="English" selected={language === 'en'} onPress={() => set('language', 'en')} />
        </Row>

        <Text style={styles.h2}>{game.t('ui.settings.world')}</Text>
        <Row label="">
          <Choice label={game.t('ui.settings.resetAll')} selected={resetChoice === 'all'} onPress={() => (touch(), setResetChoice('all'))} />
          <Choice label={game.t('ui.settings.resetKeep')} selected={resetChoice === 'keep'} onPress={() => (touch(), setResetChoice('keep'))} />
        </Row>
        {resetChoice && (
          <View style={styles.confirmRow}>
            <Text style={styles.small}>{game.t('ui.settings.resetHold')}</Text>
            <HoldButton label={game.t('ui.settings.resetConfirm')} holdMs={RESET_HOLD_MS} onComplete={() => void reset()} color="#E53935">
              <Text style={styles.danger}>{game.t('ui.settings.resetConfirm')}</Text>
            </HoldButton>
            <Choice label={game.t('ui.settings.cancel')} onPress={() => setResetChoice(undefined)} />
          </View>
        )}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Text style={styles.h2}>{game.t('ui.settings.info')}</Text>
        <Text style={styles.small}>
          {game.t('ui.settings.version')}: {Constants.expoConfig?.version ?? '?'} · core {core ?? '?'} · save v{CURRENT_SAVE_VERSION}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.rowControls}>{children}</View>
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceOn]} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label}>
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** 0..1 in steps of 0.1 (HU-GAME-058 RN-6) with − / + buttons and a bar. */
function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const step = (d: number) => onChange(Math.round(Math.min(1, Math.max(0, value + d)) * 10) / 10);
  return (
    <Row label={label}>
      <Choice label="−" onPress={() => step(-0.1)} />
      <View style={styles.bar} accessibilityLabel={`${label} ${Math.round(value * 100)}%`}>
        <View style={[styles.barFill, { width: `${value * 100}%` }]} />
      </View>
      <Choice label="+" onPress={() => step(0.1)} />
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  h1: { fontSize: 24, fontWeight: '800', color: COLORS.ink },
  close: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 26, color: COLORS.ink },
  content: { padding: 20, gap: 12 },
  h2: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { width: 120, fontSize: 16, color: COLORS.ink },
  rowControls: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  choice: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 2, borderColor: COLORS.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  choiceOn: { backgroundColor: COLORS.ink },
  choiceText: { fontSize: 16, color: COLORS.ink, fontWeight: '700' },
  choiceTextOn: { color: '#FFFFFF' },
  bar: { width: 180, height: 16, borderRadius: 8, backgroundColor: '#E0D7E6', overflow: 'hidden' },
  barFill: { height: 16, backgroundColor: COLORS.accent },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  danger: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  small: { fontSize: 14, color: COLORS.ink },
  notice: { fontSize: 14, color: '#B71C1C' },
});
