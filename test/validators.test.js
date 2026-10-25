import { describe, test, expect } from "bun:test";
import { parseSpotFilters, buildSpotPayload } from "../src/validators/spotValidator.js";
import { parseConditionInput } from "../src/validators/conditionValidator.js";
import { parseId } from "../src/validators/common.js";

const statusOf = (fn) => { try { fn(); return null; } catch (e) { return e.status; } };

describe("parseSpotFilters", () => {
  test("menormalkan status dan membaca flag", () => {
    expect(parseSpotFilters({ status: "aman", ada_pelampung: "1", ramah_anak: "0", q: "  toba " }))
      .toEqual({ status: "AMAN", adaPelampung: 1, ramahAnak: 0, q: "toba" });
  });
  test("status tidak dikenal -> 400", () => {
    expect(statusOf(() => parseSpotFilters({ status: "KUNING" }))).toBe(400);
  });
});

describe("buildSpotPayload", () => {
  test("pantai baru memakai nilai bawaan", () => {
    const p = buildSpotPayload({ nama_pantai: " Pantai X ", kabupaten: "Toba" });
    expect(p).toMatchObject({ nama_pantai: "Pantai X", current_status: "AMAN", latitude: null, is_ramah_anak: 0 });
  });
  test("update parsial mempertahankan field yang tidak dikirim", () => {
    const current = { nama_pantai: "A", kabupaten: "B", kedalaman_avg: 2, is_ramah_anak: 1, ada_pelampung: 0, current_status: "AMAN", latitude: 2.5, longitude: 98.9 };
    const p = buildSpotPayload({ current_status: "bahaya" }, current);
    expect(p).toMatchObject({ current_status: "BAHAYA", latitude: 2.5, longitude: 98.9, is_ramah_anak: 1 });
  });
  test("nama/kabupaten kosong, angka tidak valid, dan teks terlalu panjang -> 400", () => {
    expect(statusOf(() => buildSpotPayload({ kabupaten: "Toba" }))).toBe(400);
    expect(statusOf(() => buildSpotPayload({ nama_pantai: "A", kabupaten: "B", kedalaman_avg: "abc" }))).toBe(400);
    expect(statusOf(() => buildSpotPayload({ nama_pantai: "A", kabupaten: "B", kedalaman_avg: -1 }))).toBe(400);
    expect(statusOf(() => buildSpotPayload({ nama_pantai: "A", kabupaten: "B", longitude: 181 }))).toBe(400);
    expect(statusOf(() => buildSpotPayload({ nama_pantai: "x".repeat(101), kabupaten: "B" }))).toBe(400);
  });
  test("koordinat boleh dikosongkan dengan null", () => {
    const current = { nama_pantai: "A", kabupaten: "B", kedalaman_avg: null, is_ramah_anak: 0, ada_pelampung: 0, current_status: "AMAN", latitude: 2.5, longitude: 98.9 };
    expect(buildSpotPayload({ latitude: null }, current).latitude).toBeNull();
  });
});

describe("parseConditionInput", () => {
  const valid = { spot_id: 3, kondisi_eceng_gondok: "Sedang", tinggi_ombak: "Tenang" };
  test("input valid; status manual opsional; catatan kosong -> null", () => {
    expect(parseConditionInput(valid)).toMatchObject({ spotId: 3, manualStatus: null, catatan: null });
    expect(parseConditionInput({ ...valid, current_status: "bahaya", catatan_petugas: " ok " }))
      .toMatchObject({ manualStatus: "BAHAYA", catatan: "ok" });
  });
  test("nilai di luar daftar atau catatan terlalu panjang -> 400", () => {
    expect(statusOf(() => parseConditionInput({ ...valid, spot_id: "x" }))).toBe(400);
    expect(statusOf(() => parseConditionInput({ ...valid, tinggi_ombak: "Raksasa" }))).toBe(400);
    expect(statusOf(() => parseConditionInput({ ...valid, current_status: "UNGU" }))).toBe(400);
    expect(statusOf(() => parseConditionInput({ ...valid, catatan_petugas: "x".repeat(501) }))).toBe(400);
  });
});

test("parseId hanya menerima bilangan bulat", () => {
  expect(parseId("12")).toBe(12);
  expect(statusOf(() => parseId("abc"))).toBe(400);
  expect(statusOf(() => parseId("1.5"))).toBe(400);
});
