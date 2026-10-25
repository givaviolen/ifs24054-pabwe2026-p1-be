import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { createDb, resolveDbPath } from "../src/database/connection.js";
import { migrate } from "../src/database/schema.js";
import { seedSpots, seedSampleConditions } from "../src/database/seed.js";
import { SEED_SPOTS } from "../src/data/spots.js";
import { VALID_STATUS } from "../src/constants/index.js";
import { seedPetugas } from "../src/bootstrap.js";

describe("data pantai", () => {
  test("nama unik, status valid, koordinat berada di sekitar Danau Toba", () => {
    const names = SEED_SPOTS.map((s) => s.nama_pantai);
    expect(new Set(names).size).toBe(names.length);
    expect(SEED_SPOTS.length).toBeGreaterThanOrEqual(15);
    for (const { current_status, latitude, longitude } of SEED_SPOTS) {
      expect(VALID_STATUS).toContain(current_status);
      expect(latitude).toBeGreaterThan(2.0); expect(latitude).toBeLessThan(3.1);
      expect(longitude).toBeGreaterThan(98.4); expect(longitude).toBeLessThan(99.2);
    }
  });

  test("seedSpots idempotent (dijalankan dua kali tidak menggandakan data)", () => {
    const db = createDb(":memory:");
    seedSpots(db); seedSpots(db);
    expect(db.query("SELECT COUNT(*) AS n FROM beach_spots").get().n).toBe(SEED_SPOTS.length);
  });

  test("tiga warna status semuanya ada pada data contoh", () => {
    const db = createDb(":memory:");
    seedSpots(db);
    const s = db.query("SELECT DISTINCT current_status AS s FROM beach_spots").all().map((r) => r.s);
    expect(s.sort()).toEqual(["AMAN", "BAHAYA", "WASPADA"]);
  });
});

describe("migrasi database lama", () => {
  test("menambah kolom koordinat, mempertahankan data, dan melengkapi koordinat", () => {
    const old = new Database(":memory:");
    old.exec(`CREATE TABLE beach_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nama_pantai TEXT NOT NULL, kabupaten TEXT NOT NULL,
      kedalaman_avg REAL, is_ramah_anak INTEGER, ada_pelampung INTEGER,
      current_status TEXT DEFAULT 'AMAN', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    old.run("INSERT INTO beach_spots (nama_pantai,kabupaten,current_status) VALUES ('Pantai Bebas Parapat','Simalungun','BAHAYA')");
    migrate(old);
    seedSpots(old);
    const row = old.query("SELECT * FROM beach_spots WHERE nama_pantai='Pantai Bebas Parapat'").get();
    expect(row.current_status).toBe("BAHAYA"); // status petugas tidak ditimpa
    expect(row.latitude).toBeGreaterThan(2);
    expect(old.query("SELECT COUNT(*) AS n FROM beach_spots").get().n).toBe(SEED_SPOTS.length);
  });
});

describe("bootstrap & deployment", () => {
  test("resolveDbPath: /tmp di Vercel, DB_PATH diutamakan", () => {
    expect(resolveDbPath({ VERCEL: "1" })).toBe("/tmp/tobawatersafe.sqlite");
    expect(resolveDbPath({ VERCEL: "1", DB_PATH: ":memory:" })).toBe(":memory:");
    expect(resolveDbPath({})).toBe("tobawatersafe.sqlite");
  });

  test("seedSampleConditions membuat satu log per pantai dan idempotent", () => {
    const db = createDb(":memory:");
    seedSpots(db);
    expect(seedSampleConditions(db)).toBe(SEED_SPOTS.length);
    expect(seedSampleConditions(db)).toBe(0);
    expect(db.query("SELECT COUNT(*) AS n FROM daily_conditions").get().n).toBe(SEED_SPOTS.length);
  });

  test("seedPetugas hanya membuat akun bila env lengkap, dan tidak menggandakan", async () => {
    const db = createDb(":memory:");
    expect(await seedPetugas(db, {})).toBeNull();
    const env = { PETUGAS_USERNAME: "Admin.Toba", PETUGAS_PASSWORD: "rahasia123" };
    expect((await seedPetugas(db, env)).username).toBe("admin.toba");
    expect(await seedPetugas(db, env)).toBeNull();
    expect(db.query("SELECT COUNT(*) AS n FROM users").get().n).toBe(1);
  });
});
