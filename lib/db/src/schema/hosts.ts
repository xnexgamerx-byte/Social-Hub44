import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Paid hosts — real people the app compensates for keeping rooms lively.
 * This is the legitimate answer to an empty app: staff it with humans who are
 * paid for their time, never with accounts that pretend to be someone else.
 */
export const hostsTable = pgTable(
  "hosts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    // extra cut of gift value on top of the base share, in percent
    bonusSharePercent: integer("bonus_share_percent").notNull().default(0),
    active: boolean("active").notNull().default(true),
    addedBy: text("added_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("hosts_user_idx").on(table.userId)],
);

export const insertHostSchema = createInsertSchema(hostsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHost = z.infer<typeof insertHostSchema>;
export type Host = typeof hostsTable.$inferSelect;

/** Closed stints of a host sitting in a room, used to compute paid hours. */
export const hostSessionsTable = pgTable(
  "host_sessions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    roomId: text("room_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    minutes: integer("minutes").notNull().default(0),
  },
  (table) => [index("host_sessions_user_idx").on(table.userId, table.startedAt)],
);

export type HostSession = typeof hostSessionsTable.$inferSelect;
