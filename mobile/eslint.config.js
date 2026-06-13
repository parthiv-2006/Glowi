// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The React Compiler lint rules `immutability` and `purity` do not model
    // Reanimated worklets, whose entire API is mutating `sharedValue.value`
    // inside animation/gesture callbacks. Leaving them on produces false
    // positives in every animated component. `rules-of-hooks`, `exhaustive-deps`,
    // unused-vars, and all type safety remain enforced.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);
