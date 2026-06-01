import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyTaskClaimsTable = pgTable(
  "daily_task_claims",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    taskId: integer("task_id").notNull(),
    // YYYY-MM-DD of the claim, to allow one claim per task per day
    claimedOn: text("claimed_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    claimUnique: unique("daily_task_claims_unique").on(
      t.userId,
      t.taskId,
      t.claimedOn,
    ),
  }),
);

export const insertDailyTaskClaimSchema = createInsertSchema(
  dailyTaskClaimsTable,
).omit({ id: true, createdAt: true });
export type InsertDailyTaskClaim = z.infer<typeof insertDailyTaskClaimSchema>;
export type DailyTaskClaim = typeof dailyTaskClaimsTable.$inferSelect;
