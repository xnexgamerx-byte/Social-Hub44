import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-user preferences. One row per account, created lazily on first read.
 *
 * Deliberately narrow: every column here is enforced somewhere in the server.
 * Settings whose feature does not exist yet (visitor alerts, call alerts,
 * SoulLink, distance hiding, guards) are NOT stored — a switch the user can
 * flip that changes nothing reads as a broken app, so each one lands together
 * with the feature behind it.
 *
 * Every column is NOT NULL with a default because migrations are applied with
 * `drizzle-kit push` against a populated database.
 */
export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),

  // Push notifications. "all" delivers, "none" silences.
  // Enforced in lib/socket.ts before pushToUser on a new direct message.
  notifyDm: text("notify_dm").notNull().default("all"),

  // Someone liked one of my moments. Enforced in routes/posts.ts.
  notifyLikes: boolean("notify_likes").notNull().default(true),

  // Someone I follow posted a new moment. Enforced in routes/posts.ts.
  notifyMoments: boolean("notify_moments").notNull().default(true),

  // Someone opened my profile. Enforced in routes/profiles.ts.
  notifyVisitors: boolean("notify_visitors").notNull().default(true),

  // Who may open a direct message with this user.
  // "all" | "following" (only accounts this user follows) | "none".
  // Enforced in lib/dm.ts sendDm. The official account always bypasses it.
  whoCanDm: text("who_can_dm").notNull().default("all"),

  // Suppress the online dot everywhere. Enforced in routes/profiles.ts.
  hideOnline: boolean("hide_online").notNull().default(false),

  // Join rooms without playing the equipped entrance effect.
  // Enforced in lib/socket.ts on room join.
  invisibleRoomEntry: boolean("invisible_room_entry").notNull().default(false),

  // Browse profiles without appearing in anyone's visitors list.
  // Enforced in routes/profiles.ts before a visit is recorded.
  invisibleBrowsing: boolean("invisible_browsing").notNull().default(false),

  // UI language. Only "ar" is implemented today; the column exists so the
  // preference survives the app build that adds a second language.
  language: text("language").notNull().default("ar"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettingsTable.$inferSelect;
