import { HttpError } from "./HttpError.js";

// Kegagalan autentikasi/registrasi (status default 400).
export class AuthError extends HttpError {
  constructor(message, status = 400) {
    super(status, message);
    this.name = "AuthError";
  }
}
