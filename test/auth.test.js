import { describe, test, expect, beforeEach } from "bun:test";
import { createDb } from "../src/db.js";
import {
  AuthError, registerUser, verifyLogin, createSession, getUserByToken, deleteSession,
} from "../src/auth.js";

let db;
beforeEach(() => { db = createDb(":memory:"); });

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
  test("token valid -> user, token palsu -> null, logout menghapus sesi", async () => {
    const u = await registerUser(db, valid);
    const token = createSession(db, u.id);
    expect(getUserByToken(db, token).id).toBe(u.id);
    expect(getUserByToken(db, "palsu")).toBeNull();
    expect(getUserByToken(db, null)).toBeNull();
    deleteSession(db, token);
    expect(getUserByToken(db, token)).toBeNull();
  });
  test("token tidak disimpan mentah di database", async () => {
    const u = await registerUser(db, valid);
    const token = createSession(db, u.id);
    expect(db.query("SELECT token_hash FROM sessions").get().token_hash).not.toBe(token);
  });
  test("sesi kedaluwarsa ditolak", async () => {
    const u = await registerUser(db, valid);
    const token = createSession(db, u.id);
    db.run("UPDATE sessions SET expires_at = datetime('now','-1 minute')");
    expect(getUserByToken(db, token)).toBeNull();
  });
});
