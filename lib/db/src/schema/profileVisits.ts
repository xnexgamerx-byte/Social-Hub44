import { pgTable, serial, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Who looked at whose profile, and when.
 *
 * One row per (visitor, profile) pair rather than one per view: the visitors
 * list shows people, not a repeated log, so a repeat visit updates the
 * timestamp instead of growing the table without bound.
 */
export const profileVisitsTable = pgTable(
  "profile_visits",
  {
    id: serial("id").primaryKey(),
    // Whose profile was opened.
    profileUserId: text("profile_user_id").notNull(),
    // Who opened it.
    visitorUserId: text("visitor_user_id").notNull(),
    visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("profile_visits_pair_unique").on(table.profileUserId, table.visitorUserId),
    // Drives the visitors list: newest first for one profile.
    index("profile_visits_profile_idx").on(table.profileUserId, table.visitedAt),
  ],
);

export const insertProfileVisitSchema = createInsertSchema(profileVisitsTable).omit({
  id: true,
});
export type InsertProfileVisit = z.infer<typeof insertProfileVisitSchema>;
export type ProfileVisit = typeof profileVisitsTable.$inferSelect;
