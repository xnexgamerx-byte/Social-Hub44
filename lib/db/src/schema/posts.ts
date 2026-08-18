import { pgTable, serial, text, timestamp, index, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// "اللحظات" — short user posts with optional images.
export const postsTable = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    // display snapshots so the feed renders without extra joins
    authorName: text("author_name").notNull().default(""),
    authorAvatar: text("author_avatar").notNull().default(""),
    text: text("text").notNull().default(""),
    images: text("images").array().notNull().default([]),
    tag: text("tag").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("posts_created_at_idx").on(table.createdAt),
    index("posts_user_id_idx").on(table.userId),
  ],
);

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;

// One row per (post, user). The unique pair makes liking idempotent and lets
// the feed report both the total and whether the caller already liked it.
export const postLikesTable = pgTable(
  "post_likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("post_likes_pair_idx").on(table.postId, table.userId),
    index("post_likes_post_idx").on(table.postId),
  ],
);

export type PostLike = typeof postLikesTable.$inferSelect;
