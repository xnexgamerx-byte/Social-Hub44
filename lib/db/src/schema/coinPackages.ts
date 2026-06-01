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

export const coinPackagesTable = pgTable("coin_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  // coins granted on recharge
  coins: integer("coins").notNull().default(0),
  // extra bonus coins
  bonus: integer("bonus").notNull().default(0),
  // display price label, e.g. "$0.99" or "9.99 ر.س"
  price: text("price").notNull().default(""),
  // RevenueCat product store identifier this package maps to (e.g. "coins_1000").
  // The real price is configured/charged in RevenueCat keyed on this id.
  productId: text("product_id").notNull().default(""),
  color: text("color").notNull().default("#7C3AED"),
  icon: text("icon").notNull().default("logo-bitcoin"),
  // highlights the package as "الأكثر شعبية"
  popular: boolean("popular").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCoinPackageSchema = createInsertSchema(coinPackagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCoinPackage = z.infer<typeof insertCoinPackageSchema>;
export type CoinPackage = typeof coinPackagesTable.$inferSelect;
