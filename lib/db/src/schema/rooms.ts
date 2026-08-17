import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomsTable = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // chat | gaming | music | family
    category: text("category").notNull().default("chat"),
    // Clerk user id of the room creator; owner-only edits are enforced server-side
    ownerId: text("owner_id").notNull(),
    ownerName: text("owner_name").notNull().default(""),
    ownerAvatar: text("owner_avatar").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("rooms_owner_id_idx").on(table.ownerId)],
);

export const insertRoomSchema = createInsertSchema(roomsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
