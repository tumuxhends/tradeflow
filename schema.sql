-- TradeFlow accounts + referrals (Cloudflare D1)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,            -- this person's referral code
  sponsor_id INTEGER REFERENCES users(id),   -- who brought them (NULL = joined directly)
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_sponsor ON users(sponsor_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),        -- who earns it
  from_user_id INTEGER NOT NULL REFERENCES users(id),   -- whose deposit created it
  level INTEGER NOT NULL,                               -- 1 = direct, 2, 3
  pct REAL NOT NULL,
  amount_usd REAL NOT NULL,
  ref_event TEXT NOT NULL UNIQUE,                       -- event id + level: stops double counting
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comm_user ON commissions(user_id, claimed);
