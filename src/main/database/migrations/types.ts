/**
 * Migrations are TypeScript modules (not `.sql` files) because electron-vite bundles the main
 * process into a single file; embedding the SQL keeps the migration set inside that bundle.
 */
export interface Migration {
  /** Positive integer; applied in ascending order. */
  version: number
  name: string
  /** One or more statements executed inside a single transaction. */
  sql: string
}
