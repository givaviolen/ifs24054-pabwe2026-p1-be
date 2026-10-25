// Akses tabel users. Hanya SQL; tanpa aturan bisnis.
export const findByUsername = (db, username) =>
  db.query("SELECT * FROM users WHERE username = ?").get(username);

export const findById = (db, id) => db.query("SELECT * FROM users WHERE id = ?").get(id);

export function insert(db, { username, nama, passwordHash }) {
  const info = db
    .query("INSERT INTO users (username, nama, password_hash) VALUES (?, ?, ?)")
    .run(username, nama, passwordHash);
  return Number(info.lastInsertRowid);
}
