// Persiapan database yang dipakai bersama oleh server lokal (server.js) dan Vercel (api/index.js).
import { seedSpots, seedSampleConditions } from "./db.js";
import { registerUser } from "./auth.js";

// Membuat akun petugas awal dari environment variable (PETUGAS_USERNAME + PETUGAS_PASSWORD).
// Berguna di Vercel: database di /tmp dibuat ulang saat instance daur ulang, sehingga akun hasil
// registrasi bisa hilang. Akun dari env selalu dibuat ulang otomatis.
export async function seedPetugas(db, env = process.env) {
  const username = (env.PETUGAS_USERNAME || "").trim();
  const password = env.PETUGAS_PASSWORD || "";
  if (!username || !password) return null;
  if (db.query("SELECT id FROM users WHERE username = ?").get(username.toLowerCase())) return null;
  try {
    return await registerUser(db, { username, password, nama: env.PETUGAS_NAMA || "Petugas Lapangan" });
  } catch (e) {
    console.warn("Akun petugas dari environment tidak dibuat:", e.message);
    return null;
  }
}

export async function bootstrap(db, env = process.env) {
  seedSpots(db);
  seedSampleConditions(db);
  await seedPetugas(db, env);
  return db;
}
