import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vipTiersTable = pgTable("vip_tiers", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull(),
  // vip | svip
  type: text("type").notNull().default("vip"),
  pointsRequired: bigint("points_required", { mode: "number" })
    .notNull()
    .default(0),
  // theme color for badge rendering
  color: text("color").notNull().default("#C9972B"),
  // array of vip_features.key granted at this tier
  features: text("features").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertVipTierSchema = createInsertSchema(vipTiersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVipTier = z.infer<typeof insertVipTierSchema>;
export type VipTier = typeof vipTiersTable.$inferSelect;
