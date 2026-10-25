// Titik masuk Vercel: seluruh permintaan (lihat rewrites di vercel.json) diteruskan ke aplikasi Express.
import { createDb } from "../src/database/connection.js";
import { bootstrap } from "../src/bootstrap.js";
import { createApp } from "../src/app.js";

const db = await bootstrap(createDb());

export default createApp(db);
