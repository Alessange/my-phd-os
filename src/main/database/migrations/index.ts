import { initialMigration } from './001_initial'
import type { Migration } from './types'

export type { Migration } from './types'

/** All migrations, in the order they are applied. Feature ranges: see ARCHITECTURE §3. */
export const migrations: readonly Migration[] = [initialMigration]
