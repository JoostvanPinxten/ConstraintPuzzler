// ESLint for the TypeScript workspaces.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/coverage/**',
      '**/dist/**',
      '.venv/**',
      'build/**',
      'app/.expo/**',
      'app/android/**',
      'app/ios/**',
      'e2e/results/**',
      'playwright-report/**',
      'desktop/src-tauri/target/**',
      'desktop/src-tauri/gen/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // the app runs in React Native and in browsers
    files: ['app/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['app/**/*.test.{ts,tsx}', 'app/jest.setup.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      // jest.mock factories must use require()
      '@typescript-eslint/no-require-imports': 'off',
      // tests assert on values they know are there
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
