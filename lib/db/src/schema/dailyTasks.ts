import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyTasksTable = pgTable("daily_tasks", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  // coin reward granted when claimed
  reward: integer("reward").notNull().default(0),
  icon: text("icon").notNull().default("checkbox"),
  color: text("color").notNull().default("#22C55E"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDailyTaskSchema = createInsertSchema(dailyTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDailyTask = z.infer<typeof insertDailyTaskSchema>;
export type DailyTask = typeof dailyTasksTable.$inferSelect;
