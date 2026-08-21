import { randomUUID } from "node:crypto";
import { logger } from "./logger";

/**
 * Image hosting on Supabase Storage.
 *
 * Images used to be stored as `data:` URIs inside Postgres rows, which works
 * for a demo but bloats the database and ships megabytes of base64 down every
 * feed request. This uploads the bytes once and stores only a URL.
 *
 * Falls back to the caller keeping the data URI when storage is not
 * configured, so the app keeps working before the keys are added.
 */

const BUCKET = process.env["SUPABASE_BUCKET"] ?? "media";
// 4 MB after client-side compression is generous for a photo.
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isStorageConfigured(): boolean {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_KEY"]);
}

export class UploadError extends Error {}

/** Split a `data:` URI into its media type and raw bytes. */
export function parseDataUri(dataUri: string): { contentType: string; bytes: Buffer } {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUri);
  if (!match) throw new UploadError("صيغة الصورة غير صالحة");
  const contentType = match[1].toLowerCase();
  if (!ALLOWED[contentType]) throw new UploadError("نوع الصورة غير مدعوم");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) throw new UploadError("الصورة فارغة");
  if (bytes.length > MAX_BYTES) throw new UploadError("حجم الصورة كبير جداً");
  return { contentType, bytes };
}

/**
 * Upload bytes and return their public URL.
 *
 * The path is namespaced by user so a moderator can find or purge everything
 * one account uploaded, and randomised so filenames cannot be guessed or
 * overwritten by another request.
 */
export async function uploadImage(
  userId: string,
  dataUri: string,
): Promise<string> {
  const base = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_KEY"];
  if (!base || !key) throw new UploadError("خدمة الصور غير مهيأة");

  const { contentType, bytes } = parseDataUri(dataUri);
  const ext = ALLOWED[contentType];
  const path = `${userId}/${randomUUID()}.${ext}`;
  const endpoint = `${base.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${path}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "false",
      "cache-control": "public, max-age=31536000, immutable",
    },
    body: new Uint8Array(bytes),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error({ status: res.status, detail: detail.slice(0, 200) }, "Image upload failed");
    throw new UploadError("تعذّر رفع الصورة");
  }

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}
