// Error yang membawa kode status HTTP; ditangkap oleh middleware errorHandler.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
