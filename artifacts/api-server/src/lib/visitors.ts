import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db, profileVisitsTable, profilesTable, walletsTable } from "@workspace/db";
import { logger } from "./logger";
import { pushToUser } from "./push";
import { blockedIdsFor } from "./safety";
import { getSettings } from "./settings";
import { levelForXp } from "./wallet";

/** How many recent visitors the list returns. */
const MAX_VISITORS = 100;
/** Don't notify again about the same viewer inside this window. */
const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * Record that `visitorUserId` opened `profileUserId`'s profile.
 *
 * Fire-and-forget: viewing a profile must never fail or wait on this. Repeat
 * views update the existing row rather than appending, so the list stays a
 * set of people and the table cannot grow without bound.
 */
export async function recordProfileVisit(params: {
  profileUserId: string;
  visitorUserId: string;
  visitorName: string;
}): Promise<void> {
  const { profileUserId, visitorUserId, visitorName } = params;
  // Looking at your own profile is not a visit.
  if (profileUserId === visitorUserId) return;

  try {
    const settings = await getSettings(visitorUserId);
    // Incognito browsing leaves no trace at all — not even a silent row, or
    // the setting would only be hiding the notification.
    if (settings.invisibleBrowsing) return;

    const [previous] = await db
      .select({ visitedAt: profileVisitsTable.visitedAt })
      .from(profileVisitsTable)
      .where(
        and(
          eq(profileVisitsTable.profileUserId, profileUserId),
          eq(profileVisitsTable.visitorUserId, visitorUserId),
        ),
      )
      .limit(1);

    const now = new Date();
    await db
      .insert(profileVisitsTable)
      .values({ profileUserId, visitorUserId, visitedAt: now })
      .onConflictDoUpdate({
        target: [profileVisitsTable.profileUserId, profileVisitsTable.visitorUserId],
        set: { visitedAt: now },
      });

    // A returning viewer should not ping the owner on every single open.
    const recentlyNotified =
      previous != null && now.getTime() - previous.visitedAt.getTime() < NOTIFY_COOLDOWN_MS;
    if (recentlyNotified) return;

    if (!(await getSettings(profileUserId)).notifyVisitors) return;
    await pushToUser(profileUserId, {
      title: visitorName || "زائر جديد",
      body: "زار ملفك الشخصي",
      data: { type: "profile_visit", visitorUserId },
    });
  } catch (err) {
    logger.error({ err, profileUserId, visitorUserId }, "Failed to record profile visit");
  }
}

export interface VisitorView {
  userId: string;
  name: string;
  avatar: string;
  country: string;
  level: number;
  isOfficial: boolean;
  visitedAt: string;
}

/**
 * People who opened this user's profile, newest first. Blocked accounts are
 * filtered out both ways, matching how the directory hides them.
 */
export async function listVisitors(userId: string): Promise<VisitorView[]> {
  const rows = await db
    .select({
      visitorUserId: profileVisitsTable.visitorUserId,
      visitedAt: profileVisitsTable.visitedAt,
      name: profilesTable.name,
      avatar: profilesTable.avatar,
      country: profilesTable.country,
      isOfficial: profilesTable.isOfficial,
      xp: walletsTable.xp,
    })
    .from(profileVisitsTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, profileVisitsTable.visitorUserId))
    .leftJoin(walletsTable, eq(walletsTable.userId, profileVisitsTable.visitorUserId))
    .where(
      and(
        eq(profileVisitsTable.profileUserId, userId),
        ne(profileVisitsTable.visitorUserId, userId),
      ),
    )
    .orderBy(desc(profileVisitsTable.visitedAt))
    .limit(MAX_VISITORS);

  const hidden = new Set(await blockedIdsFor(userId));
  return rows
    .filter((r) => !hidden.has(r.visitorUserId))
    .map((r) => ({
      userId: r.visitorUserId,
      name: r.name ?? "",
      avatar: r.avatar ?? "",
      country: r.country ?? "",
      level: levelForXp(r.xp ?? 0),
      isOfficial: r.isOfficial ?? false,
      visitedAt: r.visitedAt.toISOString(),
    }));
}

/** Purge every visit row belonging to a set of users. Used by tests. */
export async function deleteVisitsFor(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await db
    .delete(profileVisitsTable)
    .where(inArray(profileVisitsTable.profileUserId, userIds));
  await db
    .delete(profileVisitsTable)
    .where(inArray(profileVisitsTable.visitorUserId, userIds));
}
