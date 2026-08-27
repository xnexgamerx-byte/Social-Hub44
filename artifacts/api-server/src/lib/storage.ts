import { randomUUID } from "node:crypto";
import { logger } from "./logger";

/**
 * Media hosting on Supabase Storage.
 *
 * Files used to be stored as `data:` URIs inside Postgres rows, which works
 * for a demo but bloats the database and ships megabytes of base64 down every
 * feed request. This uploads the bytes once and stores only a URL.
 *
 * Two allowlists, because the two callers have different risk:
 *   - user content (post photos) stays still images only
 *   - store assets (frames, entrances, gifts) are published by an admin and
 *     need the animation formats the app can actually play
 */

const BUCKET = process.env["SUPABASE_BUCKET"] ?? "media";

/** 4 MB after client-side compression is generous for a photo. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Entrance effects and animated gifts routinely land between 1 and 5 MB. */
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

/** What a user may attach to their own content. */
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * What an admin may publish as a store asset. Every entry here is a format
 * `components/GiftMedia.tsx` can actually render — adding one the client
 * cannot play would produce items that silently show a fallback icon.
 *
 * Note SVGA and PAG are deliberately absent: the live-streaming apps this is
 * modelled on use them, but the app has no player for either, so an item in
 * that format would look broken rather than animated.
 */
const ASSET_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  // Lottie ships as JSON; both media types are seen in the wild.
  "application/json": "json",
  "text/plain": "json",
};

export function isStorageConfigured(): boolean {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_KEY"]);
}

export class UploadError extends Error {}

interface ParsedUpload {
  contentType: string;
  ext: string;
  bytes: Buffer;
}

/** Split a `data:` URI into its media type and raw bytes, against an allowlist. */
function parse(
  dataUri: string,
  allowed: Record<string, string>,
  maxBytes: number,
): ParsedUpload {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUri);
  if (!match) throw new UploadError("صيغة الملف غير صالحة");
  const contentType = match[1].toLowerCase();
  const ext = allowed[contentType];
  if (!ext) throw new UploadError(`نوع الملف غير مدعوم: ${contentType}`);
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) throw new UploadError("الملف فارغ");
  if (bytes.length > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    throw new UploadError(`حجم الملف كبير جداً — الحد ${mb} ميغابايت`);
  }
  return { contentType, ext, bytes };
}

/**
 * Validate a store-asset data URI without uploading it. Exported so the
 * allowlist and size cap can be tested without touching the network — the
 * upload path itself only runs against a configured bucket.
 */
export function parseStoreAsset(dataUri: string): { contentType: string; ext: string; bytes: Buffer } {
  return parse(dataUri, ASSET_TYPES, MAX_ASSET_BYTES);
}

/** Kept exported for the existing image tests. */
export function parseDataUri(dataUri: string): { contentType: string; bytes: Buffer } {
  const { contentType, bytes } = parse(dataUri, IMAGE_TYPES, MAX_IMAGE_BYTES);
  return { contentType, bytes };
}

async function put(prefix: string, parsed: ParsedUpload): Promise<string> {
  const base = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_KEY"];
  if (!base || !key) throw new UploadError("خدمة الملفات غير مهيأة");

  const root = base.replace(/\/$/, "");
  // Namespaced so a moderator can find or purge everything one source
  // uploaded, and randomised so filenames cannot be guessed or overwritten.
  const path = `${prefix}/${randomUUID()}.${parsed.ext}`;
  const endpoint = `${root}/storage/v1/object/${BUCKET}/${path}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      // Supabase accepts both the legacy service_role JWT and the newer
      // sb_secret_* keys, but only the `apikey` header works for both — a
      // bare Bearer is rejected as "Invalid Compact JWS" for the new format.
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": parsed.contentType,
      "x-upsert": "false",
      "cache-control": "public, max-age=31536000, immutable",
    },
    body: new Uint8Array(parsed.bytes),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error(
      { status: res.status, detail: detail.slice(0, 200), path },
      "Upload failed",
    );
    throw new UploadError("تعذّر رفع الملف");
  }

  return `${root}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Upload a user's own image (post photos). Still images only. */
export async function uploadImage(userId: string, dataUri: string): Promise<string> {
  return put(userId, parse(dataUri, IMAGE_TYPES, MAX_IMAGE_BYTES));
}

/**
 * Upload a store asset — an avatar frame, entrance effect, gift or background.
 * Admin-only at the route, which is why the format list is wider and the size
 * cap higher than user content gets.
 */
export async function uploadStoreAsset(
  adminUserId: string,
  dataUri: string,
): Promise<string> {
  return put(`store/${adminUserId}`, parse(dataUri, ASSET_TYPES, MAX_ASSET_BYTES));
}

/** Human-readable list for the admin UI and error messages. */
export const SUPPORTED_ASSET_FORMATS = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "MP4",
  "WebM",
  "Lottie (JSON)",
] as const;
