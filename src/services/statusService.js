// Aturan bisnis status kelayakan berenang.
// Status otomatis dari log harian: dipakai bila petugas tidak mengisi status manual.
export function deriveStatus(eceng, ombak) {
  if (eceng === "Pekat" || ombak === "Tinggi") return "BAHAYA";
  if (eceng === "Sedang" || ombak === "Sedang") return "WASPADA";
  return "AMAN";
}
