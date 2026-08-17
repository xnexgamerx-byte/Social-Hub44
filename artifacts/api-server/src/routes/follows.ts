import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, followsTable } from "@workspace/db";
import {
  FollowUserBody,
  FollowUserResponse,
  UnfollowUserParams,
  UnfollowUserResponse,
  GetFollowStatsParams,
  GetFollowStatsResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/authz";

const router: IRouter = Router();

router.use("/follow", requireAuth);

async function statsFor(userId: string, viewerId: string) {
  const [[followers], [following], [mine]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(followsTable)
      .where(eq(followsTable.followedId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId)),
    db
      .select({ id: followsTable.id })
      .from(followsTable)
      .where(
        and(eq(followsTable.followerId, viewerId), eq(followsTable.followedId, userId)),
      )
      .limit(1),
  ]);
  return {
    userId,
    followers: followers.count,
    following: following.count,
    isFollowedByMe: mine != null,
  };
}

router.post("/follow", async (req, res): Promise<void> => {
  const me = (req as AuthedRequest).userId!;
  const parsed = FollowUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { targetUserId } = parsed.data;
  if (targetUserId === me) {
    res.status(400).json({ error: "لا يمكنك متابعة نفسك" });
    return;
  }
  // Idempotent: following twice is a no-op thanks to the unique pair index.
  await db
    .insert(followsTable)
    .values({ followerId: me, followedId: targetUserId })
    .onConflictDoNothing();
  res.json(FollowUserResponse.parse(await statsFor(targetUserId, me)));
});

router.delete("/follow/:targetUserId", async (req, res): Promise<void> => {
  const me = (req as AuthedRequest).userId!;
  const params = UnfollowUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(followsTable)
    .where(
      and(
        eq(followsTable.followerId, me),
        eq(followsTable.followedId, params.data.targetUserId),
      ),
    );
  res.json(UnfollowUserResponse.parse(await statsFor(params.data.targetUserId, me)));
});

router.get("/follow/stats/:userId", async (req, res): Promise<void> => {
  const me = (req as AuthedRequest).userId!;
  const params = GetFollowStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(GetFollowStatsResponse.parse(await statsFor(params.data.userId, me)));
});

export default router;
