import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  referralsTable,
  hostsTable,
  hostSessionsTable,
  roomEventsTable,
  roomsTable,
  pushTokensTable,
  profilesTable,
  walletsTable,
} from "@workspace/db";
import {
  GetMyReferralResponse,
  ClaimReferralBody,
  ClaimReferralResponse,
  ListHostsResponse,
  ListHostsResponseItem,
  CreateHostBody,
  DeleteHostParams,
  ListRoomEventsResponse,
  ListRoomEventsResponseItem,
  CreateRoomEventBody,
  DeleteRoomEventParams,
  RegisterPushTokenBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthedRequest } from "../lib/authz";
import { adjustWalletTx, ensureWallet, getWalletByPublicId } from "../lib/wallet";

const router: IRouter = Router();

/** Coins granted to each side when an invite is redeemed. */
export const REFERRER_REWARD = 500;
export const REFERRED_REWARD = 300;

router.use("/referrals", requireAuth);
router.use("/push", requireAuth);

async function referralStatus(userId: string) {
  const wallet = await ensureWallet(userId);
  const [[{ count }], [claimed]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralsTable)
      .where(eq(referralsTable.referrerId, userId)),
    db
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.referredId, userId))
      .limit(1),
  ]);
  return {
    // The account's existing public id doubles as its invite code.
    code: wallet.publicId ?? "",
    invitedCount: count,
    hasClaimed: claimed != null,
    referrerReward: REFERRER_REWARD,
    referredReward: REFERRED_REWARD,
  };
}

router.get("/referrals/me", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  res.json(GetMyReferralResponse.parse(await referralStatus(userId)));
});

router.post("/referrals/claim", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = ClaimReferralBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const code = parsed.data.code.trim();

  const inviter = await getWalletByPublicId(code);
  if (!inviter) {
    res.status(400).json({ error: "رمز الدعوة غير صحيح" });
    return;
  }
  if (inviter.userId === userId) {
    res.status(400).json({ error: "لا يمكنك استخدام رمزك الخاص" });
    return;
  }

  const [already] = await db
    .select({ id: referralsTable.id })
    .from(referralsTable)
    .where(eq(referralsTable.referredId, userId))
    .limit(1);
  if (already) {
    res.status(400).json({ error: "سبق أن استخدمت رمز دعوة" });
    return;
  }

  await ensureWallet(userId);

  try {
    // One transaction: the claim row and both credits land together. The
    // unique index on referredId is the backstop if two requests race the
    // check above.
    await db.transaction(async (tx) => {
      await tx.insert(referralsTable).values({
        referrerId: inviter.userId,
        referredId: userId,
        code,
        referrerReward: REFERRER_REWARD,
        referredReward: REFERRED_REWARD,
      });
      await adjustWalletTx(tx, {
        userId: inviter.userId,
        currency: "coins",
        amount: REFERRER_REWARD,
        type: "task_reward",
        description: "مكافأة دعوة صديق",
        refId: userId,
      });
      await adjustWalletTx(tx, {
        userId,
        currency: "coins",
        amount: REFERRED_REWARD,
        type: "task_reward",
        description: "مكافأة الانضمام بدعوة",
        refId: inviter.userId,
      });
    });
  } catch (err) {
    // Drivers surface the unique violation either directly or wrapped, so
    // check both before deciding this is a real failure.
    const e = err as { code?: string; cause?: { code?: string } };
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      res.status(400).json({ error: "سبق أن استخدمت رمز دعوة" });
      return;
    }
    throw err;
  }

  res.json(ClaimReferralResponse.parse(await referralStatus(userId)));
});

/* ---------------------------------------------------------------- hosts -- */

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

router.get("/hosts", requireAdmin, async (_req, res): Promise<void> => {
  const weekStart = startOfWeek();
  const rows = await db
    .select({
      host: hostsTable,
      name: profilesTable.name,
      avatar: profilesTable.avatar,
      publicId: walletsTable.publicId,
    })
    .from(hostsTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, hostsTable.userId))
    .leftJoin(walletsTable, eq(walletsTable.userId, hostsTable.userId))
    .orderBy(desc(hostsTable.createdAt));

  const totals = await db
    .select({
      userId: hostSessionsTable.userId,
      total: sql<number>`coalesce(sum(${hostSessionsTable.minutes}), 0)::int`,
      week: sql<number>`coalesce(sum(case when ${hostSessionsTable.startedAt} >= ${weekStart} then ${hostSessionsTable.minutes} else 0 end), 0)::int`,
    })
    .from(hostSessionsTable)
    .groupBy(hostSessionsTable.userId);
  const byUser = new Map(totals.map((t) => [t.userId, t]));

  res.json(
    ListHostsResponse.parse(
      rows.map((r) => ({
        userId: r.host.userId,
        name: r.name ?? "",
        avatar: r.avatar ?? "",
        publicId: r.publicId ?? "",
        bonusSharePercent: r.host.bonusSharePercent,
        active: r.host.active,
        minutesThisWeek: byUser.get(r.host.userId)?.week ?? 0,
        minutesTotal: byUser.get(r.host.userId)?.total ?? 0,
      })),
    ),
  );
});

router.post("/hosts", requireAdmin, async (req, res): Promise<void> => {
  const actor = (req as AuthedRequest).userId!;
  const parsed = CreateHostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const wallet = await getWalletByPublicId(parsed.data.publicId.trim());
  if (!wallet) {
    res.status(400).json({ error: "لا يوجد حساب بهذا الرقم" });
    return;
  }
  const [existing] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.userId, wallet.userId))
    .limit(1);
  if (existing) {
    res.status(400).json({ error: "هذا الحساب مضيف بالفعل" });
    return;
  }

  const [host] = await db
    .insert(hostsTable)
    .values({
      userId: wallet.userId,
      bonusSharePercent: parsed.data.bonusSharePercent ?? 0,
      addedBy: actor,
      active: true,
    })
    .returning();
  // Mirror onto the profile so lists can show the badge without a join.
  await db
    .update(profilesTable)
    .set({ isHost: true })
    .where(eq(profilesTable.userId, wallet.userId));

  const [profile] = await db
    .select({ name: profilesTable.name, avatar: profilesTable.avatar })
    .from(profilesTable)
    .where(eq(profilesTable.userId, wallet.userId))
    .limit(1);

  res.status(201).json(
    ListHostsResponseItem.parse({
      userId: host.userId,
      name: profile?.name ?? "",
      avatar: profile?.avatar ?? "",
      publicId: wallet.publicId ?? "",
      bonusSharePercent: host.bonusSharePercent,
      active: host.active,
      minutesThisWeek: 0,
      minutesTotal: 0,
    }),
  );
});

router.delete("/hosts/:userId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteHostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [removed] = await db
    .delete(hostsTable)
    .where(eq(hostsTable.userId, params.data.userId))
    .returning();
  if (!removed) {
    res.status(404).json({ error: "هذا الحساب ليس مضيفاً" });
    return;
  }
  await db
    .update(profilesTable)
    .set({ isHost: false })
    .where(eq(profilesTable.userId, params.data.userId));
  res.sendStatus(204);
});

/* -------------------------------------------------------- room events -- */

router.get("/room-events", async (_req, res): Promise<void> => {
  // Anything that started within the last two hours still counts as "on now".
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const rows = await db
    .select({ event: roomEventsTable, roomName: roomsTable.name })
    .from(roomEventsTable)
    .leftJoin(roomsTable, eq(roomsTable.id, roomEventsTable.roomId))
    .where(and(eq(roomEventsTable.active, true), gte(roomEventsTable.startsAt, since)))
    .orderBy(asc(roomEventsTable.startsAt))
    .limit(20);
  res.json(
    ListRoomEventsResponse.parse(
      rows.map((r) => ({
        ...r.event,
        roomName: r.roomName ?? "",
        startsAt: r.event.startsAt.toISOString(),
      })),
    ),
  );
});

router.post("/room-events", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateRoomEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    res.status(400).json({ error: "تاريخ غير صالح" });
    return;
  }
  const [room] = await db
    .select({ id: roomsTable.id, name: roomsTable.name })
    .from(roomsTable)
    .where(eq(roomsTable.id, parsed.data.roomId))
    .limit(1);
  if (!room) {
    res.status(400).json({ error: "الغرفة غير موجودة" });
    return;
  }
  const [event] = await db
    .insert(roomEventsTable)
    .values({
      roomId: parsed.data.roomId,
      title: parsed.data.title.trim(),
      description: (parsed.data.description ?? "").trim(),
      startsAt,
      weekday: parsed.data.weekday ?? -1,
      active: true,
    })
    .returning();
  res.status(201).json(
    ListRoomEventsResponseItem.parse({
      ...event,
      roomName: room.name,
      startsAt: event.startsAt.toISOString(),
    }),
  );
});

router.delete("/room-events/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteRoomEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [removed] = await db
    .delete(roomEventsTable)
    .where(eq(roomEventsTable.id, params.data.id))
    .returning();
  if (!removed) {
    res.status(404).json({ error: "الحدث غير موجود" });
    return;
  }
  res.sendStatus(204);
});

/* --------------------------------------------------------------- push -- */

router.post("/push/register", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = RegisterPushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // A device can change hands: re-registering an existing token moves it to
  // the account that just claimed it.
  await db
    .insert(pushTokensTable)
    .values({
      userId,
      token: parsed.data.token,
      platform: parsed.data.platform ?? "",
    })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId, platform: parsed.data.platform ?? "", updatedAt: new Date() },
    });
  res.sendStatus(204);
});

export default router;
