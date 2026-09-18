import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Placeholder title screen (HU-GAME-001 R5). The real Title screen is HU-GAME-073.
 * In development it links to the render sandbox used to verify EPIC-002 on devices.
 */
export default function TitleScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        MyWorld
      </Text>
      {__DEV__ && (
        <View style={styles.devRow}>
          <Link href="/dev-render" asChild>
            <Pressable style={styles.button} accessibilityLabel="Open render sandbox">
              <Text style={styles.buttonText}>Render sandbox (dev)</Text>
            </Pressable>
          </Link>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF6E9', gap: 24 },
  title: { fontSize: 48, fontWeight: '800', color: '#3E2C4A' },
  devRow: { flexDirection: 'row', gap: 16 },
  button: { minHeight: 64, minWidth: 64, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 20, backgroundColor: '#4FB3F6' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
