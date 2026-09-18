import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, IconButton, type ShakeHandle } from '@/ui/buttons';

import { useGame } from './game-context';
import { ParentalGate } from './parental-gate';

export interface ParentalGateModalProps {
  gate: ParentalGate;
  visible: boolean;
  onPassed: () => void;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

/**
 * Parental gate challenge (HU-GAME-074): a multiplication in digits with a short adult text and an own
 * numeric keypad. No multiple choice, no voice, no icons that give hints (RN-2). Android back closes it.
 */
export function ParentalGateModal({ gate, visible, onPassed, onClose }: ParentalGateModalProps) {
  const game = useGame();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const field = useRef<ShakeHandle>(null);

  // RN-4: 60 s without interaction closes the gate.
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      if (gate.idleExpired()) {
        gate.cancel();
        onClose();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [visible, gate, onClose]);

  const press = (key: string) => {
    if (key === 'ok') {
      const r = gate.confirm();
      if (r === 'passed') onPassed();
      else if (r === 'locked') onClose();
      else field.current?.shake();
    } else gate.press(key);
    rerender();
  };

  const c = gate.challenge;
  const keyLabel = useMemo(() => ({ del: game.t('ui.gate.delete'), ok: game.t('ui.gate.confirm') }), [game]);
  return (
    <Modal visible={visible && !!c} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape']}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={game.t('ui.gate.close')}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Text style={styles.prompt}>{game.t('ui.gate.prompt')}</Text>
          {c && (
            <Text style={styles.challenge} accessibilityLabel={`${c.a} × ${c.b}`}>
              {c.a} × {c.b}
            </Text>
          )}
          <IconButton ref={field} label={gate.input || game.t('ui.gate.answer')} size={64} color="#FFFFFF" onPress={() => {}} style={styles.field}>
            <Text style={styles.input}>{gate.input || ' '}</Text>
          </IconButton>
          <View style={styles.keypad}>
            {KEYS.map((k) => (
              <Pressable key={k} onPress={() => press(k)} style={[styles.key, k === 'ok' && styles.okKey]} accessibilityRole="button" accessibilityLabel={keyLabel[k as 'del' | 'ok'] ?? k}>
                <Text style={styles.keyText}>{k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: COLORS.paper, borderRadius: 24, padding: 20, alignItems: 'center', gap: 10, minWidth: 360 },
  close: { position: 'absolute', top: 8, right: 8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 24, color: COLORS.ink },
  prompt: { fontSize: 16, color: COLORS.ink, marginTop: 8 },
  challenge: { fontSize: 36, fontWeight: '800', color: COLORS.ink },
  field: { minWidth: 160 },
  input: { fontSize: 28, fontWeight: '700', color: COLORS.ink },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 72, gap: 6, justifyContent: 'center' },
  key: { width: 64, height: 48, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(62,44,74,0.2)' },
  okKey: { backgroundColor: '#7ED957' },
  keyText: { fontSize: 22, fontWeight: '700', color: COLORS.ink },
});
