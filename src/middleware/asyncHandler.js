// Express 4 tidak menangkap penolakan Promise; pembungkus ini meneruskannya ke errorHandler.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
