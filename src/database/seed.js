// Pengisian data awal. Semua fungsi idempotent: aman dijalankan berulang kali.
import { SEED_SPOTS } from "../data/spots.js";
import { SAMPLE_CONDITIONS } from "../data/sampleConditions.js";

// Menambahkan pantai yang belum ada (dicocokkan lewat nama) dan melengkapi koordinat
// pantai lama yang belum punya. Data yang sudah diubah petugas tidak ditimpa.
export function seedSpots(db) {
  const find = db.prepare("SELECT id, latitude FROM beach_spots WHERE nama_pantai = ?");
  const insert = db.prepare(
    `INSERT INTO beach_spots
       (nama_pantai, kabupaten, kedalaman_avg, is_ramah_anak, ada_pelampung, current_status, latitude, longitude)
     VALUES ($nama_pantai, $kabupaten, $kedalaman_avg, $is_ramah_anak, $ada_pelampung, $current_status, $latitude, $longitude)`
  );
  const fillCoords = db.prepare("UPDATE beach_spots SET latitude = ?, longitude = ? WHERE id = ?");

  db.transaction(() => {
    for (const spot of SEED_SPOTS) {
      const existing = find.get(spot.nama_pantai);
      if (!existing) {
        insert.run(Object.fromEntries(Object.entries(spot).map(([k, v]) => [`$${k}`, v])));
      } else if (existing.latitude === null) {
        fillCoords.run(spot.latitude, spot.longitude, existing.id);
      }
    }
  })();
}

// Hanya dibuat bila belum ada log sama sekali. Mengembalikan jumlah log yang dibuat.
export function seedSampleConditions(db) {
  if (db.query("SELECT COUNT(*) AS n FROM daily_conditions").get().n > 0) return 0;
  const spots = db.query("SELECT id, current_status FROM beach_spots").all();
  const insert = db.prepare(
    "INSERT INTO daily_conditions (spot_id, kondisi_eceng_gondok, tinggi_ombak, catatan_petugas) VALUES (?, ?, ?, ?)"
  );
  db.transaction(() => {
    for (const s of spots) insert.run(s.id, ...(SAMPLE_CONDITIONS[s.current_status] ?? SAMPLE_CONDITIONS.AMAN));
  })();
  return spots.length;
}
