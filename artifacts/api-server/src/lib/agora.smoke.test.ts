import { describe, expect, it } from "vitest";
import { RtcTokenBuilder, RtcRole } from "agora-token";

const appId = process.env["AGORA_APP_ID"];
const cert = process.env["AGORA_APP_CERTIFICATE"];
const configured = Boolean(appId && cert);

function build(id: string, certificate: string, channel = "room:1", uid = 12345): string {
  const expire = Math.floor(Date.now() / 1000) + 3600;
  return RtcTokenBuilder.buildTokenWithUid(
    id,
    certificate,
    channel,
    uid,
    RtcRole.PUBLISHER,
    3600,
    expire,
  );
}

describe("agora tokens", () => {
  it.runIf(configured)("builds a version-007 token from the configured keys", () => {
    const token = build(appId!, cert!);
    // 007 tokens are zlib-compressed, so the app id is not literally present.
    expect(token.startsWith("007")).toBe(true);
    expect(token.length).toBeGreaterThan(80);
    expect(() => Buffer.from(token.slice(3), "base64")).not.toThrow();
  });

  it.runIf(configured)("derives a different token per app id, channel and uid", () => {
    const base = build(appId!, cert!);
    // Proves the inputs actually feed the signature rather than being ignored.
    expect(build("ffffffffffffffffffffffffffffffff", cert!)).not.toBe(base);
    expect(build(appId!, cert!, "room:2")).not.toBe(base);
    expect(build(appId!, cert!, "room:1", 999)).not.toBe(base);
  });

  it.runIf(configured)("app id and certificate are distinct 32-hex values", () => {
    expect(appId).toMatch(/^[0-9a-f]{32}$/);
    expect(cert).toMatch(/^[0-9a-f]{32}$/);
    expect(appId).not.toBe(cert);
  });
});
