import { HttpError } from "../errors/HttpError.js";
import { getUserByToken } from "../services/authService.js";

export const bearerToken = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
};

// Middleware: hanya petugas yang sudah login. Menaruh user di req.user.
export const createRequireAuth = (db, secret) => (req, _res, next) => {
  const user = getUserByToken(db, bearerToken(req), secret);
  if (!user) return next(new HttpError(401, "Silakan login sebagai petugas"));
  req.user = user;
  next();
};
