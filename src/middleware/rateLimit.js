import { HttpError } from "../errors/HttpError.js";

const MAX_TRACKED_CLIENTS = 1000;

// Pembatas permintaan sederhana (jendela tetap, disimpan di memori per instance) untuk
// endpoint sensitif seperti login/registrasi agar tidak mudah ditebak berulang kali.
export function createRateLimiter({ windowMs, max, now = Date.now }) {
  const clients = new Map(); // ip -> { count, resetAt }

  const prune = (t) => {
    for (const [ip, entry] of clients) if (entry.resetAt <= t) clients.delete(ip);
  };

  return (req, res, next) => {
    const t = now();
    if (clients.size > MAX_TRACKED_CLIENTS) prune(t);

    const entry = clients.get(req.ip);
    if (!entry || entry.resetAt <= t) {
      clients.set(req.ip, { count: 1, resetAt: t + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - t) / 1000)));
      return next(new HttpError(429, "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."));
    }
    next();
  };
}
