import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GameProvider } from '@/game/game-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <GameProvider>
        <StatusBar hidden />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </GameProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
