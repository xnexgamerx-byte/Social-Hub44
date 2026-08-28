import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import {
  generalLimiter,
  uploadLimiter,
  walletLimiter,
  writeLimiter,
} from "./middlewares/rateLimit";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Render terminates TLS in front of the app, so the client IP arrives in
// X-Forwarded-For. Without this every request looks like it came from the
// proxy and the rate limiter would throttle all users as one.
app.set("trust proxy", 1);

app.use(helmet({
  // The API serves JSON, never HTML, so the default CSP would only get in the
  // way of the Clerk proxy responses without protecting anything.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// The mobile app sends no Origin header at all, so CORS never applies to it.
// The list below is only for browsers: the web build and local development.
// Anything else is refused rather than reflected back, which is what
// origin:true was doing.
const ALLOWED_ORIGINS = [
  process.env.PUBLIC_WEB_ORIGIN,
  "http://localhost:8081",
  "http://localhost:19006",
].filter(Boolean) as string[];

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true); // native app or server-to-server
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      callback(null, false);
    },
  }),
);

// Uploads arrive as base64 data URIs, which are ~33% larger than the file.
// These two parsers run first so only the upload routes accept a large body;
// every other endpoint stays on a small limit, so a multi-megabyte payload
// cannot be posted anywhere else.
//
// Without this the global limit is express.json()'s 100 KB default, which
// silently rejected any post photo bigger than roughly 75 KB with a 413.
app.use("/api/posts", express.json({ limit: "8mb" }));
app.use("/api/admins/media", express.json({ limit: "14mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Resolve the publishable key from the incoming request host so the same
// server can serve multiple Clerk custom domains. Falls back to
// CLERK_PUBLISHABLE_KEY when the host doesn't map to a custom domain.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Ordered most specific first: Express runs every matching prefix, so a
// wallet call passes through the wallet limiter and the general one, and is
// bounded by whichever is stricter.
app.use("/api/wallet", walletLimiter);
app.use("/api/admins/media", uploadLimiter);
app.use("/api/posts", writeLimiter);
app.use("/api/rooms", writeLimiter);
app.use("/api/reports", writeLimiter);
app.use("/api/profiles/me", writeLimiter);
app.use("/api", generalLimiter);

app.use("/api", router);

// Both must sit after the router: the 404 only fires when nothing matched,
// and Express identifies the error handler by its four parameters.
app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
