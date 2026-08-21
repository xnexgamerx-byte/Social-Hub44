import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  blocksTable,
  reportsTable,
  bansTable,
  profilesTable,
  postsTable,
  messagesTable,
  roomsTable,
  REPORT_REASONS,
} from "@workspace/db";
import {
  ListBlocksResponse,
  BlockUserBody,
  UnblockUserParams,
  CreateReportBody,
  ListReportsResponse,
  ReviewReportParams,
  ReviewReportBody,
  ListBansResponse,
  CreateBanBody,
  DeleteBanParams,
  KickFromRoomParams,
  KickFromRoomBody,
  KickFromRoomResponse,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin, isAdminUserId, type AuthedRequest } from "../lib/authz";
import { kickFromRoom, purgeUserData, ROOM_KICK_MINUTES } from "../lib/safety";
import { getWalletByPublicId } from "../lib/wallet";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use("/blocks", requireAuth);
router.use("/reports", requireAuth);
router.use("/account", requireAuth);

/* ------------------------------------------------------------- blocks -- */

router.get("/blocks", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const rows = await db
    .select({
      userId: blocksTable.blockedId,
      name: profilesTable.name,
      avatar: profilesTable.avatar,
      createdAt: blocksTable.createdAt,
    })
    .from(blocksTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, blocksTable.blockedId))
    .where(eq(blocksTable.blockerId, userId))
    .orderBy(desc(blocksTable.createdAt));
  res.json(
    ListBlocksResponse.parse(
      rows.map((r) => ({
        userId: r.userId,
        name: r.name ?? "",
        avatar: r.avatar ?? "",
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/blocks", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = BlockUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const target = parsed.data.targetUserId.trim();
  if (target === userId) {
    res.status(400).json({ error: "لا يمكنك حظر نفسك" });
    return;
  }
  await db
    .insert(blocksTable)
    .values({ blockerId: userId, blockedId: target })
    .onConflictDoNothing();
  res.sendStatus(204);
});

router.delete("/blocks/:targetUserId", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const params = UnblockUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(blocksTable)
    .where(
      and(
        eq(blocksTable.blockerId, userId),
        eq(blocksTable.blockedId, params.data.targetUserId),
      ),
    );
  res.sendStatus(204);
});

/* ------------------------------------------------------------ reports -- */

/**
 * Capture what was reported, at report time. The author can delete the
 * original afterwards, and a report with no evidence is not reviewable.
 */
async function snapshotTarget(
  targetType: string,
  targetId: string,
): Promise<{ snapshot: string; targetUserId: string }> {
  try {
    if (targetType === "post") {
      const [row] = await db
        .select({ text: postsTable.text, userId: postsTable.userId })
        .from(postsTable)
        .where(eq(postsTable.id, Number(targetId)))
        .limit(1);
      if (row) return { snapshot: row.text.slice(0, 500), targetUserId: row.userId };
    }
    if (targetType === "message") {
      const [row] = await db
        .select({ text: messagesTable.text, userId: messagesTable.userId })
        .from(messagesTable)
        .where(eq(messagesTable.id, Number(targetId)))
        .limit(1);
      if (row) return { snapshot: row.text.slice(0, 500), targetUserId: row.userId };
    }
    if (targetType === "room") {
      const [row] = await db
        .select({ name: roomsTable.name, ownerId: roomsTable.ownerId })
        .from(roomsTable)
        .where(eq(roomsTable.id, Number(targetId)))
        .limit(1);
      if (row) return { snapshot: row.name, targetUserId: row.ownerId };
    }
    if (targetType === "user") {
      const [row] = await db
        .select({ name: profilesTable.name, bio: profilesTable.bio })
        .from(profilesTable)
        .where(eq(profilesTable.userId, targetId))
        .limit(1);
      if (row) {
        return {
          snapshot: `${row.name} — ${row.bio}`.slice(0, 500),
          targetUserId: targetId,
        };
      }
    }
  } catch (err) {
    logger.error({ err, targetType, targetId }, "Failed to snapshot report target");
  }
  return { snapshot: "", targetUserId: targetType === "user" ? targetId : "" };
}

router.post("/reports", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { targetType, targetId, reason } = parsed.data;
  if (!REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) {
    res.status(400).json({ error: "سبب غير صالح" });
    return;
  }
  const { snapshot, targetUserId } = await snapshotTarget(targetType, targetId);
  if (targetUserId && targetUserId === userId) {
    res.status(400).json({ error: "لا يمكنك الإبلاغ عن محتواك" });
    return;
  }
  await db.insert(reportsTable).values({
    reporterId: userId,
    targetType,
    targetId,
    targetUserId,
    reason,
    note: (parsed.data.note ?? "").trim().slice(0, 500),
    snapshot,
    status: "open",
  });
  logger.warn({ targetType, targetId, reason }, "Content reported");
  res.sendStatus(204);
});

router.get("/reports", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ report: reportsTable, reporterName: profilesTable.name })
    .from(reportsTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, reportsTable.reporterId))
    .orderBy(desc(reportsTable.createdAt))
    .limit(100);
  res.json(
    ListReportsResponse.parse(
      rows.map((r) => ({
        id: r.report.id,
        reporterId: r.report.reporterId,
        reporterName: r.reporterName ?? "",
        targetType: r.report.targetType,
        targetId: r.report.targetId,
        targetUserId: r.report.targetUserId,
        reason: r.report.reason,
        note: r.report.note,
        snapshot: r.report.snapshot,
        status: r.report.status,
        createdAt: r.report.createdAt.toISOString(),
      })),
    ),
  );
});

router.patch("/reports/:id", requireAdmin, async (req, res): Promise<void> => {
  const actor = (req as AuthedRequest).userId!;
  const params = ReviewReportParams.safeParse(req.params);
  const body = ReviewReportBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "طلب غير صالح" });
    return;
  }
  const [updated] = await db
    .update(reportsTable)
    .set({ status: body.data.status, reviewedBy: actor, reviewedAt: new Date() })
    .where(eq(reportsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "البلاغ غير موجود" });
    return;
  }
  res.sendStatus(204);
});

/* --------------------------------------------------------------- bans -- */

router.get("/bans", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ ban: bansTable, name: profilesTable.name })
    .from(bansTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, bansTable.userId))
    .orderBy(desc(bansTable.createdAt));
  res.json(
    ListBansResponse.parse(
      rows.map((r) => ({
        userId: r.ban.userId,
        name: r.name ?? "",
        reason: r.ban.reason,
        expiresAt: r.ban.expiresAt ? r.ban.expiresAt.toISOString() : "",
        createdAt: r.ban.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/bans", requireAdmin, async (req, res): Promise<void> => {
  const actor = (req as AuthedRequest).userId!;
  const parsed = CreateBanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const wallet = await getWalletByPublicId(parsed.data.publicId.trim());
  if (!wallet) {
    res.status(400).json({ error: "لا يوجد حساب بهذا الرقم" });
    return;
  }
  // An admin must not be able to lock out another admin.
  if (await isAdminUserId(wallet.userId)) {
    res.status(400).json({ error: "لا يمكن إيقاف حساب مشرف" });
    return;
  }
  const days = parsed.data.days ?? 0;
  const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000) : null;
  const reason = (parsed.data.reason ?? "").trim();
  await db
    .insert(bansTable)
    .values({ userId: wallet.userId, reason, bannedBy: actor, expiresAt })
    .onConflictDoUpdate({
      target: bansTable.userId,
      set: { reason, bannedBy: actor, expiresAt },
    });
  logger.warn({ userId: wallet.userId, days }, "Account suspended");
  res.sendStatus(204);
});

router.delete("/bans/:userId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteBanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [removed] = await db
    .delete(bansTable)
    .where(eq(bansTable.userId, params.data.userId))
    .returning();
  if (!removed) {
    res.status(404).json({ error: "لا يوجد إيقاف على هذا الحساب" });
    return;
  }
  res.sendStatus(204);
});

/* ------------------------------------------------------- room removal -- */

router.post("/rooms/:id/kick", requireAuth, async (req, res): Promise<void> => {
  const actor = (req as AuthedRequest).userId!;
  const params = KickFromRoomParams.safeParse(req.params);
  const body = KickFromRoomBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "طلب غير صالح" });
    return;
  }
  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, params.data.id))
    .limit(1);
  if (!room) {
    res.status(404).json({ error: "الغرفة غير موجودة" });
    return;
  }
  if (room.ownerId !== actor && !(await isAdminUserId(actor))) {
    res.status(403).json({ error: "فقط مالك الغرفة يمكنه الطرد" });
    return;
  }
  if (body.data.userId === actor) {
    res.status(400).json({ error: "لا يمكنك طرد نفسك" });
    return;
  }
  const expiresAt = await kickFromRoom(String(params.data.id), body.data.userId, actor);
  res.json(
    KickFromRoomResponse.parse({
      expiresAt: expiresAt.toISOString(),
      minutes: ROOM_KICK_MINUTES,
    }),
  );
});

/* ---------------------------------------------------- account removal -- */

router.delete("/account", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  try {
    await purgeUserData(userId);
    // Identity goes last: if this throws, the content is already gone and the
    // account is unusable, rather than half-deleted with posts still live.
    await clerkClient.users.deleteUser(userId);
    logger.warn({ userId }, "Account deleted by its owner");
    res.sendStatus(204);
  } catch (err) {
    logger.error({ err, userId }, "Failed to delete account");
    res.status(500).json({ error: "تعذّر حذف الحساب، حاول مرة أخرى" });
  }
});

export default router;
