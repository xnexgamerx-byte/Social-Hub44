import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { sendDm } from "./dm";
import { logger } from "./logger";

/**
 * The app's own account. It is always rendered with an "official" badge and
 * never presented as a private individual — its only job is onboarding and
 * announcements. Accounts that impersonate real people are out of the
 * question: users spend real money here, so a persona that fakes a human is
 * straightforward deception.
 */
export const OFFICIAL_USER_ID = "official_nabda";
const OFFICIAL_NAME = "نبضة";

const WELCOME_TEXT = [
  "أهلاً بك في نبضة 👋",
  "",
  "• ادخل «الغرف» وشارك بالدردشة الصوتية",
  "• انشر لحظتك الأولى من تبويب «اللحظات»",
  "• العب لودو مع أصدقائك من صفحة «أنا»",
  "",
  "شارك رمز دعوتك مع أصدقائك — تربح أنت وهم كوينزات.",
].join("\n");

/** Make sure the official profile row exists. Safe to call repeatedly. */
export async function ensureOfficialProfile(): Promise<void> {
  await db
    .insert(profilesTable)
    .values({
      userId: OFFICIAL_USER_ID,
      name: OFFICIAL_NAME,
      bio: "الحساب الرسمي لتطبيق نبضة",
      isOfficial: true,
    })
    .onConflictDoUpdate({
      target: profilesTable.userId,
      set: { isOfficial: true, name: OFFICIAL_NAME },
    });
}

/**
 * Send the one-time welcome message. Called when a profile row is first
 * created, so each account receives it exactly once.
 */
export async function sendWelcomeDm(toUserId: string, toName: string): Promise<void> {
  if (toUserId === OFFICIAL_USER_ID) return;
  try {
    await ensureOfficialProfile();
    await sendDm({
      fromUserId: OFFICIAL_USER_ID,
      fromName: OFFICIAL_NAME,
      fromAvatar: "",
      toUserId,
      toName,
      text: WELCOME_TEXT,
    });
  } catch (err) {
    // Onboarding is best-effort — a failed welcome must never block sign-up.
    logger.error({ err, toUserId }, "Failed to send welcome DM");
  }
}

/** True when the id belongs to the official account. */
export function isOfficialUser(userId: string): boolean {
  return userId === OFFICIAL_USER_ID;
}

export async function officialProfileExists(): Promise<boolean> {
  const [row] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.userId, OFFICIAL_USER_ID))
    .limit(1);
  return row != null;
}
