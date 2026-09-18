import { useCallback, useRef, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { COLORS, IconButton, TOUCH_MIN, type ShakeHandle } from '@/ui/buttons';

import type { MapLocation } from './facade';
import { useGame, useGameSession } from './game-context';

export interface MapOverlayProps {
  visible: boolean;
  onClose: () => void;
  /** Moves the camera to a zone of the active scene with the 450 ms jump (HU-GAME-051 RN-5). */
  onZone: (zoneId: string) => void;
}

/**
 * Map of HU-GAME-051: a card per location of the loaded packs (the current one highlighted, locked ones
 * with a padlock) and a button per zone of the current scene. Icons only; labels are for screen readers.
 * Traveling from the map moves nobody (RN-3).
 */
export function MapOverlay({ visible, onClose, onZone }: MapOverlayProps) {
  const game = useGame();
  const getLocations = useCallback(() => game.selectors.locations(), [game]);
  const getZones = useCallback(() => game.selectors.zones(), [game]);
  const locations = useSyncExternalStore(game.subscribe, getLocations, getLocations);
  const zones = useSyncExternalStore(game.subscribe, getZones, getZones);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.panel} onPress={() => {}} accessible={false}>
          <IconButton label={game.t('ui.map.close')} glyph="✕" color={COLORS.panel} style={styles.close} onPress={onClose} />
          <View style={styles.row}>
            {locations.map((l) => (
              <LocationCard key={l.id} location={l} onClose={onClose} />
            ))}
          </View>
          {zones.length > 0 && (
            <View style={styles.row}>
              {zones.map((z) => (
                <IconButton
                  key={z.id}
                  label={z.label}
                  glyph={z.label.slice(0, 1).toUpperCase()}
                  color={COLORS.sky}
                  onPress={() => {
                    onClose();
                    onZone(z.id);
                  }}
                />
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LocationCard({ location, onClose }: { location: MapLocation; onClose: () => void }) {
  const game = useGame();
  const session = useGameSession();
  const shake = useRef<ShakeHandle>(null);
  const icon = session?.assetSource(location.icon);
  return (
    <IconButton
      ref={shake}
      label={location.locked ? `${location.label} · ${game.t('ui.map.locked')}` : location.label}
      icon={icon}
      glyph={icon ? undefined : location.locked ? '🔒' : location.label.slice(0, 1).toUpperCase()}
      size={TOUCH_MIN * 1.6}
      color={location.current ? COLORS.selected : '#FFFFFF'}
      selected={location.current}
      disabled={location.locked}
      onPress={() => {
        if (location.locked) {
          shake.current?.shake();
          session?.audio?.reject();
          return;
        }
        onClose();
        // RN-4: the current location only closes the map.
        if (!location.current) game.dispatch({ type: 'travelTo', sceneId: location.sceneId, spawnId: location.spawnId });
      }}
    />
  );
}

/** HUD map button (RN-1, RN-7): shakes instead of opening during a drag or a transition. */
export function MapButton({ onOpen }: { onOpen: () => void }) {
  const game = useGame();
  const shake = useRef<ShakeHandle>(null);
  return (
    <IconButton
      ref={shake}
      label={game.t('ui.map.open')}
      glyph="🗺"
      color={COLORS.sky}
      onPress={() => (game.selectors.busy() ? shake.current?.shake() : onOpen())}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(62,44,74,0.45)', alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: COLORS.paper, borderRadius: 28, padding: 24, paddingTop: 40, gap: 20, alignItems: 'center' },
  close: { position: 'absolute', top: -20, right: -20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
});
