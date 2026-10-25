import { Router } from "express";
import { HttpError } from "../errors/HttpError.js";
import { parseConditionInput } from "../validators/conditionValidator.js";
import { deriveStatus } from "../services/statusService.js";
import * as spots from "../repositories/spotRepository.js";
import * as conditions from "../repositories/conditionRepository.js";

// Dipasang di /api/conditions. Log harian petugas; status pantai ikut diperbarui.
export function conditionRoutes(db, requireAuth) {
  const router = Router();

  router.post("/", requireAuth, (req, res) => {
    const input = parseConditionInput(req.body);
    if (!spots.exists(db, input.spotId)) throw new HttpError(404, "Pantai tidak ditemukan");

    // Petugas dapat menimpa status otomatis, misalnya untuk penutupan darurat.
    const status = input.manualStatus ?? deriveStatus(input.eceng, input.ombak);
    const data = conditions.insertAndUpdateSpotStatus(db, { ...input, status });
    res.status(201).json({ data, current_status: status });
  });

  return router;
}
