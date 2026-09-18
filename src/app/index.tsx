import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Placeholder title screen (HU-GAME-001 R5). The real Title screen is HU-GAME-073.
 */
export default function TitleScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        MyWorld
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF6E9', gap: 24 },
  title: { fontSize: 48, fontWeight: '800', color: '#3E2C4A' },
});
