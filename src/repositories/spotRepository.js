// Akses tabel beach_spots (+ kondisi terbaru dari daily_conditions). Hanya SQL.
const LATEST_CONDITION_JOIN = `
  LEFT JOIN daily_conditions c
    ON c.id = (
      SELECT id FROM daily_conditions
      WHERE spot_id = s.id
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    )`;

const SELECT_SPOT = `
  SELECT s.*,
         c.kondisi_eceng_gondok,
         c.tinggi_ombak,
         c.catatan_petugas,
         c.updated_at AS kondisi_updated_at
  FROM beach_spots s ${LATEST_CONDITION_JOIN}`;

// Karakter % dan _ pada kata kunci di-escape agar dibaca apa adanya.
const escapeLike = (text) => text.replace(/[\\%_]/g, "\\$&");

export function findAll(db, { status, kabupaten, q, adaPelampung, ramahAnak } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push("s.current_status = ?"); params.push(status); }
  if (kabupaten) { where.push("s.kabupaten = ? COLLATE NOCASE"); params.push(kabupaten); }
  if (q) {
    where.push("(s.nama_pantai LIKE ? ESCAPE '\\' OR s.kabupaten LIKE ? ESCAPE '\\')");
    const like = `%${escapeLike(q)}%`;
    params.push(like, like);
  }
  if (adaPelampung !== undefined) { where.push("s.ada_pelampung = ?"); params.push(adaPelampung); }
  if (ramahAnak !== undefined) { where.push("s.is_ramah_anak = ?"); params.push(ramahAnak); }

  const sql = `${SELECT_SPOT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY s.nama_pantai ASC`;
  return db.query(sql).all(...params);
}

export const findById = (db, id) => db.query(`${SELECT_SPOT} WHERE s.id = ?`).get(id);

// Baris mentah tanpa join kondisi: dipakai untuk menggabungkan perubahan parsial.
export const findRawById = (db, id) => db.query("SELECT * FROM beach_spots WHERE id = ?").get(id);

export const exists = (db, id) => Boolean(db.query("SELECT id FROM beach_spots WHERE id = ?").get(id));

export function insert(db, s) {
  const info = db
    .query(
      `INSERT INTO beach_spots
         (nama_pantai, kabupaten, kedalaman_avg, is_ramah_anak, ada_pelampung, current_status, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(s.nama_pantai, s.kabupaten, s.kedalaman_avg, s.is_ramah_anak, s.ada_pelampung,
         s.current_status, s.latitude, s.longitude);
  return Number(info.lastInsertRowid);
}

export function update(db, id, s) {
  db.query(
    `UPDATE beach_spots SET nama_pantai=?, kabupaten=?, kedalaman_avg=?,
       is_ramah_anak=?, ada_pelampung=?, current_status=?, latitude=?, longitude=? WHERE id=?`
  ).run(s.nama_pantai, s.kabupaten, s.kedalaman_avg, s.is_ramah_anak, s.ada_pelampung,
        s.current_status, s.latitude, s.longitude, id);
}

export const remove = (db, id) => db.query("DELETE FROM beach_spots WHERE id = ?").run(id).changes;
