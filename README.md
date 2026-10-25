# TobaWaterSafe — Back-End (`ifs24054-pabwe2026-proyek1-be`)

REST API **Express.js + SQLite (`bun:sqlite`)** untuk sistem pemantauan status kelayakan zona berenang
dan kondisi pesisir Danau Toba. Runtime & package manager: **Bun**. CI: **Jenkins**. Deploy: **Vercel**.

Front-End (Vue 3 + Vite) ada di repo terpisah: `ifs24054-pabwe2026-proyek1-fe`.

## Struktur

Kode dipisah per lapisan: **route** hanya mengurus HTTP, **validator** memeriksa input, **service**
berisi aturan bisnis, **repository** berisi SQL. Lapisan atas boleh memanggil lapisan bawah, tidak sebaliknya.

```
ifs24054-pabwe2026-p1-be/
├── api/index.js                  # entry Vercel (mengekspor aplikasi Express)
├── src/
│   ├── server.js                 # server lokal (bun src/server.js)
│   ├── app.js                    # merakit middleware + rute (tanpa logika bisnis)
│   ├── bootstrap.js              # seed data + akun petugas dari env
│   ├── config/                   # pembacaan environment variable (satu pintu)
│   ├── constants/                # status, level kondisi, batas panjang input
│   ├── routes/                   # auth / spots / conditions / system
│   ├── validators/               # validasi & normalisasi input (spot, kondisi, auth)
│   ├── services/                 # authService, statusService (aturan bisnis)
│   ├── repositories/             # SQL: spot, condition, user
│   ├── middleware/               # requireAuth, rateLimit, securityHeaders, errorHandler
│   ├── errors/                   # HttpError, AuthError
│   ├── database/                 # connection, schema + migrasi, seed
│   └── data/                     # data awal pantai & contoh laporan
├── test/                         # bun test (SQLite :memory:)
├── Jenkinsfile
├── vercel.json
├── .env.example
└── package.json
```

## Keamanan & penanganan error

- Password di-hash argon2id (`Bun.password`). Token login bertanda tangan HMAC-SHA256 (stateless, berlaku 24 jam),
  sehingga tetap sah walau permintaan dilayani instance serverless lain. Kuncinya: `SESSION_SECRET`.
- Kode registrasi dibandingkan dengan waktu-konstan. **Di produksi `PETUGAS_CODE` wajib diisi**;
  tanpa itu registrasi petugas ditutup (kode bawaan hanya berlaku saat pengembangan lokal).
- Login/registrasi dibatasi 30 percobaan per 15 menit per IP (memori per instance).
- Semua input divalidasi (tipe, rentang, panjang); body JSON dibatasi 100 KB.
- Header keamanan dasar (`nosniff`, `X-Frame-Options`, dst.); `x-powered-by` dimatikan.
- Semua error melewati satu `errorHandler` dan selalu dijawab JSON.

## Menjalankan lokal

```bash
bun install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
bun run dev               # http://localhost:3000
bun test
```

Database `tobawatersafe.sqlite` dibuat otomatis berisi 17 pantai + satu laporan awal per pantai.

## Endpoint

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/health` | publik | Cek server hidup |
| GET | `/api/spots` | publik | Daftar pantai + kondisi terbaru. Filter: `status`, `kabupaten`, `ada_pelampung`, `ramah_anak`, `q` (cari nama/kabupaten) |
| GET | `/api/spots/:id` | publik | Detail + riwayat log |
| POST | `/api/spots` | petugas | Tambah pantai |
| PUT | `/api/spots/:id` | petugas | Ubah pantai (parsial) |
| DELETE | `/api/spots/:id` | petugas | Hapus pantai (log ikut terhapus) |
| POST | `/api/conditions` | petugas | Tambah log harian; status pantai diperbarui otomatis |
| POST | `/api/auth/register` | kode petugas | Buat akun petugas |
| POST | `/api/auth/login` | publik | Login → token |
| GET | `/api/auth/me` | petugas | Akun yang sedang login |
| POST | `/api/auth/logout` | publik | Klien membuang token (token tidak disimpan di server) |

Endpoint petugas memerlukan header `Authorization: Bearer <token>`.

## Deploy ke Vercel

1. Push repo ini ke GitHub, lalu **Add New → Project** di Vercel dan pilih repo.
2. `vercel.json` sudah mengatur runtime Bun (`"bunVersion": "1.x"`) dan mengarahkan semua rute ke `api/index.js`.
3. Di **Settings → Environment Variables** isi: `PETUGAS_CODE`, `PETUGAS_USERNAME`, `PETUGAS_PASSWORD`
   (opsional: `PETUGAS_NAMA`, `CORS_ORIGIN`). **`PETUGAS_CODE` wajib** agar halaman registrasi petugas berfungsi, dan **`SESSION_SECRET`** (teks acak panjang) agar login konsisten di semua instance. Lalu **Redeploy**.
4. Buka `https://<nama-project>.vercel.app/api/health` → harus menampilkan `{"ok":true}`.
5. Salin URL tersebut + `/api` ke `VITE_API_URL` di project Front-End.

> **Catatan penting:** di Vercel, file SQLite disimpan di `/tmp` (satu-satunya lokasi yang dapat ditulis).
> Data tambahan/ubahan petugas **bisa hilang** ketika instance serverless didaur ulang, lalu database kembali
> ke data contoh. Itu sebabnya akun petugas sebaiknya diisi lewat environment variable. Bila data harus
> permanen, jalankan API di layanan dengan disk persisten atau pindahkan ke database terkelola.

## Jenkins

Agent harus memiliki Bun (`curl -fsSL https://bun.sh/install | bash`). Pipeline: install → `bun test`.
