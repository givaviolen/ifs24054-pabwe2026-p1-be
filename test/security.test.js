import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createDb } from "../src/database/connection.js";
import { createApp } from "../src/app.js";
import { loadConfig, resolveSessionSecret } from "../src/config/index.js";
import { createRateLimiter } from "../src/middleware/rateLimit.js";
import { bootstrap } from "../src/bootstrap.js";

describe("loadConfig", () => {
  test("di produksi tanpa PETUGAS_CODE registrasi ditutup; saat dev memakai kode bawaan", () => {
    expect(loadConfig({ VERCEL: "1" }).petugasCode).toBeNull();
    expect(loadConfig({ NODE_ENV: "production", PETUGAS_CODE: "RAHASIA" }).petugasCode).toBe("RAHASIA");
    expect(loadConfig({}).petugasCode).toBeTruthy();
  });
  test("CORS_ORIGIN dipecah dan garis miring akhir dibuang", () => {
    expect(loadConfig({ CORS_ORIGIN: "https://a.app/, https://b.app" }).corsOrigins)
      .toEqual(["https://a.app", "https://b.app"]);
  });
});

describe("resolveSessionSecret", () => {
  test("SESSION_SECRET diutamakan; tanpa itu diturunkan dari env yang stabil antar instance", () => {
    expect(resolveSessionSecret({ SESSION_SECRET: "abc" })).toBe("abc");
    const env = { PETUGAS_CODE: "K", PETUGAS_PASSWORD: "P" };
    expect(resolveSessionSecret(env)).toBe(resolveSessionSecret({ ...env }));
    expect(resolveSessionSecret(env)).not.toBe(resolveSessionSecret({ PETUGAS_CODE: "K2", PETUGAS_PASSWORD: "P" }));
  });
  test("tanpa env apa pun: kunci acak berbeda tiap pemanggilan", () => {
    expect(resolveSessionSecret({})).not.toBe(resolveSessionSecret({}));
  });
});

describe("createRateLimiter", () => {
  test("memblokir setelah melewati batas dan pulih setelah jendela waktu berlalu", () => {
    let t = 0;
    const limit = createRateLimiter({ windowMs: 1000, max: 2, now: () => t });
    const hit = () => { let err; limit({ ip: "1.1.1.1" }, { set() {} }, (e) => { err = e; }); return err; };
    expect(hit()).toBeUndefined();
    expect(hit()).toBeUndefined();
    expect(hit().status).toBe(429);
    t = 1500;
    expect(hit()).toBeUndefined();
  });
});

describe("keamanan HTTP", () => {
  let server, base;
  beforeAll(() => {
    server = createApp(createDb(":memory:"), { petugasCode: null, authRateLimit: { max: 3 } }).listen(0);
    base = `http://localhost:${server.address().port}`;
  });
  afterAll(() => server.close());

  const post = (path, body) =>
    fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  test("header keamanan terpasang dan x-powered-by dimatikan", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
  test("registrasi ditutup bila kode petugas tidak dikonfigurasi", async () => {
    const res = await post("/api/auth/register", { username: "abc", nama: "Abc", password: "123456", kode_petugas: "apa saja" });
    expect(res.status).toBe(403);
  });
  test("JSON rusak -> 400 dan body terlalu besar -> 413, tetap berformat JSON", async () => {
    const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{rusak" });
    expect(bad.status).toBe(400);
    const big = await post("/api/auth/login", { username: "x".repeat(200_000) });
    expect(big.status).toBe(413);
  });
  test("login berulang dibatasi (429)", async () => {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await post("/api/auth/login", { username: "x", password: "y" })).status);
    expect(statuses).toContain(429);
  });
});

describe("login antar instance serverless", () => {
  test("token dari instance A diterima instance B (database terpisah, kunci sama)", async () => {
    const env = { PETUGAS_USERNAME: "petugas.uji", PETUGAS_PASSWORD: "rahasia123" };
    const options = { sessionSecret: "kunci-bersama", petugasCode: null };
    const [a, b] = await Promise.all([0, 1].map(async () => {
      const db = await bootstrap(createDb(":memory:"), env); // tiap instance membuat akunnya sendiri
      return createApp(db, options).listen(0);
    }));
    try {
      const base = (srv) => `http://localhost:${srv.address().port}`;
      const login = await fetch(`${base(a)}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "petugas.uji", password: "rahasia123" }),
      });
      const { token } = await login.json();
      const me = await fetch(`${base(b)}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      expect(me.status).toBe(200);
      expect((await me.json()).user.username).toBe("petugas.uji");
    } finally {
      a.close(); b.close();
    }
  });
});
