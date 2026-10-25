import { VALID_STATUS, ECENG_LEVELS, OMBAK_LEVELS, LIMITS } from "../constants/index.js";
import { badRequest, cleanText } from "./common.js";

// Memeriksa body POST /api/conditions. manualStatus = null bila petugas memilih status otomatis.
export function parseConditionInput(body = {}) {
  const spotId = Number(body.spot_id);
  if (!Number.isInteger(spotId)) throw badRequest("spot_id wajib diisi");
  if (!ECENG_LEVELS.includes(body.kondisi_eceng_gondok)) {
    throw badRequest(`kondisi_eceng_gondok harus: ${ECENG_LEVELS.join(", ")}`);
  }
  if (!OMBAK_LEVELS.includes(body.tinggi_ombak)) {
    throw badRequest(`tinggi_ombak harus: ${OMBAK_LEVELS.join(", ")}`);
  }

  let manualStatus = null;
  if (body.current_status) {
    manualStatus = String(body.current_status).toUpperCase();
    if (!VALID_STATUS.includes(manualStatus)) throw badRequest("current_status tidak valid");
  }

  const catatan = cleanText(body.catatan_petugas);
  if (catatan.length > LIMITS.catatan) throw badRequest(`catatan_petugas maksimal ${LIMITS.catatan} karakter`);

  return {
    spotId,
    eceng: body.kondisi_eceng_gondok,
    ombak: body.tinggi_ombak,
    catatan: catatan || null,
    manualStatus,
  };
}
