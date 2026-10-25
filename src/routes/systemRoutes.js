import { Router } from "express";

export function systemRoutes() {
  const router = Router();
  router.get("/", (_req, res) =>
    res.json({ name: "TobaWaterSafe API", status: "ok", docs: "/api/spots", health: "/api/health" })
  );
  router.get("/api/health", (_req, res) => res.json({ ok: true }));
  return router;
}
