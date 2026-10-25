// Seluruh pembacaan environment variable dipusatkan di sini; bagian lain menerima nilai jadi.
import { createHash, randomBytes } from "node:crypto";

const DEV_PETUGAS_CODE = "TOBA2026"; // hanya dipakai saat pengembangan lokal

const splitList = (value) =>
  String(value ?? "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

// Kunci penanda tangan token login. Di Vercel setiap instance punya memori dan database sendiri,
// jadi kunci HARUS sama di semua instance: isi SESSION_SECRET. Bila kosong, kunci diturunkan dari
// PETUGAS_CODE / PETUGAS_PASSWORD (stabil antar instance). Tanpa keduanya, kunci acak per proses (hanya cocok untuk lokal).
export function resolveSessionSecret(env = process.env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const seed = [env.PETUGAS_CODE, env.PETUGAS_PASSWORD].filter(Boolean).join("|");
  if (seed) return createHash("sha256").update(`tws-session|${seed}`).digest("hex");
  return randomBytes(32).toString("hex");
}

/**
 * @param {Record<string,string|undefined>} env  biasanya process.env
 * @param {object} overrides                      dipakai test untuk menimpa nilai tertentu
 */
export function loadConfig(env = process.env, overrides = {}) {
  const isProduction = env.NODE_ENV === "production" || Boolean(env.VERCEL);
  return {
    isProduction,
    port: Number(env.PORT) || 3000,
    // Di produksi kode registrasi WAJIB diatur lewat env; tanpa itu registrasi ditutup.
    petugasCode: overrides.petugasCode ?? env.PETUGAS_CODE ?? (isProduction ? null : DEV_PETUGAS_CODE),
    sessionSecret: overrides.sessionSecret ?? resolveSessionSecret(env),
    corsOrigins: splitList(overrides.corsOrigin ?? env.CORS_ORIGIN),
    authRateLimit: { windowMs: 15 * 60 * 1000, max: 30, ...overrides.authRateLimit },
  };
}
