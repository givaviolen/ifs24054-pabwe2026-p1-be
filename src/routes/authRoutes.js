import { Router } from "express";
import { HttpError } from "../errors/HttpError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import {
  registerUser, verifyLogin, createSession, isPetugasCodeValid,
} from "../services/authService.js";

// Dipasang di /api/auth. Hanya mengurus HTTP; aturan bisnis ada di authService.
export function authRoutes(db, config, requireAuth) {
  const router = Router();
  const limitAttempts = createRateLimiter(config.authRateLimit);

  router.post("/register", limitAttempts, asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!config.petugasCode) throw new HttpError(403, "Registrasi petugas belum dibuka oleh pengelola");
    if (!isPetugasCodeValid(body.kode_petugas, config.petugasCode)) {
      throw new HttpError(403, "Kode registrasi petugas salah");
    }
    const user = await registerUser(db, body);
    res.status(201).json({ user, token: createSession(user, config.sessionSecret) });
  }));

  router.post("/login", limitAttempts, asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const user = await verifyLogin(db, username, password);
    if (!user) throw new HttpError(401, "Username atau password salah");
    res.json({ user, token: createSession(user, config.sessionSecret) });
  }));

  router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

  // Token tidak disimpan di server; klien membuangnya, dan token otomatis kedaluwarsa dalam 24 jam.
  router.post("/logout", (_req, res) => res.json({ message: "Berhasil keluar" }));

  return router;
}
