import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Scheduled sessions inside a room. A fixed time gives people a reason to show
 * up together — the cheapest way to make a young app feel populated.
 */
export const roomEventsTable = pgTable(
  "room_events",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    // 0=Sunday .. 6=Saturday for a weekly slot; -1 for a one-off
    weekday: integer("weekday").notNull().default(-1),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("room_events_starts_at_idx").on(table.startsAt)],
);

export const insertRoomEventSchema = createInsertSchema(roomEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRoomEvent = z.infer<typeof insertRoomEventSchema>;
export type RoomEvent = typeof roomEventsTable.$inferSelect;
