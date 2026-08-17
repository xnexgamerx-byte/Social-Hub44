import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per user pair. The pair is stored canonically (userAId < userBId,
// lexicographic) so a conversation between two users is always a single row
// regardless of who started it.
export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    // display snapshots so the inbox renders without Clerk lookups
    userAName: text("user_a_name").notNull().default(""),
    userAAvatar: text("user_a_avatar").notNull().default(""),
    userBName: text("user_b_name").notNull().default(""),
    userBAvatar: text("user_b_avatar").notNull().default(""),
    lastText: text("last_text").notNull().default(""),
    lastFromId: text("last_from_id").notNull().default(""),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
    // per-side unread counters, reset when that side opens the conversation
    unreadA: integer("unread_a").notNull().default(0),
    unreadB: integer("unread_b").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("conversations_pair_idx").on(table.userAId, table.userBId),
    index("conversations_user_a_last_idx").on(table.userAId, table.lastAt),
    index("conversations_user_b_last_idx").on(table.userBId, table.lastAt),
  ],
);

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
