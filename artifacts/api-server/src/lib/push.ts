import { eq, inArray } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo accepts up to 100 messages per request.
const BATCH = 100;

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Deliver a notification to every device registered to a user.
 *
 * Remote push requires a real build — Expo Go cannot receive it — so this is
 * a no-op in development until the app ships as its own binary. Failures are
 * logged and swallowed: a notification must never break the action that
 * triggered it.
 */
export async function pushToUser(userId: string, message: PushMessage): Promise<void> {
  try {
    const rows = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));
    if (rows.length === 0) return;
    await sendExpoPush(
      rows.map((r) => r.token),
      message,
    );
  } catch (err) {
    logger.error({ err, userId }, "Failed to push to user");
  }
}

async function sendExpoPush(tokens: string[], message: PushMessage): Promise<void> {
  for (let i = 0; i < tokens.length; i += BATCH) {
    const slice = tokens.slice(i, i + BATCH);
    const payload = slice.map((to) => ({
      to,
      sound: "default",
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo push request failed");
      continue;
    }
    const json = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    // Expo reports dead tokens per message; drop them so the table does not
    // grow stale entries that fail forever.
    const dead: string[] = [];
    json.data?.forEach((r, idx) => {
      if (r.status === "error" && r.details?.error === "DeviceNotRegistered") {
        dead.push(slice[idx]);
      }
    });
    if (dead.length > 0) {
      await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, dead));
      logger.info({ n: dead.length }, "Pruned unregistered push tokens");
    }
  }
}
