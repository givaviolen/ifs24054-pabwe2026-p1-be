// Contoh laporan awal per status, agar halaman detail dan kartu pantai langsung berisi data
// (berguna untuk demo dan deployment serverless yang databasenya dibuat ulang).
// Format: [kondisi_eceng_gondok, tinggi_ombak, catatan_petugas]
export const SAMPLE_CONDITIONS = {
  AMAN: ["Bersih", "Tenang", "Air jernih dan ombak tenang. Aman untuk berenang (contoh laporan awal sistem)."],
  WASPADA: ["Sedang", "Sedang", "Ada sebaran eceng gondok tipis dan ombak sedang. Berenang dengan hati-hati (contoh laporan awal sistem)."],
  BAHAYA: ["Pekat", "Tinggi", "Eceng gondok pekat atau ombak tinggi. Berenang tidak disarankan (contoh laporan awal sistem)."],
};
