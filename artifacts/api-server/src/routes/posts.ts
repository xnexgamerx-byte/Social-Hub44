import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, postsTable, postLikesTable, walletsTable, profilesTable } from "@workspace/db";
import {
  ListPostsResponse,
  // Orval does not emit a CreatePostResponse; the 201 body is one feed item,
  // so validate it with the feed's item schema.
  ListPostsResponseItem,
  CreatePostBody,
  DeletePostParams,
  TogglePostLikeParams,
  TogglePostLikeResponse,
} from "@workspace/api-zod";
import { requireAuth, isAdminUserId, type AuthedRequest } from "../lib/authz";
import { levelForXp } from "../lib/wallet";

const router: IRouter = Router();

const FEED_LIMIT = 100;

router.use("/posts", requireAuth);

router.get("/posts", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const posts = await db
    .select()
    .from(postsTable)
    .orderBy(desc(postsTable.createdAt))
    .limit(FEED_LIMIT);

  if (posts.length === 0) {
    res.json(ListPostsResponse.parse([]));
    return;
  }

  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.userId))];
  // Aggregate likes, author levels and author profiles in batched queries
  // rather than per post.
  const [likeRows, myLikes, walletRows, profileRows] = await Promise.all([
    db
      .select({ postId: postLikesTable.postId, count: sql<number>`count(*)::int` })
      .from(postLikesTable)
      .where(inArray(postLikesTable.postId, ids))
      .groupBy(postLikesTable.postId),
    db
      .select({ postId: postLikesTable.postId })
      .from(postLikesTable)
      .where(and(inArray(postLikesTable.postId, ids), eq(postLikesTable.userId, userId))),
    db
      .select({ userId: walletsTable.userId, xp: walletsTable.xp })
      .from(walletsTable)
      .where(inArray(walletsTable.userId, authorIds)),
    db
      .select({
        userId: profilesTable.userId,
        name: profilesTable.name,
        avatar: profilesTable.avatar,
      })
      .from(profilesTable)
      .where(inArray(profilesTable.userId, authorIds)),
  ]);

  const counts = new Map(likeRows.map((r) => [r.postId, r.count]));
  const liked = new Set(myLikes.map((r) => r.postId));
  const xpByUser = new Map(walletRows.map((r) => [r.userId, r.xp]));
  const profileByUser = new Map(profileRows.map((r) => [r.userId, r]));

  res.json(
    ListPostsResponse.parse(
      posts.map((p) => {
        // Prefer the author's current profile so a renamed user is not stuck
        // with the name captured when the post was written.
        const profile = profileByUser.get(p.userId);
        return {
          ...p,
          authorName: profile?.name || p.authorName,
          authorAvatar: profile?.avatar || p.authorAvatar,
          createdAt: p.createdAt.toISOString(),
          likeCount: counts.get(p.id) ?? 0,
          likedByMe: liked.has(p.id),
          authorLevel: levelForXp(xpByUser.get(p.userId) ?? 0),
        };
      }),
    ),
  );
});

router.post("/posts", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const text = (parsed.data.text ?? "").trim();
  const images = parsed.data.images ?? [];
  if (!text && images.length === 0) {
    res.status(400).json({ error: "اكتب نصاً أو أضف صورة" });
    return;
  }
  const [[profile], [wallet]] = await Promise.all([
    db
      .select({ name: profilesTable.name, avatar: profilesTable.avatar })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1),
    db
      .select({ xp: walletsTable.xp })
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1),
  ]);

  const [post] = await db
    .insert(postsTable)
    .values({
      // Authorship always comes from the session, never the body.
      userId,
      authorName: profile?.name ?? "",
      authorAvatar: profile?.avatar ?? "",
      text,
      images,
      tag: (parsed.data.tag ?? "").trim(),
    })
    .returning();

  res.status(201).json(
    ListPostsResponseItem.parse({
      ...post,
      createdAt: post.createdAt.toISOString(),
      likeCount: 0,
      likedByMe: false,
      authorLevel: levelForXp(wallet?.xp ?? 0),
    }),
  );
});

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const params = DeletePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "المنشور غير موجود" });
    return;
  }
  if (existing.userId !== userId && !(await isAdminUserId(userId))) {
    res.status(403).json({ error: "فقط صاحب المنشور يمكنه حذفه" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(postLikesTable).where(eq(postLikesTable.postId, params.data.id));
    await tx.delete(postsTable).where(eq(postsTable.id, params.data.id));
  });
  res.sendStatus(204);
});

router.post("/posts/:id/like", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const params = TogglePostLikeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const postId = params.data.id;
  const [post] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);
  if (!post) {
    res.status(404).json({ error: "المنشور غير موجود" });
    return;
  }

  const [mine] = await db
    .select({ id: postLikesTable.id })
    .from(postLikesTable)
    .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId)))
    .limit(1);

  if (mine) {
    await db.delete(postLikesTable).where(eq(postLikesTable.id, mine.id));
  } else {
    await db
      .insert(postLikesTable)
      .values({ postId, userId })
      .onConflictDoNothing();
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, postId));

  res.json(
    TogglePostLikeResponse.parse({ postId, likeCount: count, likedByMe: !mine }),
  );
});

export default router;
