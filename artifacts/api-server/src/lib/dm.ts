import { and, eq, or, desc, sql } from "drizzle-orm";
import {
  db,
  conversationsTable,
  dmMessagesTable,
  type Conversation,
  type DmMessage,
} from "@workspace/db";
import { isBlockedBetween } from "./safety";

const MAX_DM_LENGTH = 2000;

/**
 * Conversations store the user pair canonically (userAId < userBId) so the
 * same two users always map to one row no matter who messages first.
 */
export function canonicalPair(u1: string, u2: string): { a: string; b: string } {
  return u1 < u2 ? { a: u1, b: u2 } : { a: u2, b: u1 };
}

export function isParticipant(conversation: Conversation, userId: string): boolean {
  return conversation.userAId === userId || conversation.userBId === userId;
}

/** Shape a conversation row for one participant's inbox. */
export function shapeForUser(conversation: Conversation, userId: string) {
  const meIsA = conversation.userAId === userId;
  return {
    id: conversation.id,
    otherUserId: meIsA ? conversation.userBId : conversation.userAId,
    otherName: meIsA ? conversation.userBName : conversation.userAName,
    otherAvatar: meIsA ? conversation.userBAvatar : conversation.userAAvatar,
    lastText: conversation.lastText,
    lastFromId: conversation.lastFromId,
    lastAt: conversation.lastAt.toISOString(),
    unread: meIsA ? conversation.unreadA : conversation.unreadB,
  };
}

export async function getConversation(id: number): Promise<Conversation | null> {
  const [row] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function listConversationsFor(userId: string): Promise<Conversation[]> {
  return db
    .select()
    .from(conversationsTable)
    .where(
      or(eq(conversationsTable.userAId, userId), eq(conversationsTable.userBId, userId)),
    )
    .orderBy(desc(conversationsTable.lastAt));
}

interface PartyInfo {
  userId: string;
  name?: string;
  avatar?: string;
}

/**
 * Find or create the conversation between two users, refreshing the display
 * snapshots for whichever sides we were given info for.
 */
export async function getOrCreateConversation(
  me: PartyInfo,
  other: PartyInfo,
): Promise<Conversation> {
  const { a } = canonicalPair(me.userId, other.userId);
  const meIsA = a === me.userId;
  const aInfo = meIsA ? me : other;
  const bInfo = meIsA ? other : me;

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.userAId, aInfo.userId),
        eq(conversationsTable.userBId, bInfo.userId),
      ),
    )
    .limit(1);

  if (existing) {
    // Keep display snapshots fresh, but never blank them out.
    const patch: Partial<typeof conversationsTable.$inferInsert> = {};
    if (aInfo.name && aInfo.name !== existing.userAName) patch.userAName = aInfo.name;
    if (aInfo.avatar && aInfo.avatar !== existing.userAAvatar) patch.userAAvatar = aInfo.avatar;
    if (bInfo.name && bInfo.name !== existing.userBName) patch.userBName = bInfo.name;
    if (bInfo.avatar && bInfo.avatar !== existing.userBAvatar) patch.userBAvatar = bInfo.avatar;
    if (Object.keys(patch).length === 0) return existing;
    const [updated] = await db
      .update(conversationsTable)
      .set(patch)
      .where(eq(conversationsTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(conversationsTable)
    .values({
      userAId: aInfo.userId,
      userAName: aInfo.name ?? "",
      userAAvatar: aInfo.avatar ?? "",
      userBId: bInfo.userId,
      userBName: bInfo.name ?? "",
      userBAvatar: bInfo.avatar ?? "",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a concurrent insert race — the row exists now.
  const [row] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.userAId, aInfo.userId),
        eq(conversationsTable.userBId, bInfo.userId),
      ),
    )
    .limit(1);
  return row;
}

export class DmValidationError extends Error {}

/**
 * Persist a direct message: upserts the conversation, appends the message and
 * bumps the recipient's unread counter atomically.
 */
export async function sendDm(input: {
  fromUserId: string;
  fromName: string;
  fromAvatar: string;
  toUserId: string;
  toName?: string;
  toAvatar?: string;
  text: string;
}): Promise<{ message: DmMessage; conversation: Conversation }> {
  const text = input.text.trim();
  if (!text) throw new DmValidationError("الرسالة فارغة");
  if (text.length > MAX_DM_LENGTH) throw new DmValidationError("الرسالة طويلة جداً");
  if (input.toUserId === input.fromUserId)
    throw new DmValidationError("لا يمكنك مراسلة نفسك");
  // Blocking is recorded one-way but enforced both ways: neither side can
  // keep reaching the other once a block exists.
  if (await isBlockedBetween(input.fromUserId, input.toUserId)) {
    throw new DmValidationError("لا يمكن إرسال رسالة إلى هذا الحساب");
  }

  const conversation = await getOrCreateConversation(
    { userId: input.fromUserId, name: input.fromName, avatar: input.fromAvatar },
    { userId: input.toUserId, name: input.toName, avatar: input.toAvatar },
  );

  const recipientIsA = conversation.userAId === input.toUserId;
  return db.transaction(async (tx) => {
    const [message] = await tx
      .insert(dmMessagesTable)
      .values({
        conversationId: conversation.id,
        fromUserId: input.fromUserId,
        fromName: input.fromName,
        fromAvatar: input.fromAvatar,
        text,
      })
      .returning();
    const [updated] = await tx
      .update(conversationsTable)
      .set({
        lastText: text,
        lastFromId: input.fromUserId,
        lastAt: message.createdAt,
        ...(recipientIsA
          ? { unreadA: sql`${conversationsTable.unreadA} + 1` }
          : { unreadB: sql`${conversationsTable.unreadB} + 1` }),
      })
      .where(eq(conversationsTable.id, conversation.id))
      .returning();
    return { message, conversation: updated };
  });
}

/** Reset the given participant's unread counter. */
export async function markRead(conversation: Conversation, userId: string): Promise<void> {
  const meIsA = conversation.userAId === userId;
  await db
    .update(conversationsTable)
    .set(meIsA ? { unreadA: 0 } : { unreadB: 0 })
    .where(eq(conversationsTable.id, conversation.id));
}

export async function listMessages(conversationId: number, limit = 100): Promise<DmMessage[]> {
  const rows = await db
    .select()
    .from(dmMessagesTable)
    .where(eq(dmMessagesTable.conversationId, conversationId))
    .orderBy(desc(dmMessagesTable.createdAt))
    .limit(limit);
  return rows.reverse();
}
