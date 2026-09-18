import { useMemo, useReducer, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { COLORS } from '@/ui/buttons';
import { HoldButton } from '@/ui/hold-button';

import { useGame, useGameSession } from './game-context';
import { HOLD_MS, ParentalGate } from './parental-gate';
import { ParentalGateModal } from './parental-gate-modal';

/**
 * The settings gear (HU-GAME-073 RN-5, HU-GAME-075 RN-1): hold 3 s to get the parental challenge; passing it
 * runs `onPassed` (open the settings). It never opens the destination directly. While locked it shows an
 * hourglass and does nothing (HU-GAME-074 RN-3).
 */
export function GateGear({ onPassed }: { onPassed: () => void }) {
  const game = useGame();
  const session = useGameSession();
  const fallback = useMemo(() => new ParentalGate(Math.random, Date.now), []);
  const gate = session?.gate ?? fallback;
  const [open, setOpen] = useState(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const locked = !gate.canOpen();
  return (
    <>
      <HoldButton
        label={game.t('ui.settings.open')}
        holdMs={HOLD_MS}
        disabled={locked}
        onComplete={() => {
          if (gate.open()) setOpen(true);
          rerender();
        }}>
        <Text style={styles.glyph}>{locked ? '⏳' : '⚙'}</Text>
      </HoldButton>
      <ParentalGateModal
        gate={gate}
        visible={open}
        onPassed={() => {
          setOpen(false);
          onPassed();
        }}
        onClose={() => {
          setOpen(false);
          rerender();
          // re-render when the 30 s lock ends
          if (!gate.canOpen()) setTimeout(rerender, gate.lockedForMs + 50);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 30, color: COLORS.paper },
});
