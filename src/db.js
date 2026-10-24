// Inisialisasi database SQLite memakai driver bawaan Bun (bun:sqlite).
// Tidak perlu paket tambahan seperti better-sqlite3.
import { Database } from "bun:sqlite";

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

-- Sesi login. Yang disimpan adalah hash token, bukan token aslinya.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

// Data contoh: [nama, kabupaten, kedalaman_avg, ramah_anak, pelampung, status, lat, lng]
// PERHATIAN: koordinat adalah PERKIRAAN. Verifikasi di Google Maps lalu ubah lewat
// panel petugas bila kurang tepat. Status hanya contoh awal, bukan kondisi nyata.
export const SEED_SPOTS = [
  // Kabupaten Toba
  ["Pantai Lumban Bul-bul", "Toba", 1.5, 1, 1, "AMAN", 2.3369, 99.0576],
  ["Pantai Lumban Silintong", "Toba", 1.5, 1, 1, "AMAN", 2.3290, 99.0650],
  ["Pantai Meat", "Toba", 2.0, 1, 0, "WASPADA", 2.5090, 99.0150],
  ["Pantai Batuhoda", "Toba", 2.4, 0, 0, "WASPADA", 2.4980, 99.0000],
  ["Pantai Sibisa", "Toba", 2.2, 1, 0, "AMAN", 2.5650, 98.9750],
  // Kabupaten Samosir
  ["Pantai Pasir Putih Parbaba", "Samosir", 1.2, 1, 1, "AMAN", 2.5780, 98.7010],
  ["Pantai Tuktuk Siadong", "Samosir", 1.8, 1, 1, "AMAN", 2.6665, 98.8350],
  ["Pantai Tomok", "Samosir", 2.0, 1, 1, "AMAN", 2.6640, 98.8650],
  ["Pantai Ambarita", "Samosir", 2.1, 1, 0, "WASPADA", 2.6400, 98.8550],
  ["Pantai Lumban Suhi-suhi", "Samosir", 3.0, 0, 0, "BAHAYA", 2.6100, 98.6900],
  ["Pantai Situngkir", "Samosir", 2.6, 0, 0, "WASPADA", 2.5750, 98.6850],
  // Kabupaten Simalungun
  ["Pantai Bebas Parapat", "Simalungun", 2.8, 0, 0, "WASPADA", 2.6590, 98.9380],
  ["Pantai Haranggaol", "Simalungun", 3.2, 0, 0, "BAHAYA", 2.7400, 98.6900],
  ["Pantai Tigaras", "Simalungun", 2.5, 0, 0, "AMAN", 2.7650, 98.9500],
  // Kabupaten Karo & Dairi
  ["Pantai Paropo", "Karo", 2.0, 1, 0, "AMAN", 2.8900, 98.5700],
  ["Pantai Silalahi", "Dairi", 2.3, 1, 0, "AMAN", 2.8550, 98.5750],
  // Kabupaten Tapanuli Utara
  ["Pantai Muara", "Tapanuli Utara", 1.9, 1, 0, "AMAN", 2.1850, 98.9900],
];

// Database lama (dibuat sebelum ada peta) belum punya kolom latitude/longitude.
export function migrate(db) {
  const cols = db.query("PRAGMA table_info(beach_spots)").all().map((c) => c.name);
  if (!cols.includes("latitude")) db.exec("ALTER TABLE beach_spots ADD COLUMN latitude REAL");
  if (!cols.includes("longitude")) db.exec("ALTER TABLE beach_spots ADD COLUMN longitude REAL");
}

// Di Vercel (serverless) sistem file bersifat read-only kecuali /tmp, sehingga file SQLite
// ditempatkan di sana. Konsekuensinya data di /tmp bersifat sementara (hilang saat instance didaur ulang).
export function resolveDbPath(env = process.env) {
  if (env.DB_PATH) return env.DB_PATH;
  return env.VERCEL ? "/tmp/tobawatersafe.sqlite" : "tobawatersafe.sqlite";
}

export function createDb(path = resolveDbPath()) {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;"); // wajib diaktifkan per koneksi di SQLite
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Menambahkan pantai yang belum ada (dicocokkan lewat nama) dan melengkapi koordinat
// pantai lama yang belum punya. Data yang sudah diubah petugas tidak ditimpa.
export function seedSpots(db) {
  const find = db.prepare("SELECT id, latitude FROM beach_spots WHERE nama_pantai = ?");
  const insert = db.prepare(
    `INSERT INTO beach_spots
       (nama_pantai, kabupaten, kedalaman_avg, is_ramah_anak, ada_pelampung, current_status, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const fillCoords = db.prepare("UPDATE beach_spots SET latitude = ?, longitude = ? WHERE id = ?");
  db.transaction(() => {
    for (const row of SEED_SPOTS) {
      const existing = find.get(row[0]);
      if (!existing) insert.run(...row);
      else if (existing.latitude === null) fillCoords.run(row[6], row[7], existing.id);
    }
  })();
}

export const seedIfEmpty = seedSpots; // alias nama lama

// Contoh laporan awal agar halaman detail dan kartu pantai langsung berisi data (berguna untuk demo
// dan untuk deployment serverless yang databasenya dibuat ulang). Hanya dibuat bila belum ada log sama sekali.
const SAMPLE_CONDITION = {
  AMAN: ["Bersih", "Tenang", "Air jernih dan ombak tenang. Aman untuk berenang (contoh laporan awal sistem)."],
  WASPADA: ["Sedang", "Sedang", "Ada sebaran eceng gondok tipis dan ombak sedang. Berenang dengan hati-hati (contoh laporan awal sistem)."],
  BAHAYA: ["Pekat", "Tinggi", "Eceng gondok pekat atau ombak tinggi. Berenang tidak disarankan (contoh laporan awal sistem)."],
};

export function seedSampleConditions(db) {
  if (db.query("SELECT COUNT(*) AS n FROM daily_conditions").get().n > 0) return 0;
  const spots = db.query("SELECT id, current_status FROM beach_spots").all();
  const insert = db.prepare(
    "INSERT INTO daily_conditions (spot_id, kondisi_eceng_gondok, tinggi_ombak, catatan_petugas) VALUES (?, ?, ?, ?)"
  );
  db.transaction(() => {
    for (const s of spots) insert.run(s.id, ...(SAMPLE_CONDITION[s.current_status] || SAMPLE_CONDITION.AMAN));
  })();
  return spots.length;
}
