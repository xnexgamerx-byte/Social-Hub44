import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dmMessagesTable = pgTable(
  "dm_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    fromUserId: text("from_user_id").notNull(),
    fromName: text("from_name").notNull().default(""),
    fromAvatar: text("from_avatar").notNull().default(""),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("dm_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  ],
);

export const insertDmMessageSchema = createInsertSchema(dmMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDmMessage = z.infer<typeof insertDmMessageSchema>;
export type DmMessage = typeof dmMessagesTable.$inferSelect;
