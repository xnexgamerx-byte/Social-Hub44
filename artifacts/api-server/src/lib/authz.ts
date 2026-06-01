import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Authenticated requests carry the verified Clerk user id. Set by
 * `requireAuth` / `requireAdmin` after validating the session.
 */
export interface AuthedRequest extends Request {
  userId?: string;
}

/** Parse the ADMIN_EMAILS env var into a lowercase set of allowed admin emails. */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Resolve the primary (or first) email address for a Clerk user id. */
export async function getUserEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  return primary?.emailAddress.toLowerCase() ?? null;
}

/** True when the email has been granted admin via the in-app admins table. */
async function isDbAdminEmail(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.email, email))
    .limit(1);
  return row != null;
}

/**
 * Returns true when the given Clerk user id maps to an email that is either
 * listed in ADMIN_EMAILS (bootstrap owner) or stored in the in-app admins
 * table. Secure by default: an unresolvable email is never an admin.
 */
export async function isAdminUserId(userId: string): Promise<boolean> {
  try {
    const email = await getUserEmail(userId);
    if (email == null) return false;
    if (adminEmails().has(email)) return true;
    return await isDbAdminEmail(email);
  } catch (err) {
    logger.error({ err, userId }, "Failed to resolve admin status");
    return false;
  }
}

/** Reject requests without a valid Clerk session; attach `req.userId`. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "يجب تسجيل الدخول" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

/** Reject requests that are not from an authorized admin account. */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "يجب تسجيل الدخول" });
    return;
  }
  if (!(await isAdminUserId(userId))) {
    res.status(403).json({ error: "غير مصرح لك بالوصول" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

/**
 * Verify a Clerk session JWT (used for the Socket.IO handshake, which has no
 * Express request to run middleware on). Returns the user id or null.
 */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? "",
    });
    return claims.sub ?? null;
  } catch {
    return null;
  }
}
