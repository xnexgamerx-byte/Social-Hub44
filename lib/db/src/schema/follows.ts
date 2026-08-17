import { pgTable, serial, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const followsTable = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: text("follower_id").notNull(),
    followedId: text("followed_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("follows_pair_idx").on(table.followerId, table.followedId),
    index("follows_followed_idx").on(table.followedId),
    index("follows_follower_idx").on(table.followerId),
  ],
);

export const insertFollowSchema = createInsertSchema(followsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;
