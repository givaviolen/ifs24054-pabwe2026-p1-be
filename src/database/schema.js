// Skema SQLite dan migrasi untuk database lama.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS beach_spots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_pantai    TEXT    NOT NULL,
  kabupaten      TEXT    NOT NULL,
  kedalaman_avg  REAL,
  is_ramah_anak  INTEGER NOT NULL DEFAULT 0 CHECK (is_ramah_anak IN (0, 1)),
  ada_pelampung  INTEGER NOT NULL DEFAULT 0 CHECK (ada_pelampung IN (0, 1)),
  current_status TEXT    NOT NULL DEFAULT 'AMAN'
                 CHECK (current_status IN ('AMAN', 'WASPADA', 'BAHAYA')),
  latitude       REAL,
  longitude      REAL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_conditions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id              INTEGER NOT NULL,
  kondisi_eceng_gondok TEXT NOT NULL
                       CHECK (kondisi_eceng_gondok IN ('Bersih', 'Sedang', 'Pekat')),
  tinggi_ombak         TEXT NOT NULL
                       CHECK (tinggi_ombak IN ('Tenang', 'Sedang', 'Tinggi')),
  catatan_petugas      TEXT,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (spot_id) REFERENCES beach_spots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conditions_spot
  ON daily_conditions (spot_id, updated_at DESC);

-- Akun petugas lapangan (wisatawan tidak punya akun).
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  nama          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// Database lama (dibuat sebelum ada peta) belum punya kolom latitude/longitude.
export function migrate(db) {
  const cols = db.query("PRAGMA table_info(beach_spots)").all().map((c) => c.name);
  if (!cols.includes("latitude")) db.exec("ALTER TABLE beach_spots ADD COLUMN latitude REAL");
  if (!cols.includes("longitude")) db.exec("ALTER TABLE beach_spots ADD COLUMN longitude REAL");
}
