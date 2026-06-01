import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userItemsTable = pgTable(
  "user_items",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    itemId: integer("item_id").notNull(),
    // equipped frame/entrance/etc — at most one equipped per item type
    equipped: boolean("equipped").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userItemUnique: unique("user_items_user_item_unique").on(t.userId, t.itemId),
  }),
);

export const insertUserItemSchema = createInsertSchema(userItemsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUserItem = z.infer<typeof insertUserItemSchema>;
export type UserItem = typeof userItemsTable.$inferSelect;
