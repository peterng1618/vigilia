CREATE TABLE item (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'pending', 'published', 'unpublished', 'rejected', 'removed')
  ),
  status_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  unpublished_at TEXT,
  removed_at TEXT,
  downloads INTEGER NOT NULL DEFAULT 0,
  remix_of_id TEXT
);

CREATE INDEX item_status ON item (status);
CREATE INDEX item_author_user_id ON item (author_user_id);

CREATE TABLE item_version (
  item_id TEXT NOT NULL,
  version TEXT NOT NULL,
  envelope_json TEXT NOT NULL,
  facets_json TEXT NOT NULL,
  package_key TEXT NOT NULL,
  thumbnail_key TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_id, version)
);

CREATE TABLE favorite (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX favorite_item_id ON favorite (item_id);

CREATE TABLE author_profile (
  user_id TEXT PRIMARY KEY,
  verified INTEGER NOT NULL DEFAULT 0,
  display_name TEXT
);

-- Task 2.2 counts a user's rows in the trailing hour to enforce the presign limit.
CREATE TABLE presign_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX presign_event_user_id_at ON presign_event (user_id, at);
