import express from "express";
import cors from "cors";
import { loadConfig } from "./config/index.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { createRequireAuth } from "./middleware/requireAuth.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { systemRoutes } from "./routes/systemRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { spotRoutes } from "./routes/spotRoutes.js";
import { conditionRoutes } from "./routes/conditionRoutes.js";

// Factory: menerima instance db agar mudah diuji (db in-memory saat testing).
// File ini hanya merakit middleware dan rute; logika ada di lapisan masing-masing.
export function createApp(db, options = {}) {
  const config = loadConfig(process.env, options);
  const requireAuth = createRequireAuth(db, config.sessionSecret);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // di belakang proxy Vercel: req.ip = IP klien asli

  app.use(securityHeaders);
  // CORS_ORIGIN (opsional): daftar origin front-end dipisah koma. Kosong = semua origin boleh membaca API.
  app.use(cors(config.corsOrigins.length ? { origin: config.corsOrigins } : undefined));
  app.use(express.json({ limit: "100kb" }));

  app.use(systemRoutes());
  app.use("/api/auth", authRoutes(db, config, requireAuth));
  app.use("/api/spots", spotRoutes(db, requireAuth));
  app.use("/api/conditions", conditionRoutes(db, requireAuth));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
