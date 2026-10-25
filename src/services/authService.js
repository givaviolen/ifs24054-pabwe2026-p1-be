// Autentikasi petugas: password di-hash dengan Bun.password (argon2id),
// sesi memakai token bertanda tangan HMAC (stateless). Tanpa paket tambahan.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AuthError } from "../errors/AuthError.js";
import { parseRegistration } from "../validators/authValidator.js";
import * as users from "../repositories/userRepository.js";

const SESSION_HOURS = 24;

const sha256 = (text) => createHash("sha256").update(text).digest();
const sign = (data, secret) => createHmac("sha256", secret).update(data).digest("base64url");
const publicUser = (u) => (u ? { id: u.id, username: u.username, nama: u.nama } : null);

// Perbandingan waktu-konstan agar kode registrasi tidak bisa ditebak lewat selisih waktu respons.
export function isPetugasCodeValid(provided, expected) {
  if (!expected || !provided) return false;
  return timingSafeEqual(sha256(String(provided)), sha256(expected));
}

export async function registerUser(db, input) {
  const { username, nama, password } = parseRegistration(input);
  if (users.findByUsername(db, username)) throw new AuthError("Username sudah dipakai", 409);

  const passwordHash = await Bun.password.hash(password);
  try {
    const id = users.insert(db, { username, nama, passwordHash });
    return publicUser(users.findById(db, id));
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) throw new AuthError("Username sudah dipakai", 409);
    throw e;
  }
}

// Mengembalikan user bila username & password cocok, selain itu null.
export async function verifyLogin(db, username, password) {
  const user = users.findByUsername(db, String(username ?? "").trim().toLowerCase());
  if (!user) return null;
  const ok = await Bun.password.verify(String(password ?? ""), user.password_hash);
  return ok ? publicUser(user) : null;
}

// Token login tanpa database: base64url({ sub: username, exp }) + "." + HMAC-SHA256.
// Server mana pun yang memegang kunci yang sama dapat memverifikasinya, sehingga login tetap sah
// walau permintaan berikutnya dilayani instance serverless lain.
export function createSession(user, secret, hours = SESSION_HOURS, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: user.username, exp: now + hours * 3_600_000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function getUserByToken(db, token, secret, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length) return null;

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (!claims?.exp || claims.exp <= now) return null;
  return publicUser(users.findByUsername(db, claims.sub));
}
