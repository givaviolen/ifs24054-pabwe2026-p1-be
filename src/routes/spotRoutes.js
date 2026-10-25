import { Router } from "express";
import { HttpError } from "../errors/HttpError.js";
import { LIMITS } from "../constants/index.js";
import { parseId } from "../validators/common.js";
import { parseSpotFilters, buildSpotPayload } from "../validators/spotValidator.js";
import * as spots from "../repositories/spotRepository.js";
import * as conditions from "../repositories/conditionRepository.js";

const notFound = () => new HttpError(404, "Pantai tidak ditemukan");

// Dipasang di /api/spots. GET publik; POST/PUT/DELETE khusus petugas.
export function spotRoutes(db, requireAuth) {
  const router = Router();

  router.get("/", (req, res) => {
    const rows = spots.findAll(db, parseSpotFilters(req.query));
    res.json({ count: rows.length, data: rows });
  });

  // Detail + riwayat log
  router.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    const spot = spots.findById(db, id);
    if (!spot) throw notFound();
    res.json({ data: { ...spot, history: conditions.findHistory(db, id, LIMITS.historyRows) } });
  });

  router.post("/", requireAuth, (req, res) => {
    const id = spots.insert(db, buildSpotPayload(req.body));
    res.status(201).json({ data: spots.findById(db, id) });
  });

  // Parsial: hanya field yang dikirim yang diubah.
  router.put("/:id", requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    const current = spots.findRawById(db, id);
    if (!current) throw notFound();
    spots.update(db, id, buildSpotPayload(req.body, current));
    res.json({ data: spots.findById(db, id) });
  });

  router.delete("/:id", requireAuth, (req, res) => {
    if (spots.remove(db, parseId(req.params.id)) === 0) throw notFound();
    res.json({ message: "Pantai berhasil dihapus" });
  });

  return router;
}


