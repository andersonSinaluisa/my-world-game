// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// ARCHITECTURE §2/§6: engine core is pure TypeScript (no React/RN/Skia/Expo),
// and UI talks to the engine only through src/game (GameFacade + hooks).
const ENGINE_PURE = [
  'src/engine/core/**',
  'src/engine/components/**',
  'src/engine/systems/**',
  'src/engine/actions/**',
  'src/engine/rules/**',
  'src/engine/scene/**',
  'src/engine/content/**',
  'src/engine/persistence/**',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*'],
  },
  {
    files: ENGINE_PURE.map((p) => `${p}/*.{ts,tsx}`).concat(ENGINE_PURE),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Engine core must not depend on React (ARCHITECTURE §6.1).' },
            { name: 'react-native', message: 'Engine core must not depend on React Native (ARCHITECTURE §6.1).' },
          ],
          patterns: [
            { group: ['react-native*', '@shopify/react-native-skia*'], message: 'Engine core must not depend on RN/Skia (ARCHITECTURE §6.1).' },
            { group: ['expo', 'expo-*', '@expo/*'], message: 'Engine core must not depend on Expo (ARCHITECTURE §6.1).' },
            { group: ['@/engine/adapters/*', '@/game/*', '@/ui/*', '@/app/*'], message: 'Engine core must not import outer layers.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/engine/*', '@/engine/**'], message: 'UI must use src/game (GameFacade + hooks), never the engine directly (ARCHITECTURE §6.7).' },
          ],
        },
      ],
    },
  },
]);
