import { pgTable, serial, text, bigint, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Voice minutes consumed, one row per calendar month.
 *
 * Agora bills per participant per minute, not per channel, and everyone who
 * opens a room joins the channel as a listener — so a ten-person room burns
 * ten minutes of allowance for every minute it runs. That is easy to
 * under-estimate until a bill arrives, which is what this exists to prevent.
 *
 * Seconds rather than minutes: sessions are short and rounding each one up to
 * a minute would drift high enough to make the number useless.
 */
export const voiceUsageTable = pgTable("voice_usage", {
  id: serial("id").primaryKey(),
  // Calendar month in UTC, "YYYY-MM" — the period Agora's allowance resets on.
  period: text("period").notNull().unique(),
  // Participant-seconds, summed across everyone in every room.
  seconds: bigint("seconds", { mode: "number" }).notNull().default(0),
  /**
   * Highest allowance percentage already announced to the admins, so crossing
   * a threshold notifies once rather than on every session that follows.
   */
  alertedAtPercent: integer("alerted_at_percent").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertVoiceUsageSchema = createInsertSchema(voiceUsageTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertVoiceUsage = z.infer<typeof insertVoiceUsageSchema>;
export type VoiceUsage = typeof voiceUsageTable.$inferSelect;
