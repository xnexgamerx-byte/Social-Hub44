import { Router, type IRouter } from "express";
import { RtcTokenBuilder, RtcRole } from "agora-token";

const router: IRouter = Router();

// Tokens are short-lived; the client refreshes by re-requesting before expiry.
const TOKEN_TTL_SECONDS = 3600;

/**
 * Issues an Agora RTC token for a voice channel.
 *
 * The App ID is public and returned to the client; the App Certificate is the
 * secret used to sign the token and never leaves the server. This endpoint is
 * the server side of the "Agora-ready" voice stage: the native client (built
 * outside Expo Go) calls it to join the real audio channel.
 */
router.get("/agora/token", (req, res) => {
  const appId = process.env["AGORA_APP_ID"];
  const appCertificate = process.env["AGORA_APP_CERTIFICATE"];

  if (!appId || !appCertificate) {
    req.log.warn("Agora token requested but credentials are not configured");
    res.status(503).json({
      error: "voice_not_configured",
      message: "خدمة الصوت غير مهيأة بعد. أضف مفاتيح Agora لتفعيلها.",
    });
    return;
  }

  const channelName = String(req.query["channel"] ?? "").trim();
  if (!channelName) {
    res.status(400).json({ error: "missing_channel", message: "channel مطلوب" });
    return;
  }

  const uid = Number(req.query["uid"] ?? 0);
  if (!Number.isInteger(uid) || uid < 0) {
    res.status(400).json({ error: "invalid_uid", message: "uid غير صالح" });
    return;
  }

  const privilegeExpire = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_TTL_SECONDS,
    privilegeExpire,
  );

  res.json({
    appId,
    channel: channelName,
    uid,
    token,
    expiresAt: privilegeExpire * 1000,
  });
});

export default router;
