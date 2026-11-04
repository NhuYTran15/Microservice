CREATE TABLE IF NOT EXISTS memberships (
  mid SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  score INTEGER NOT NULL CHECK (score >= 0)
);

CREATE TABLE IF NOT EXISTS customers (
  uid INTEGER PRIMARY KEY,
  fullname VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  mid INTEGER NOT NULL REFERENCES memberships(mid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO memberships(mid, name, score) VALUES
  (1, 'BRONZE', 0),
  (2, 'SILVER', 100),
  (3, 'GOLD', 500),
  (4, 'PLATINUM', 1000)
ON CONFLICT (mid) DO UPDATE SET name = EXCLUDED.name, score = EXCLUDED.score;

SELECT setval(pg_get_serial_sequence('memberships', 'mid'), (SELECT MAX(mid) FROM memberships));

