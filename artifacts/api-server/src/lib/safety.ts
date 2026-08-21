import { and, eq, gt, isNull, or } from "drizzle-orm";
import {
  db,
  blocksTable,
  bansTable,
  roomKicksTable,
  postLikesTable,
  postsTable,
  dmMessagesTable,
  conversationsTable,
  followsTable,
  pushTokensTable,
  hostSessionsTable,
  hostsTable,
  userItemsTable,
  dailyTaskClaimsTable,
  messagesTable,
  roomsTable,
  profilesTable,
} from "@workspace/db";

/** How long a room kick keeps someone out. */
export const ROOM_KICK_MINUTES = 60;

/** User-facing explanation of a suspension. */
export function banMessage(ban: ActiveBan): string {
  const until = ban.expiresAt
    ? `حسابك موقوف حتى ${ban.expiresAt.toLocaleDateString("ar-EG")}`
    : "حسابك موقوف نهائياً";
  return ban.reason ? `${until} — ${ban.reason}` : until;
}

export interface ActiveBan {
  reason: string;
  expiresAt: Date | null;
}

/**
 * Current suspension for an account, or null. A row whose `expiresAt` has
 * passed is treated as expired rather than deleted, so the history survives
 * for audit.
 */
export async function activeBan(userId: string): Promise<ActiveBan | null> {
  const [row] = await db
    .select({ reason: bansTable.reason, expiresAt: bansTable.expiresAt })
    .from(bansTable)
    .where(
      and(
        eq(bansTable.userId, userId),
        or(isNull(bansTable.expiresAt), gt(bansTable.expiresAt, new Date())),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * True when either user has blocked the other. Blocking is recorded one-way
 * but enforced both ways: the blocker must not receive the blocked user's
 * messages, and the blocked user must not be able to keep contacting them.
 */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ id: blocksTable.id })
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerId, a), eq(blocksTable.blockedId, b)),
        and(eq(blocksTable.blockerId, b), eq(blocksTable.blockedId, a)),
      ),
    )
    .limit(1);
  return row != null;
}

/** Every user id that `userId` has blocked or been blocked by. */
export async function blockedIdsFor(userId: string): Promise<string[]> {
  const rows = await db
    .select({ blockerId: blocksTable.blockerId, blockedId: blocksTable.blockedId })
    .from(blocksTable)
    .where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)));
  const out = new Set<string>();
  for (const r of rows) {
    out.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  }
  return [...out];
}

/** True while a room kick is still in force. */
export async function isKickedFromRoom(roomId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: roomKicksTable.id })
    .from(roomKicksTable)
    .where(
      and(
        eq(roomKicksTable.roomId, roomId),
        eq(roomKicksTable.userId, userId),
        gt(roomKicksTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row != null;
}

/** Record a kick, refreshing the window if one is already in place. */
export async function kickFromRoom(
  roomId: string,
  userId: string,
  kickedBy: string,
): Promise<Date> {
  const expiresAt = new Date(Date.now() + ROOM_KICK_MINUTES * 60_000);
  await db
    .insert(roomKicksTable)
    .values({ roomId, userId, kickedBy, expiresAt })
    .onConflictDoUpdate({
      target: [roomKicksTable.roomId, roomKicksTable.userId],
      set: { expiresAt, kickedBy },
    });
  return expiresAt;
}

/**
 * Remove every trace of an account. Listed explicitly rather than derived, so
 * a reviewer can see exactly what is deleted and no table can silently escape
 * the purge. Wallet and ledger rows are deliberately retained: they are
 * financial records tied to real purchases.
 */
export async function purgeUserData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(postLikesTable).where(eq(postLikesTable.userId, userId));
    await tx.delete(postsTable).where(eq(postsTable.userId, userId));
    await tx.delete(dmMessagesTable).where(eq(dmMessagesTable.fromUserId, userId));
    await tx
      .delete(conversationsTable)
      .where(
        or(eq(conversationsTable.userAId, userId), eq(conversationsTable.userBId, userId)),
      );
    await tx
      .delete(followsTable)
      .where(or(eq(followsTable.followerId, userId), eq(followsTable.followedId, userId)));
    await tx
      .delete(blocksTable)
      .where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)));
    await tx.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));
    await tx.delete(hostSessionsTable).where(eq(hostSessionsTable.userId, userId));
    await tx.delete(hostsTable).where(eq(hostsTable.userId, userId));
    await tx.delete(userItemsTable).where(eq(userItemsTable.userId, userId));
    await tx.delete(dailyTaskClaimsTable).where(eq(dailyTaskClaimsTable.userId, userId));
    await tx.delete(messagesTable).where(eq(messagesTable.userId, userId));
    await tx.delete(roomKicksTable).where(eq(roomKicksTable.userId, userId));
    await tx.delete(roomsTable).where(eq(roomsTable.ownerId, userId));
    await tx.delete(profilesTable).where(eq(profilesTable.userId, userId));
  });
}
