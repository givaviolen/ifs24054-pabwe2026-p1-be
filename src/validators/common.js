import { HttpError } from "../errors/HttpError.js";

export const badRequest = (message) => new HttpError(400, message);

export const isProvided = (obj, key) => obj[key] !== undefined;

// Teks dari input bebas: selalu string yang sudah di-trim.
export const cleanText = (value) => String(value ?? "").trim();

// Nilai boolean longgar (1, "1", true, "true") -> 1 atau 0 untuk kolom SQLite.
export const toFlag = (v) => (v === 1 || v === "1" || v === true || v === "true" ? 1 : 0);

export function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID tidak valid");
  return id;
}

// Angka opsional: undefined -> fallback, null/"" -> null, selain itu harus angka dalam rentang.
export function parseOptionalNumber(value, fallback, { min, max, message }) {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < min || n > max) throw badRequest(message);
  return n;
}
