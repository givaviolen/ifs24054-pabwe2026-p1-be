import { AuthError } from "../errors/AuthError.js";

const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

// Memeriksa dan menormalkan input registrasi petugas.
export function parseRegistration(input = {}) {
  const username = String(input.username ?? "").trim().toLowerCase();
  const nama = String(input.nama ?? "").trim();
  const password = String(input.password ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthError("Username 3-30 karakter: huruf, angka, titik, atau garis bawah");
  }
  if (nama.length < 2 || nama.length > 60) throw new AuthError("Nama harus 2-60 karakter");
  if (password.length < 6 || password.length > 100) throw new AuthError("Password harus 6-100 karakter");
  return { username, nama, password };
}
