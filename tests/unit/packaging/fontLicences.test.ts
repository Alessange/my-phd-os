import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')

describe('font licence packaging (Decision 68)', () => {
  it('ships the OFL text and the author notice as extra resources', () => {
    const config = readFileSync(resolve(root, 'electron-builder.yml'), 'utf8')
    expect(config).toMatch(
      /extraResources:\s*\n\s*- from: src\/renderer\/src\/assets\/fonts\s*\n\s*to: licenses\/fonts/
    )
    expect(config).toMatch(/filter:\s*\n\s*- '\*\.txt'/)
    for (const file of ['OFL-1.1.txt', 'LICENCE.txt']) {
      expect(existsSync(resolve(root, 'src/renderer/src/assets/fonts', file))).toBe(true)
    }
  })
})
