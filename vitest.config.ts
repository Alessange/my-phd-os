import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const shared = resolve(__dirname, 'src/shared')

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'tests/e2e/**', 'out/**', 'dist/**', 'release/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/shared/**', 'src/main/**', 'src/renderer/src/**'],
      exclude: ['**/*.test.*', '**/*.d.ts']
    },
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/shared/**/*.test.ts',
            'src/main/**/*.test.ts',
            'tests/unit/**/*.test.ts',
            'tests/integration/**/*.test.ts'
          ],
          exclude: ['**/node_modules/**', 'tests/e2e/**']
        },
        resolve: {
          alias: { '@shared': shared, '@main': resolve(__dirname, 'src/main') }
        }
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', 'tests/e2e/**'],
          setupFiles: ['tests/setup/renderer.ts']
        },
        resolve: {
          alias: { '@renderer': resolve(__dirname, 'src/renderer/src'), '@shared': shared }
        }
      }
    ]
  }
})
