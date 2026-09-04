import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/out',
      '**/dist',
      '**/release',
      '**/coverage',
      '**/playwright-report',
      '**/test-results',
      '**/.eslintcache'
    ]
  },
  tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [
      eslintPluginReactHooks.configs.flat.recommended,
      eslintPluginReactRefresh.configs.vite
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }]
    }
  },
  eslintConfigPrettier
)
