import { describe, test, expect, beforeEach } from "bun:test";
import { createDb } from "../src/database/connection.js";
import { AuthError } from "../src/errors/AuthError.js";
import {
  registerUser, verifyLogin, createSession, getUserByToken, isPetugasCodeValid,
} from "../src/services/authService.js";

let db;
beforeEach(() => { db = createDb(":memory:"); });

const SECRET = "rahasia-uji";
const valid = { username: "Petugas1", nama: "Budi Sitorus", password: "rahasia123" };

describe("registerUser", () => {
  test("berhasil, username dinormalkan, password disimpan sebagai hash", async () => {
    const u = await registerUser(db, valid);
    expect(u.username).toBe("petugas1");
    expect(u.password_hash).toBeUndefined();
    const row = db.query("SELECT password_hash FROM users WHERE id=?").get(u.id);
    expect(row.password_hash).not.toContain("rahasia123");
  });
  test("username ganda ditolak (409), tanpa peduli huruf besar/kecil", async () => {
    await registerUser(db, valid);
    const err = await registerUser(db, { ...valid, username: "PETUGAS1" }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.status).toBe(409);
  });
  test("input tidak valid ditolak", async () => {
    for (const bad of [
      { ...valid, username: "a" }, { ...valid, username: "ada spasi" },
      { ...valid, nama: "" }, { ...valid, password: "123" },
    ]) {
      expect(await registerUser(db, bad).catch((e) => e)).toBeInstanceOf(AuthError);
    }
  });
});

describe("login & sesi", () => {
  test("login benar/salah", async () => {
    await registerUser(db, valid);
    expect((await verifyLogin(db, "petugas1", "rahasia123")).nama).toBe("Budi Sitorus");
    expect(await verifyLogin(db, "PETUGAS1", "rahasia123")).not.toBeNull();
    expect(await verifyLogin(db, "petugas1", "salah")).toBeNull();
    expect(await verifyLogin(db, "tidakada", "rahasia123")).toBeNull();
  });
  test("token valid -> user, token palsu/rusak -> null", async () => {
    const u = await registerUser(db, valid);
    const token = createSession(u, SECRET);
    expect(getUserByToken(db, token, SECRET).id).toBe(u.id);
    for (const bad of ["palsu", "a.b", "a.b.c", "", null, undefined, 123]) {
      expect(getUserByToken(db, bad, SECRET)).toBeNull();
    }
  });
  test("token dengan tanda tangan diubah atau kunci berbeda ditolak", async () => {
    const u = await registerUser(db, valid);
    const token = createSession(u, SECRET);
    expect(getUserByToken(db, token, "kunci-lain")).toBeNull();
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: u.username, exp: Date.now() + 1e12 })).toString("base64url");
    expect(getUserByToken(db, `${forged}.${signature}`, SECRET)).toBeNull();
    expect(getUserByToken(db, `${payload}.x${signature.slice(1)}`, SECRET)).toBeNull();
  });
  test("token sah di database mana pun yang memuat akun yang sama (antar instance)", async () => {
    const u = await registerUser(db, valid);
    const token = createSession(u, SECRET);
    const instanceLain = createDb(":memory:");
    await registerUser(instanceLain, valid);
    expect(getUserByToken(instanceLain, token, SECRET).username).toBe("petugas1");
    expect(getUserByToken(createDb(":memory:"), token, SECRET)).toBeNull(); // akun tidak ada di instance itu
  });
  test("token kedaluwarsa ditolak", async () => {
    const u = await registerUser(db, valid);
    const token = createSession(u, SECRET, 1, Date.now() - 2 * 3_600_000);
    expect(getUserByToken(db, token, SECRET)).toBeNull();
  });
});

describe("isPetugasCodeValid", () => {
  test("cocok hanya bila kode sama persis", () => {
    expect(isPetugasCodeValid("KODE", "KODE")).toBe(true);
    expect(isPetugasCodeValid("kode", "KODE")).toBe(false);
    expect(isPetugasCodeValid("", "KODE")).toBe(false);
  });
  test("tanpa kode yang diharapkan, registrasi selalu ditolak", () => {
    expect(isPetugasCodeValid("apa saja", null)).toBe(false);
  });
});
