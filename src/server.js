import { createDb } from "./db.js";
import { bootstrap } from "./bootstrap.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

const db = await bootstrap(createDb());

createApp(db).listen(PORT, () => {
  console.log(`TobaWaterSafe API berjalan di http://localhost:${PORT}`);
  if (!process.env.PETUGAS_CODE) {
    console.warn("PERINGATAN: PETUGAS_CODE belum diatur, memakai kode bawaan 'TOBA2026'. Ganti lewat file .env.");
  }
});
