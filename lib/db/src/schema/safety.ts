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

/**
 * A one-way block. Enforcement is symmetric in effect — neither side can DM
 * the other once a block exists in either direction — but the row records who
 * actually initiated it so it can be lifted by that person only.
 */
export const blocksTable = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("blocks_pair_idx").on(table.blockerId, table.blockedId),
    index("blocks_blocked_idx").on(table.blockedId),
  ],
);

export const insertBlockSchema = createInsertSchema(blocksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocksTable.$inferSelect;

/**
 * User reports. Stores enough context to act after the fact — the offending
 * text is snapshotted, because the author can delete the original.
 */
export const reportsTable = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: text("reporter_id").notNull(),
    // user | room | post | message
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    targetUserId: text("target_user_id").notNull().default(""),
    reason: text("reason").notNull(),
    note: text("note").notNull().default(""),
    // snapshot of the reported content at report time
    snapshot: text("snapshot").notNull().default(""),
    // open | actioned | dismissed
    status: text("status").notNull().default("open"),
    reviewedBy: text("reviewed_by").notNull().default(""),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_status_idx").on(table.status, table.createdAt),
    index("reports_target_user_idx").on(table.targetUserId),
  ],
);

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;

/**
 * Account-level suspension. `expiresAt` null means permanent. Checked on every
 * authenticated request and on the socket handshake, so a ban takes effect on
 * the banned user's next action rather than their next login.
 */
export const bansTable = pgTable(
  "bans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    reason: text("reason").notNull().default(""),
    bannedBy: text("banned_by").notNull().default(""),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("bans_user_idx").on(table.userId)],
);

export const insertBanSchema = createInsertSchema(bansTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBan = z.infer<typeof insertBanSchema>;
export type Ban = typeof bansTable.$inferSelect;

/**
 * Per-room removal. Persisted rather than kept in memory so a kick survives a
 * server restart — otherwise a redeploy quietly readmits everyone.
 */
export const roomKicksTable = pgTable(
  "room_kicks",
  {
    id: serial("id").primaryKey(),
    roomId: text("room_id").notNull(),
    userId: text("user_id").notNull(),
    kickedBy: text("kicked_by").notNull().default(""),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("room_kicks_pair_idx").on(table.roomId, table.userId)],
);

export type RoomKick = typeof roomKicksTable.$inferSelect;

/** Reasons offered in the report sheet; kept server-side as the source of truth. */
export const REPORT_REASONS = [
  "harassment",
  "sexual",
  "spam",
  "scam",
  "hate",
  "underage",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
