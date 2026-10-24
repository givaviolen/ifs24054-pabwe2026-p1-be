// Autentikasi petugas: password di-hash dengan Bun.password (argon2id),
// sesi memakai token acak (disimpan sebagai hash SHA-256). Tanpa paket tambahan.
import { createHash, randomBytes } from "node:crypto";

export class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const hashToken = (t) => createHash("sha256").update(t).digest("hex");
const publicUser = (u) => (u ? { id: u.id, username: u.username, nama: u.nama } : null);

export async function registerUser(db, input) {
  const username = String(input.username ?? "").trim().toLowerCase();
  const nama = String(input.nama ?? "").trim();
  const password = String(input.password ?? "");

  if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
    throw new AuthError("Username 3-30 karakter: huruf, angka, titik, atau garis bawah");
  }
  if (nama.length < 2 || nama.length > 60) throw new AuthError("Nama harus 2-60 karakter");
  if (password.length < 6 || password.length > 100) {
    throw new AuthError("Password harus 6-100 karakter");
  }
  if (db.query("SELECT id FROM users WHERE username = ?").get(username)) {
    throw new AuthError("Username sudah dipakai", 409);
  }

  const hash = await Bun.password.hash(password);
  try {
    const info = db
      .query("INSERT INTO users (username, nama, password_hash) VALUES (?, ?, ?)")
      .run(username, nama, hash);
    return publicUser(db.query("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) throw new AuthError("Username sudah dipakai", 409);
    throw e;
  }
}

// Mengembalikan user bila username & password cocok, selain itu null.
export async function verifyLogin(db, username, password) {
  const user = db
    .query("SELECT * FROM users WHERE username = ?")
    .get(String(username ?? "").trim().toLowerCase());
  if (!user) return null;
  const ok = await Bun.password.verify(String(password ?? ""), user.password_hash);
  return ok ? publicUser(user) : null;
}

export function createSession(db, userId, days = 7) {
  db.run("DELETE FROM sessions WHERE expires_at <= datetime('now')");
  const token = randomBytes(32).toString("hex");
  db.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))"
  ).run(hashToken(token), userId, `+${days} days`);
  return token;
}

export function getUserByToken(db, token) {
  if (!token) return null;
  const user = db
    .query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
    )
    .get(hashToken(token));
  return publicUser(user);
}

export function deleteSession(db, token) {
  if (token) db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}
