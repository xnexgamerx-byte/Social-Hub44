import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../lib/logger";

/**
 * Shape of the body-parser and Express errors we translate rather than log as
 * server faults. These are the client's mistake, not ours.
 */
interface HttpishError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

function statusOf(err: HttpishError): number {
  const status = err.status ?? err.statusCode;
  return typeof status === "number" && status >= 400 && status < 600 ? status : 500;
}

/** A message safe to hand a client, in the same Arabic voice as the routes. */
function messageFor(err: HttpishError, status: number): string {
  // express.json() rejects an oversized body with this type. Without a
  // translation the client sees an HTML error page and reports "it just
  // failed", which is exactly how the old 100 KB limit stayed hidden.
  if (err.type === "entity.too.large") return "الملف كبير جداً";
  if (err.type === "entity.parse.failed") return "صيغة الطلب غير صالحة";
  if (status === 413) return "الملف كبير جداً";
  if (status === 400) return "طلب غير صالح";
  if (status === 401) return "يجب تسجيل الدخول";
  if (status === 403) return "غير مصرح لك بالوصول";
  if (status === 404) return "الصفحة غير موجودة";
  return "حدث خطأ غير متوقع، حاول مرة أخرى";
}

/** Unknown API paths answer in JSON, not Express's default HTML page. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "المسار غير موجود" });
};

/**
 * Last stop for anything a route threw.
 *
 * Express's default handler renders the stack trace into the response, which
 * both leaks internals and hands the app HTML where it expects
 * `{ error: string }` — so every unexpected failure showed the client a
 * generic fallback while the real cause went unrecorded.
 *
 * Server faults are logged with the stack and answered with a generic
 * sentence; client mistakes are answered with the specific reason and logged
 * at a lower level, because they are not bugs.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const error = err as HttpishError;
  const status = statusOf(error);
  const context = { err: error, method: req.method, url: req.originalUrl?.split("?")[0] };

  if (status >= 500) {
    logger.error(context, "Unhandled request error");
  } else {
    logger.warn(context, "Rejected request");
  }

  // The stack never crosses the wire, whatever the environment.
  res.status(status).json({ error: messageFor(error, status) });
};
