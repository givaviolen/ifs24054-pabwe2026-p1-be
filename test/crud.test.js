import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createDb, seedSpots } from "../src/db.js";
import { createApp, deriveStatus } from "../src/app.js";

const CODE = "KODE-UJI";
let server, base, token;

const call = (method, path, body, tok) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

beforeAll(async () => {
  const db = createDb(":memory:");
  seedSpots(db);
  server = createApp(db, { petugasCode: CODE }).listen(0);
  base = `http://localhost:${server.address().port}`;
});
afterAll(() => server.close());

test("deriveStatus", () => {
  expect(deriveStatus("Bersih", "Tenang")).toBe("AMAN");
  expect(deriveStatus("Sedang", "Tenang")).toBe("WASPADA");
  expect(deriveStatus("Bersih", "Tinggi")).toBe("BAHAYA");
});

describe("autentikasi petugas", () => {
  const akun = { username: "petugas1", nama: "Budi", password: "rahasia123" };

  test("register dengan kode salah -> 403", async () => {
    expect((await call("POST", "/api/auth/register", { ...akun, kode_petugas: "salah" })).status).toBe(403);
  });
  test("register berhasil mengembalikan token", async () => {
    const res = await call("POST", "/api/auth/register", { ...akun, kode_petugas: CODE });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token.length).toBeGreaterThan(20);
    expect(body.user.password_hash).toBeUndefined();
  });
  test("register username ganda -> 409", async () => {
    expect((await call("POST", "/api/auth/register", { ...akun, kode_petugas: CODE })).status).toBe(409);
  });
  test("login salah -> 401, login benar -> token", async () => {
    expect((await call("POST", "/api/auth/login", { username: "petugas1", password: "x" })).status).toBe(401);
    const res = await call("POST", "/api/auth/login", { username: "petugas1", password: "rahasia123" });
    expect(res.status).toBe(200);
    token = (await res.json()).token;
  });
  test("/me butuh token", async () => {
    expect((await call("GET", "/api/auth/me")).status).toBe(401);
    const res = await call("GET", "/api/auth/me", null, token);
    expect((await res.json()).user.nama).toBe("Budi");
  });
});

describe("wisatawan (tanpa login) tidak boleh mengubah data", () => {
  test("POST/PUT/DELETE spots dan POST conditions -> 401", async () => {
    expect((await call("POST", "/api/spots", { nama_pantai: "X", kabupaten: "Y" })).status).toBe(401);
    expect((await call("PUT", "/api/spots/1", { current_status: "BAHAYA" })).status).toBe(401);
    expect((await call("DELETE", "/api/spots/1")).status).toBe(401);
    expect((await call("POST", "/api/conditions", { spot_id: 1, kondisi_eceng_gondok: "Bersih", tinggi_ombak: "Tenang" })).status).toBe(401);
  });
  test("token palsu -> 401", async () => {
    expect((await call("DELETE", "/api/spots/1", null, "palsu")).status).toBe(401);
  });
});

describe("CRUD /api/spots (petugas login)", () => {
  let id;
  test("POST membuat pantai beserta koordinat", async () => {
    const res = await call("POST", "/api/spots", { nama_pantai: "Pantai Uji", kabupaten: "Toba", kedalaman_avg: 1.1, is_ramah_anak: 1, latitude: 2.5, longitude: 98.9 }, token);
    expect(res.status).toBe(201);
    const body = await res.json();
    id = body.data.id;
    expect(body.data.latitude).toBe(2.5);
  });
  test("koordinat di luar rentang -> 400", async () => {
    expect((await call("POST", "/api/spots", { nama_pantai: "A", kabupaten: "B", latitude: 200 }, token)).status).toBe(400);
  });
  test("POST tanpa nama -> 400", async () => {
    expect((await call("POST", "/api/spots", { kabupaten: "Toba" }, token)).status).toBe(400);
  });
  test("GET detail (publik) menyertakan history", async () => {
    const body = await (await fetch(`${base}/api/spots/${id}`)).json();
    expect(body.data.nama_pantai).toBe("Pantai Uji");
    expect(Array.isArray(body.data.history)).toBe(true);
  });
  test("PUT mengubah status tanpa menghapus koordinat", async () => {
    const body = await (await call("PUT", `/api/spots/${id}`, { current_status: "BAHAYA" }, token)).json();
    expect(body.data.current_status).toBe("BAHAYA");
    expect(body.data.latitude).toBe(2.5);
  });
  test("POST /api/conditions memperbarui status pantai", async () => {
    const res = await call("POST", "/api/conditions", { spot_id: id, kondisi_eceng_gondok: "Bersih", tinggi_ombak: "Tenang", catatan_petugas: "Aman" }, token);
    expect(res.status).toBe(201);
    const detail = await (await fetch(`${base}/api/spots/${id}`)).json();
    expect(detail.data.current_status).toBe("AMAN");
    expect(detail.data.history.length).toBe(1);
  });
  test("conditions input tidak valid -> 400, pantai tak ada -> 404", async () => {
    expect((await call("POST", "/api/conditions", { spot_id: id, kondisi_eceng_gondok: "X", tinggi_ombak: "Tenang" }, token)).status).toBe(400);
    expect((await call("POST", "/api/conditions", { spot_id: 9999, kondisi_eceng_gondok: "Bersih", tinggi_ombak: "Tenang" }, token)).status).toBe(404);
  });
  test("DELETE menghapus pantai beserta log", async () => {
    expect((await call("DELETE", `/api/spots/${id}`, null, token)).status).toBe(200);
    expect((await fetch(`${base}/api/spots/${id}`)).status).toBe(404);
    expect((await call("DELETE", `/api/spots/${id}`, null, token)).status).toBe(404);
  });
  test("logout membuat token tidak berlaku", async () => {
    await call("POST", "/api/auth/logout", null, token);
    expect((await call("GET", "/api/auth/me", null, token)).status).toBe(401);
  });
});
