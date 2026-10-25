import { VALID_STATUS, LIMITS } from "../constants/index.js";
import {
  badRequest, isProvided, cleanText, toFlag, parseOptionalNumber,
} from "./common.js";

const DEFAULT_SPOT = {
  nama_pantai: "", kabupaten: "", kedalaman_avg: null, is_ramah_anak: 0,
  ada_pelampung: 0, current_status: "AMAN", latitude: null, longitude: null,
};

// GET /api/spots?status=AMAN&kabupaten=Samosir&ada_pelampung=1&ramah_anak=1&q=parbaba
export function parseSpotFilters(query) {
  const filters = {};
  if (query.status) {
    const status = String(query.status).toUpperCase();
    if (!VALID_STATUS.includes(status)) {
      throw badRequest(`status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
    }
    filters.status = status;
  }
  if (query.kabupaten) filters.kabupaten = String(query.kabupaten);
  if (cleanText(query.q)) filters.q = cleanText(query.q).slice(0, LIMITS.namaPantai);
  if (query.ada_pelampung !== undefined) filters.adaPelampung = toFlag(query.ada_pelampung);
  if (query.ramah_anak !== undefined) filters.ramahAnak = toFlag(query.ramah_anak);
  return filters;
}

// Membangun data pantai yang siap disimpan.
// create: current = DEFAULT_SPOT; update: current = baris lama, field yang tidak dikirim dipertahankan.
export function buildSpotPayload(body = {}, current = DEFAULT_SPOT) {
  const pick = (key, clean = (v) => v) => (isProvided(body, key) ? clean(body[key]) : current[key]);

  const nama_pantai = pick("nama_pantai", cleanText);
  const kabupaten = pick("kabupaten", cleanText);
  if (!nama_pantai || !kabupaten) throw badRequest("nama_pantai dan kabupaten wajib diisi");
  if (nama_pantai.length > LIMITS.namaPantai) throw badRequest(`nama_pantai maksimal ${LIMITS.namaPantai} karakter`);
  if (kabupaten.length > LIMITS.kabupaten) throw badRequest(`kabupaten maksimal ${LIMITS.kabupaten} karakter`);

  // Status kosong/tidak dikirim = pertahankan nilai saat ini (AMAN untuk pantai baru).
  const current_status = body.current_status ? String(body.current_status).toUpperCase() : current.current_status;
  if (!VALID_STATUS.includes(current_status)) throw badRequest("current_status tidak valid");

  return {
    nama_pantai,
    kabupaten,
    current_status,
    kedalaman_avg: parseOptionalNumber(body.kedalaman_avg, current.kedalaman_avg, {
      min: 0, max: LIMITS.maxDepthMeters, message: "kedalaman_avg harus berupa angka",
    }),
    is_ramah_anak: pick("is_ramah_anak", toFlag),
    ada_pelampung: pick("ada_pelampung", toFlag),
    latitude: parseOptionalNumber(body.latitude, current.latitude, { min: -90, max: 90, message: "latitude tidak valid" }),
    longitude: parseOptionalNumber(body.longitude, current.longitude, { min: -180, max: 180, message: "longitude tidak valid" }),
  };
}
