import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vipFeaturesTable = pgTable("vip_features", {
  id: serial("id").primaryKey(),
  // stable identifier used by tiers to reference this feature
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  // Ionicons name
  icon: text("icon").notNull().default("star"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertVipFeatureSchema = createInsertSchema(vipFeaturesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVipFeature = z.infer<typeof insertVipFeatureSchema>;
export type VipFeature = typeof vipFeaturesTable.$inferSelect;
