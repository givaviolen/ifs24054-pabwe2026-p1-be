// Pembuatan koneksi SQLite memakai driver bawaan Bun (bun:sqlite); tanpa paket tambahan.
import { Database } from "bun:sqlite";
import { SCHEMA, migrate } from "./schema.js";

// Di Vercel (serverless) sistem file read-only kecuali /tmp, sehingga file SQLite ditempatkan di sana.
// Konsekuensinya data di /tmp bersifat sementara (hilang saat instance didaur ulang).
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
