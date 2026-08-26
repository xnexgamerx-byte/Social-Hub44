import { eq } from "drizzle-orm";
import { db, followsTable } from "@workspace/db";
import { logger } from "./logger";
import { pushToUser } from "./push";
import { getSettings, settingsForUsers } from "./settings";

/**
 * Upper bound on how many followers one new moment notifies. A popular account
 * should not turn a single post into an unbounded fan-out on a free tier; the
 * feed still shows the post to everyone either way.
 */
const MAX_FANOUT = 500;

/** Trim a body to something a notification tray can actually show. */
function preview(text: string, fallback: string): string {
  const clean = text.trim();
  if (!clean) return fallback;
  return clean.length > 90 ? `${clean.slice(0, 90)}…` : clean;
}

/**
 * Tell the author someone liked their moment.
 *
 * Fire-and-forget: a notification must never fail or delay the like itself,
 * which is why every caller `void`s this and errors are swallowed here.
 */
export async function notifyPostLiked(params: {
  authorId: string;
  likerId: string;
  likerName: string;
  postId: number;
}): Promise<void> {
  const { authorId, likerId, likerName, postId } = params;
  // Liking your own post is not news.
  if (authorId === likerId) return;
  try {
    if (!(await getSettings(authorId)).notifyLikes) return;
    await pushToUser(authorId, {
      title: likerName || "إعجاب جديد",
      body: "أعجب بلحظتك",
      data: { type: "post_like", postId },
    });
  } catch (err) {
    logger.error({ err, authorId, postId }, "Failed to notify post like");
  }
}

/**
 * Tell an author's followers they posted a new moment. Followers who turned
 * moment alerts off are skipped, and settings are read in one query rather
 * than one per follower.
 */
export async function notifyNewMoment(params: {
  authorId: string;
  authorName: string;
  postId: number;
  text: string;
}): Promise<void> {
  const { authorId, authorName, postId, text } = params;
  try {
    const rows = await db
      .select({ followerId: followsTable.followerId })
      .from(followsTable)
      .where(eq(followsTable.followedId, authorId))
      .limit(MAX_FANOUT);
    if (rows.length === 0) return;

    const ids = rows.map((r) => r.followerId);
    const settings = await settingsForUsers(ids);
    const targets = ids.filter((id) => settings.get(id)?.notifyMoments !== false);

    await Promise.all(
      targets.map((id) =>
        pushToUser(id, {
          title: authorName || "لحظة جديدة",
          body: preview(text, "نشر لحظة جديدة"),
          data: { type: "new_moment", postId },
        }),
      ),
    );
  } catch (err) {
    logger.error({ err, authorId, postId }, "Failed to notify new moment");
  }
}
