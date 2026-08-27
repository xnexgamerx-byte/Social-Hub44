import { describe, expect, it } from "vitest";
import {
  isStorageConfigured,
  parseDataUri,
  parseStoreAsset,
  uploadImage,
  UploadError,
} from "./storage";

// A 1x1 red PNG.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("image storage", () => {
  it("rejects a malformed or unsupported data URI", () => {
    expect(() => parseDataUri("not-a-uri")).toThrow(UploadError);
    expect(() => parseDataUri("data:image/gif;base64,AAAA")).toThrow(UploadError);
  });

  it("parses a supported image", () => {
    const { contentType, bytes } = parseDataUri(PNG);
    expect(contentType).toBe("image/png");
    expect(bytes.length).toBeGreaterThan(0);
  });

  it.runIf(isStorageConfigured())(
    "uploads to Supabase and returns a reachable public URL",
    async () => {
      const url = await uploadImage(`vitest_${Date.now()}`, PNG);
      expect(url).toContain("/storage/v1/object/public/");
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/png");
    },
    30_000,
  );
});

describe("store asset formats", () => {
  const uri = (type: string, payload = "AAAA") => `data:${type};base64,${payload}`;

  it("accepts every format the app can play", () => {
    // Each of these has a renderer in components/GiftMedia.tsx — a format the
    // server accepts but the client cannot play would publish an item that
    // silently falls back to an icon.
    for (const type of [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "application/json",
    ]) {
      expect(() => parseStoreAsset(uri(type)), type).not.toThrow();
    }
  });

  it("maps each format to the right extension", () => {
    expect(parseStoreAsset(uri("video/mp4")).ext).toBe("mp4");
    expect(parseStoreAsset(uri("image/gif")).ext).toBe("gif");
    // Lottie is JSON, and both media types are seen in the wild.
    expect(parseStoreAsset(uri("application/json")).ext).toBe("json");
    expect(parseStoreAsset(uri("text/plain")).ext).toBe("json");
  });

  it("rejects formats the app has no player for", () => {
    // SVGA and PAG are what the reference apps use; accepting them would
    // produce store items that look broken rather than animated.
    expect(() => parseStoreAsset(uri("application/x-svga"))).toThrow(UploadError);
    expect(() => parseStoreAsset(uri("application/octet-stream"))).toThrow(UploadError);
    expect(() => parseStoreAsset(uri("image/svg+xml"))).toThrow(UploadError);
  });

  it("names the offending type so the admin can fix the file", () => {
    expect(() => parseStoreAsset(uri("application/x-svga"))).toThrow(/x-svga/);
  });

  it("caps asset size above the image cap but not without limit", () => {
    // 11 MB of base64 — over the 10 MB asset ceiling.
    const tooBig = "A".repeat(11 * 1024 * 1024 * 1.4);
    expect(() => parseStoreAsset(uri("video/mp4", tooBig))).toThrow(/ميغابايت/);
  });

  it("still refuses animation formats on user image uploads", () => {
    // Widening the asset list must not widen what a user can attach to a post.
    expect(() => parseDataUri(uri("video/mp4"))).toThrow(UploadError);
    expect(() => parseDataUri(uri("image/gif"))).toThrow(UploadError);
  });
});
