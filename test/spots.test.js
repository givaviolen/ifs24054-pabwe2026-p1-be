import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createDb, seedSpots, SEED_SPOTS } from "../src/db.js";
import { createApp } from "../src/app.js";

let server, base, db;

beforeAll(() => {
  db = createDb(":memory:"); // tanpa file, tanpa server DB eksternal
  seedSpots(db);
  const spot = db.query("SELECT id FROM beach_spots WHERE nama_pantai = 'Pantai Lumban Silintong'").get();
  db.run(
    `INSERT INTO daily_conditions (spot_id, kondisi_eceng_gondok, tinggi_ombak, catatan_petugas)
     VALUES (?, 'Bersih', 'Tenang', 'Kondisi baik')`, [spot.id]
  );
  server = createApp(db).listen(0);
  base = `http://localhost:${server.address().port}`;
});

afterAll(() => server.close());

describe("GET /api/spots (publik, tanpa login)", () => {
  test("mengembalikan seluruh pantai beserta koordinat dan kondisi terbaru", async () => {
    const res = await fetch(`${base}/api/spots`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(SEED_SPOTS.length);
    const s = body.data.find((x) => x.nama_pantai === "Pantai Lumban Silintong");
    expect(s.kondisi_eceng_gondok).toBe("Bersih");
    expect(typeof s.latitude).toBe("number");
    expect(typeof s.longitude).toBe("number");
  });

  test("filter ?status=WASPADA", async () => {
    const body = await (await fetch(`${base}/api/spots?status=WASPADA`)).json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.data.every((s) => s.current_status === "WASPADA")).toBe(true);
  });

  test("filter ?kabupaten=samosir (tidak peka huruf besar/kecil)", async () => {
    const body = await (await fetch(`${base}/api/spots?kabupaten=samosir`)).json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.data.every((s) => s.kabupaten === "Samosir")).toBe(true);
  });

  test("status tidak valid menghasilkan 400", async () => {
    const res = await fetch(`${base}/api/spots?status=XYZ`);
    expect(res.status).toBe(400);
  });
});

describe("pencarian ?q= dan penanganan error", () => {
  test("?q= mencari pada nama pantai (tidak peka huruf besar/kecil)", async () => {
    const body = await (await fetch(`${base}/api/spots?q=parbaba`)).json();
    expect(body.count).toBe(1);
    expect(body.data[0].nama_pantai).toBe("Pantai Pasir Putih Parbaba");
  });

  test("?q= juga mencari pada kabupaten dan dapat digabung dengan filter lain", async () => {
    const body = await (await fetch(`${base}/api/spots?q=samosir&status=AMAN`)).json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.data.every((s) => s.kabupaten === "Samosir" && s.current_status === "AMAN")).toBe(true);
  });

  test("karakter wildcard % pada ?q= diperlakukan sebagai teks biasa", async () => {
    const body = await (await fetch(`${base}/api/spots?q=%25`)).json();
    expect(body.count).toBe(0);
  });

  test("rute tidak dikenal -> 404 berformat JSON", async () => {
    const res = await fetch(`${base}/api/tidak-ada`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeDefined();
  });

  test("GET / dan /api/health menjawab ok", async () => {
    expect((await (await fetch(`${base}/`)).json()).status).toBe("ok");
    expect((await (await fetch(`${base}/api/health`)).json()).ok).toBe(true);
  });
});
