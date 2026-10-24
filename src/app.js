import express from "express";
import cors from "cors";
import {
  AuthError, registerUser, verifyLogin, createSession, getUserByToken, deleteSession,
} from "./auth.js";

const VALID_STATUS = ["AMAN", "WASPADA", "BAHAYA"];
const ECENG = ["Bersih", "Sedang", "Pekat"];
const OMBAK = ["Tenang", "Sedang", "Tinggi"];

const toFlag = (v) => (v === 1 || v === "1" || v === true || v === "true" ? 1 : 0);

// Membaca koordinat opsional. skip=true bila field tidak dikirim sama sekali.
function parseCoord(v, min, max, name) {
  if (v === undefined) return { skip: true };
  if (v === null || v === "") return { value: null };
  const n = Number(v);
  if (Number.isNaN(n) || n < min || n > max) return { error: `${name} tidak valid` };
  return { value: n };
}

// Status otomatis dari log harian: dipakai bila petugas tidak mengisi status manual.
export function deriveStatus(eceng, ombak) {
  if (eceng === "Pekat" || ombak === "Tinggi") return "BAHAYA";
  if (eceng === "Sedang" || ombak === "Sedang") return "WASPADA";
  return "AMAN";
}

const LATEST_JOIN = `
  LEFT JOIN daily_conditions c
    ON c.id = (
      SELECT id FROM daily_conditions
      WHERE spot_id = s.id
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    )`;

const SELECT_SPOT = `
  SELECT s.*,
         c.kondisi_eceng_gondok,
         c.tinggi_ombak,
         c.catatan_petugas,
         c.updated_at AS kondisi_updated_at
  FROM beach_spots s ${LATEST_JOIN}`;

// Factory: menerima instance db agar mudah diuji (db in-memory saat testing).
export function createApp(db, options = {}) {
  const petugasCode = options.petugasCode ?? process.env.PETUGAS_CODE ?? "TOBA2026";
  const app = express();
  // CORS_ORIGIN (opsional): daftar origin front-end dipisah koma. Kosong = semua origin boleh membaca API.
  const origins = (options.corsOrigin ?? process.env.CORS_ORIGIN ?? "")
    .split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  app.use(cors(origins.length ? { origin: origins } : undefined));
  app.use(express.json());

  app.get("/", (_req, res) =>
    res.json({ name: "TobaWaterSafe API", status: "ok", docs: "/api/spots", health: "/api/health" })
  );

  const bearer = (req) => {
    const h = req.headers.authorization || "";
    return h.startsWith("Bearer ") ? h.slice(7) : null;
  };

  // Middleware: hanya petugas yang sudah login.
  const requireAuth = (req, res, next) => {
    const user = getUserByToken(db, bearer(req));
    if (!user) return res.status(401).json({ error: "Silakan login sebagai petugas" });
    req.user = user;
    next();
  };

  const authError = (res, e) => {
    if (e instanceof AuthError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: "Terjadi kesalahan pada server" });
  };

  // ---------- AUTH (khusus petugas) ----------
  app.post("/api/auth/register", async (req, res) => {
    const b = req.body || {};
    if (!b.kode_petugas || b.kode_petugas !== petugasCode) {
      return res.status(403).json({ error: "Kode registrasi petugas salah" });
    }
    try {
      const user = await registerUser(db, b);
      res.status(201).json({ user, token: createSession(db, user.id) });
    } catch (e) { authError(res, e); }
  });

  app.post("/api/auth/login", async (req, res) => {
    const b = req.body || {};
    try {
      const user = await verifyLogin(db, b.username, b.password);
      if (!user) return res.status(401).json({ error: "Username atau password salah" });
      res.json({ user, token: createSession(db, user.id) });
    } catch (e) { authError(res, e); }
  });

  app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

  app.post("/api/auth/logout", (req, res) => {
    deleteSession(db, bearer(req));
    res.json({ message: "Berhasil keluar" });
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // GET /api/spots?status=AMAN&kabupaten=Samosir&ada_pelampung=1&ramah_anak=1&q=parbaba
  app.get("/api/spots", (req, res) => {
    const { status, kabupaten, ada_pelampung, ramah_anak, q } = req.query;
    const where = [];
    const params = [];

    if (status) {
      const s = String(status).toUpperCase();
      if (!VALID_STATUS.includes(s)) {
        return res
          .status(400)
          .json({ error: `status harus salah satu dari: ${VALID_STATUS.join(", ")}` });
      }
      where.push("s.current_status = ?");
      params.push(s);
    }
    if (kabupaten) {
      where.push("s.kabupaten = ? COLLATE NOCASE");
      params.push(String(kabupaten));
    }
    if (q && String(q).trim()) {
      // Pencarian bebas pada nama pantai atau kabupaten (karakter % dan _ di-escape).
      const like = `%${String(q).trim().replace(/[\\%_]/g, "\\$&")}%`;
      where.push("(s.nama_pantai LIKE ? ESCAPE '\\' OR s.kabupaten LIKE ? ESCAPE '\\')");
      params.push(like, like);
    }
    if (ada_pelampung !== undefined) {
      where.push("s.ada_pelampung = ?");
      params.push(toFlag(ada_pelampung));
    }
    if (ramah_anak !== undefined) {
      where.push("s.is_ramah_anak = ?");
      params.push(toFlag(ramah_anak));
    }

    const sql = `${SELECT_SPOT}
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY s.nama_pantai ASC`;

    try {
      const rows = db.query(sql).all(...params);
      res.json({ count: rows.length, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
  });

  // GET /api/spots/:id  -> detail + riwayat log
  app.get("/api/spots/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid" });
    const spot = db.query(`${SELECT_SPOT} WHERE s.id = ?`).get(id);
    if (!spot) return res.status(404).json({ error: "Pantai tidak ditemukan" });
    const history = db
      .query(
        `SELECT id, kondisi_eceng_gondok, tinggi_ombak, catatan_petugas, updated_at
         FROM daily_conditions WHERE spot_id = ?
         ORDER BY updated_at DESC, id DESC LIMIT 20`
      )
      .all(id);
    res.json({ data: { ...spot, history } });
  });

  // POST /api/spots
  app.post("/api/spots", requireAuth, (req, res) => {
    const b = req.body || {};
    if (!b.nama_pantai || !b.kabupaten) {
      return res.status(400).json({ error: "nama_pantai dan kabupaten wajib diisi" });
    }
    const status = String(b.current_status || "AMAN").toUpperCase();
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: "current_status tidak valid" });
    }
    const depth = b.kedalaman_avg === undefined || b.kedalaman_avg === "" ? null : Number(b.kedalaman_avg);
    if (depth !== null && Number.isNaN(depth)) {
      return res.status(400).json({ error: "kedalaman_avg harus berupa angka" });
    }
    const lat = parseCoord(b.latitude, -90, 90, "latitude");
    const lng = parseCoord(b.longitude, -180, 180, "longitude");
    if (lat.error || lng.error) return res.status(400).json({ error: lat.error || lng.error });
    const info = db
      .query(
        `INSERT INTO beach_spots
           (nama_pantai, kabupaten, kedalaman_avg, is_ramah_anak, ada_pelampung, current_status, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(String(b.nama_pantai).trim(), String(b.kabupaten).trim(), depth,
           toFlag(b.is_ramah_anak), toFlag(b.ada_pelampung), status,
           lat.value ?? null, lng.value ?? null);
    const created = db.query(`${SELECT_SPOT} WHERE s.id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ data: created });
  });

  // PUT /api/spots/:id  (parsial: hanya field yang dikirim yang diubah)
  app.put("/api/spots/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid" });
    const existing = db.query("SELECT * FROM beach_spots WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Pantai tidak ditemukan" });

    const b = req.body || {};
    const status = b.current_status !== undefined
      ? String(b.current_status).toUpperCase()
      : existing.current_status;
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: "current_status tidak valid" });
    }
    const nama = b.nama_pantai !== undefined ? String(b.nama_pantai).trim() : existing.nama_pantai;
    const kab = b.kabupaten !== undefined ? String(b.kabupaten).trim() : existing.kabupaten;
    if (!nama || !kab) return res.status(400).json({ error: "nama_pantai dan kabupaten tidak boleh kosong" });
    const depth = b.kedalaman_avg !== undefined
      ? (b.kedalaman_avg === "" || b.kedalaman_avg === null ? null : Number(b.kedalaman_avg))
      : existing.kedalaman_avg;
    if (depth !== null && Number.isNaN(depth)) {
      return res.status(400).json({ error: "kedalaman_avg harus berupa angka" });
    }

    const lat = parseCoord(b.latitude, -90, 90, "latitude");
    const lng = parseCoord(b.longitude, -180, 180, "longitude");
    if (lat.error || lng.error) return res.status(400).json({ error: lat.error || lng.error });

    db.query(
      `UPDATE beach_spots SET nama_pantai=?, kabupaten=?, kedalaman_avg=?,
         is_ramah_anak=?, ada_pelampung=?, current_status=?, latitude=?, longitude=? WHERE id=?`
    ).run(
      nama, kab, depth,
      b.is_ramah_anak !== undefined ? toFlag(b.is_ramah_anak) : existing.is_ramah_anak,
      b.ada_pelampung !== undefined ? toFlag(b.ada_pelampung) : existing.ada_pelampung,
      status,
      lat.skip ? existing.latitude : lat.value,
      lng.skip ? existing.longitude : lng.value,
      id
    );
    res.json({ data: db.query(`${SELECT_SPOT} WHERE s.id = ?`).get(id) });
  });

  // DELETE /api/spots/:id
  app.delete("/api/spots/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid" });
    const info = db.query("DELETE FROM beach_spots WHERE id = ?").run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Pantai tidak ditemukan" });
    res.json({ message: "Pantai berhasil dihapus" });
  });

  // POST /api/conditions  -> log harian; status pantai ikut diperbarui
  app.post("/api/conditions", requireAuth, (req, res) => {
    const b = req.body || {};
    const spotId = Number(b.spot_id);
    if (!Number.isInteger(spotId)) return res.status(400).json({ error: "spot_id wajib diisi" });
    if (!ECENG.includes(b.kondisi_eceng_gondok)) {
      return res.status(400).json({ error: `kondisi_eceng_gondok harus: ${ECENG.join(", ")}` });
    }
    if (!OMBAK.includes(b.tinggi_ombak)) {
      return res.status(400).json({ error: `tinggi_ombak harus: ${OMBAK.join(", ")}` });
    }
    if (!db.query("SELECT id FROM beach_spots WHERE id = ?").get(spotId)) {
      return res.status(404).json({ error: "Pantai tidak ditemukan" });
    }
    let status = deriveStatus(b.kondisi_eceng_gondok, b.tinggi_ombak);
    if (b.current_status) {
      const manual = String(b.current_status).toUpperCase();
      if (!VALID_STATUS.includes(manual)) {
        return res.status(400).json({ error: "current_status tidak valid" });
      }
      status = manual; // petugas dapat menimpa, misal penutupan darurat
    }

    const info = db.transaction(() => {
      const r = db
        .query(
          `INSERT INTO daily_conditions (spot_id, kondisi_eceng_gondok, tinggi_ombak, catatan_petugas)
           VALUES (?, ?, ?, ?)`
        )
        .run(spotId, b.kondisi_eceng_gondok, b.tinggi_ombak, b.catatan_petugas || null);
      db.query("UPDATE beach_spots SET current_status = ? WHERE id = ?").run(status, spotId);
      return r;
    })();

    const row = db.query("SELECT * FROM daily_conditions WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ data: row, current_status: status });
  });

  // Rute tidak dikenal dan body JSON rusak dijawab dalam format JSON (bukan halaman HTML).
  app.use((_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Body JSON tidak valid" });
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan pada server" });
  });

  return app;
}
