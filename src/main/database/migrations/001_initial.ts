import type { Migration } from './types'

export const initialMigration: Migration = {
  version: 1,
  name: 'initial',
  sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE calendar_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL,
  original_file_name TEXT,
  imported_at TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  target_at TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_milestones_target_at ON milestones(target_at);

CREATE TABLE conference_subscriptions (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  language TEXT,
  filters_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  etag TEXT,
  last_modified TEXT,
  content_hash TEXT,
  last_success_at TEXT,
  last_attempt_at TEXT,
  last_error_json TEXT,
  custom_confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE conference_snapshots (
  subscription_id TEXT PRIMARY KEY REFERENCES conference_subscriptions(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  etag TEXT,
  last_modified TEXT,
  raw_text TEXT NOT NULL
);

CREATE TABLE conference_deadlines (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES conference_subscriptions(id) ON DELETE CASCADE,
  upstream_uid TEXT,
  title TEXT NOT NULL,
  conference_name TEXT,
  conference_year INTEGER,
  full_name TEXT,
  category TEXT,
  ccf_rank TEXT,
  core_rank TEXT,
  thcpl_rank TEXT,
  deadline_round TEXT,
  comment TEXT,
  location TEXT,
  conference_start_at TEXT,
  conference_end_at TEXT,
  deadline_at TEXT,
  original_timezone TEXT,
  raw_dtstart TEXT,
  homepage_url TEXT,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_ics_data TEXT,
  upstream_snapshot_hash TEXT NOT NULL,
  upstream_updated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stable_key TEXT NOT NULL,
  deadline_kind TEXT NOT NULL,
  conference_dates_text TEXT,
  dblp_url TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  original_timezone_label TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  UNIQUE(subscription_id, stable_key)
);
CREATE INDEX idx_conference_deadlines_deadline_at ON conference_deadlines(deadline_at);
CREATE INDEX idx_conference_deadlines_status ON conference_deadlines(status);
CREATE INDEX idx_conference_deadlines_conference_name ON conference_deadlines(conference_name);

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  recurrence_rule TEXT,
  recurrence_id TEXT,
  location TEXT,
  source_calendar_id TEXT REFERENCES calendar_sources(id) ON DELETE RESTRICT,
  imported_uid TEXT,
  linked_personal_deadline_id TEXT REFERENCES personal_deadlines(id) ON DELETE SET NULL,
  linked_conference_deadline_id TEXT REFERENCES conference_deadlines(id) ON DELETE SET NULL,
  linked_milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  source_managed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  exdates_json TEXT,
  rdates_json TEXT,
  recurrence_master_id TEXT REFERENCES calendar_events(id) ON DELETE CASCADE,
  status TEXT,
  source_label TEXT,
  url TEXT
);
CREATE INDEX idx_calendar_events_start_at ON calendar_events(start_at);
CREATE INDEX idx_calendar_events_end_at ON calendar_events(end_at);
CREATE INDEX idx_calendar_events_source ON calendar_events(source_calendar_id);
CREATE INDEX idx_calendar_events_imported_uid ON calendar_events(imported_uid);
CREATE INDEX idx_calendar_events_linked_personal ON calendar_events(linked_personal_deadline_id);
CREATE INDEX idx_calendar_events_linked_conference ON calendar_events(linked_conference_deadline_id);
CREATE INDEX idx_calendar_events_linked_milestone ON calendar_events(linked_milestone_id);
CREATE INDEX idx_calendar_events_master ON calendar_events(recurrence_master_id);

CREATE TABLE personal_deadlines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tracking_start_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  source_url TEXT,
  location TEXT,
  tags_json TEXT,
  linked_milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  linked_calendar_event_id TEXT REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_personal_deadlines_deadline_at ON personal_deadlines(deadline_at);
CREATE INDEX idx_personal_deadlines_status ON personal_deadlines(status);

CREATE TABLE followed_conferences (
  conference_deadline_id TEXT PRIMARY KEY REFERENCES conference_deadlines(id) ON DELETE CASCADE,
  followed_at TEXT NOT NULL,
  intention TEXT,
  progress REAL,
  notes TEXT,
  calendar_event_id TEXT REFERENCES calendar_events(id) ON DELETE SET NULL
);

CREATE TABLE conference_deadline_changes (
  id TEXT PRIMARY KEY,
  conference_deadline_id TEXT NOT NULL REFERENCES conference_deadlines(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  previous_value_json TEXT,
  current_value_json TEXT,
  detected_at TEXT NOT NULL,
  upstream_snapshot_hash TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_conference_changes_deadline ON conference_deadline_changes(conference_deadline_id);
CREATE INDEX idx_conference_changes_acknowledged ON conference_deadline_changes(acknowledged);

CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  frequency_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE habit_completions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  UNIQUE(habit_id, date)
);
CREATE INDEX idx_habit_completions_date ON habit_completions(date);

CREATE TABLE dismissed_warnings (
  key TEXT PRIMARY KEY,
  dismissed_at TEXT NOT NULL,
  payload_json TEXT
);
`
}
