import { pgTable, serial, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per successful invite. `referredId` is unique, so an account can
 * only ever be claimed once — the reward cannot be farmed by re-entering codes.
 */
export const referralsTable = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    referrerId: text("referrer_id").notNull(),
    referredId: text("referred_id").notNull(),
    // the inviter's public account id, recorded as typed
    code: text("code").notNull(),
    referrerReward: integer("referrer_reward").notNull().default(0),
    referredReward: integer("referred_reward").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("referrals_referred_idx").on(table.referredId),
    index("referrals_referrer_idx").on(table.referrerId),
  ],
);

export const insertReferralSchema = createInsertSchema(referralsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;
