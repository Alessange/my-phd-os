import type { DatabaseSync } from 'node:sqlite'
import type { AddSubscriptionRequest, UpdateSubscriptionPatch } from '@shared/schemas/conference'
import type {
  ConferenceSubscription,
  RemoveSubscriptionResult,
  SubscriptionError,
  SubscriptionFilters
} from '@shared/types/conference'
import { AppError } from '@shared/errors'
import { transaction } from '../connection'
import { changeBus } from '../changeBus'
import {
  bool,
  buildSet,
  fromJson,
  newId,
  notFound,
  nowIso,
  num,
  optStr,
  orNull,
  prepared,
  str,
  toInt,
  toJson,
  type Row
} from './shared'

const COLUMNS = `id, url, label, kind, language, filters_json, enabled, etag, last_modified,
  content_hash, last_success_at, last_attempt_at, last_error_json, custom_confirmed_at,
  created_at, updated_at`

export const rowToSubscription = (row: Row): ConferenceSubscription => ({
  id: str(row.id),
  url: str(row.url),
  label: str(row.label),
  kind: str(row.kind) as ConferenceSubscription['kind'],
  language: optStr(row.language) as ConferenceSubscription['language'],
  filters: fromJson<SubscriptionFilters>(row.filters_json),
  enabled: bool(row.enabled),
  etag: optStr(row.etag),
  lastModified: optStr(row.last_modified),
  contentHash: optStr(row.content_hash),
  lastSuccessAt: optStr(row.last_success_at),
  lastAttemptAt: optStr(row.last_attempt_at),
  lastError: fromJson<SubscriptionError>(row.last_error_json),
  customConfirmedAt: optStr(row.custom_confirmed_at),
  createdAt: str(row.created_at),
  updatedAt: str(row.updated_at)
})

export const listSubscriptions = (db: DatabaseSync): ConferenceSubscription[] =>
  prepared(db, `SELECT ${COLUMNS} FROM conference_subscriptions ORDER BY created_at, label`)
    .all()
    .map(rowToSubscription)

export const findSubscription = (
  db: DatabaseSync,
  id: string
): ConferenceSubscription | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM conference_subscriptions WHERE id = ?`).get(id)
  return row ? rowToSubscription(row) : undefined
}

export const findSubscriptionByUrl = (
  db: DatabaseSync,
  url: string
): ConferenceSubscription | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM conference_subscriptions WHERE url = ?`).get(url)
  return row ? rowToSubscription(row) : undefined
}

export const getSubscription = (db: DatabaseSync, id: string): ConferenceSubscription => {
  const subscription = findSubscription(db, id)
  if (!subscription) throw notFound('Conference subscription', id)
  return subscription
}

export interface CreateSubscriptionInput extends Omit<
  AddSubscriptionRequest,
  'confirmCustom' | 'label'
> {
  label: string
  customConfirmedAt?: string
}

export const createSubscription = (
  db: DatabaseSync,
  input: CreateSubscriptionInput
): ConferenceSubscription => {
  if (findSubscriptionByUrl(db, input.url)) {
    throw new AppError('CONFLICT', 'A subscription with this URL already exists', {
      url: input.url
    })
  }
  const id = newId()
  const now = nowIso()
  prepared(
    db,
    `INSERT INTO conference_subscriptions (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`
  ).run(
    id,
    input.url,
    input.label,
    input.kind,
    orNull(input.language),
    toJson(input.filters),
    1,
    orNull(input.customConfirmedAt),
    now,
    now
  )
  changeBus.emit('conferenceSubscriptions')
  return getSubscription(db, id)
}

export const updateSubscription = (
  db: DatabaseSync,
  id: string,
  patch: UpdateSubscriptionPatch
): ConferenceSubscription => {
  getSubscription(db, id)
  const { clause, values } = buildSet({
    enabled: patch.enabled === undefined ? undefined : toInt(patch.enabled),
    label: patch.label,
    updated_at: nowIso()
  })
  prepared(db, `UPDATE conference_subscriptions SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('conferenceSubscriptions')
  return getSubscription(db, id)
}

export interface FetchStatePatch {
  etag?: string | null
  lastModified?: string | null
  contentHash?: string | null
  lastSuccessAt?: string
  lastAttemptAt?: string
  lastError?: SubscriptionError | null
}

/** Records the outcome of a fetch attempt (used by the subscriptions fetcher). */
export const recordFetchState = (
  db: DatabaseSync,
  id: string,
  patch: FetchStatePatch
): ConferenceSubscription => {
  getSubscription(db, id)
  const { clause, values } = buildSet({
    etag: patch.etag,
    last_modified: patch.lastModified,
    content_hash: patch.contentHash,
    last_success_at: patch.lastSuccessAt,
    last_attempt_at: patch.lastAttemptAt,
    last_error_json:
      patch.lastError === undefined
        ? undefined
        : patch.lastError === null
          ? null
          : JSON.stringify(patch.lastError),
    updated_at: nowIso()
  })
  prepared(db, `UPDATE conference_subscriptions SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('conferenceSubscriptions')
  return getSubscription(db, id)
}

/** Removes a subscription and (via cascades) its snapshot, deadlines, follows and change history. */
export const removeSubscription = (db: DatabaseSync, id: string): RemoveSubscriptionResult => {
  getSubscription(db, id)
  const removedDeadlines = transaction(db, () => {
    const count = num(
      prepared(db, 'SELECT COUNT(*) AS n FROM conference_deadlines WHERE subscription_id = ?').get(
        id
      )?.n ?? 0
    )
    prepared(db, 'DELETE FROM conference_subscriptions WHERE id = ?').run(id)
    return count
  })
  changeBus.emit(
    'conferenceSubscriptions',
    'conferenceDeadlines',
    'followedConferences',
    'conferenceChanges'
  )
  return { ok: true, removedDeadlines }
}
