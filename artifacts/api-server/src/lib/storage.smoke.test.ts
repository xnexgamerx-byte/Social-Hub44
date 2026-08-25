import { describe, expect, it } from "vitest";
import { isStorageConfigured, parseDataUri, uploadImage, UploadError } from "./storage";

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
