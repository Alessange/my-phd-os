import type { DatabaseSync } from 'node:sqlite'
import { optStr, orNull, prepared, str, type Row } from './shared'

/** Raw cached copy of a subscription feed; used for change detection and offline display. */
export interface ConferenceSnapshot {
  subscriptionId: string
  contentHash: string
  fetchedAt: string
  etag?: string
  lastModified?: string
  rawText: string
}

const COLUMNS = 'subscription_id, content_hash, fetched_at, etag, last_modified, raw_text'

export const rowToSnapshot = (row: Row): ConferenceSnapshot => ({
  subscriptionId: str(row.subscription_id),
  contentHash: str(row.content_hash),
  fetchedAt: str(row.fetched_at),
  etag: optStr(row.etag),
  lastModified: optStr(row.last_modified),
  rawText: str(row.raw_text)
})

export const findSnapshot = (
  db: DatabaseSync,
  subscriptionId: string
): ConferenceSnapshot | undefined => {
  const row = prepared(
    db,
    `SELECT ${COLUMNS} FROM conference_snapshots WHERE subscription_id = ?`
  ).get(subscriptionId)
  return row ? rowToSnapshot(row) : undefined
}

/** Snapshots do not emit `data:changed`; the deadlines derived from them do. */
export const saveSnapshot = (
  db: DatabaseSync,
  snapshot: ConferenceSnapshot
): ConferenceSnapshot => {
  prepared(
    db,
    `INSERT INTO conference_snapshots (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(subscription_id) DO UPDATE SET
       content_hash = excluded.content_hash, fetched_at = excluded.fetched_at,
       etag = excluded.etag, last_modified = excluded.last_modified, raw_text = excluded.raw_text`
  ).run(
    snapshot.subscriptionId,
    snapshot.contentHash,
    snapshot.fetchedAt,
    orNull(snapshot.etag),
    orNull(snapshot.lastModified),
    snapshot.rawText
  )
  return snapshot
}

export const deleteSnapshot = (db: DatabaseSync, subscriptionId: string): void => {
  prepared(db, 'DELETE FROM conference_snapshots WHERE subscription_id = ?').run(subscriptionId)
}
