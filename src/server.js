import { loadConfig } from "./config/index.js";
import { createDb } from "./database/connection.js";
import { bootstrap } from "./bootstrap.js";
import { createApp } from "./app.js";

const config = loadConfig();
const db = await bootstrap(createDb());

createApp(db).listen(config.port, () => {
  console.log(`TobaWaterSafe API berjalan di http://localhost:${config.port}`);
  if (!process.env.PETUGAS_CODE) {
    console.warn(
      config.petugasCode
        ? "PERINGATAN: PETUGAS_CODE belum diatur, memakai kode bawaan pengembangan. Ganti lewat file .env."
        : "PERINGATAN: PETUGAS_CODE belum diatur, registrasi petugas ditutup."
    );
  }
});
