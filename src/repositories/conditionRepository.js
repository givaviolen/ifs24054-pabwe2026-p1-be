// Akses tabel daily_conditions. Hanya SQL.
export const findHistory = (db, spotId, limit) =>
  db
    .query(
      `SELECT id, kondisi_eceng_gondok, tinggi_ombak, catatan_petugas, updated_at
       FROM daily_conditions WHERE spot_id = ?
       ORDER BY updated_at DESC, id DESC LIMIT ?`
    )
    .all(spotId, limit);

// Menyimpan log dan memperbarui status pantai dalam satu transaksi (keduanya berhasil atau gagal bersama).
export function insertAndUpdateSpotStatus(db, { spotId, eceng, ombak, catatan, status }) {
  return db.transaction(() => {
    const info = db
      .query(
        `INSERT INTO daily_conditions (spot_id, kondisi_eceng_gondok, tinggi_ombak, catatan_petugas)
         VALUES (?, ?, ?, ?)`
      )
      .run(spotId, eceng, ombak, catatan);
    db.query("UPDATE beach_spots SET current_status = ? WHERE id = ?").run(status, spotId);
    return db.query("SELECT * FROM daily_conditions WHERE id = ?").get(info.lastInsertRowid);
  })();
}
