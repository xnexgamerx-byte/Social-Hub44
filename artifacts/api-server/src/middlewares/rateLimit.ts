import type { Request } from "express";
import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from "express-rate-limit";
import type { AuthedRequest } from "../lib/authz";

/**
 * Rate limits, keyed per account rather than per IP wherever a request is
 * authenticated.
 *
 * IP alone is the wrong key for this app: users share carrier NAT, so one
 * busy mobile network would throttle a whole city, while a single abusive
 * account rotating IPs would slip through. Falling back to the IP covers
 * unauthenticated traffic.
 */
function keyFor(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  if (userId) return `u:${userId}`;
  // ipKeyGenerator normalises IPv6 to a /56 block, so one address cannot get
  // an unlimited number of buckets by varying its suffix.
  return ipKeyGenerator(req.ip ?? "");
}

const message = { error: "طلبات كثيرة جداً، حاول بعد قليل" };

/**
 * Baseline for reads. Generous — the app polls several endpoints on launch
 * and on foreground, so this is a ceiling on abuse, not a throttle on use.
 */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 240,
  keyGenerator: keyFor,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/**
 * Writes that create content other people see. Tighter, because this is what
 * spam actually looks like.
 */
export const writeLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: keyFor,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/**
 * Anything that moves money or grants a reward. Deliberately strict: these
 * are the endpoints where a replay or a script is most expensive, and no
 * legitimate user recharges or claims a task thirty times a minute.
 */
export const walletLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: keyFor,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/**
 * Uploads. Each one carries megabytes, so the cost per request is far higher
 * than a normal call and the limit is correspondingly lower.
 */
export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 12,
  keyGenerator: keyFor,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});
