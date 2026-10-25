import { HttpError } from "../errors/HttpError.js";

// Rute tidak dikenal dijawab dalam format JSON (bukan halaman HTML).
export const notFound = (_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan" });

// Satu-satunya tempat error diubah menjadi respons HTTP.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Body JSON tidak valid" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Body permintaan terlalu besar" });
  console.error(err);
  return res.status(500).json({ error: "Terjadi kesalahan pada server" });
}
