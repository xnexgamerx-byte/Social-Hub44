import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Records every RevenueCat purchase that has already been redeemed for coins.
// The unique `rcPurchaseId` is the idempotency guard: a confirmed purchase can
// only ever credit the wallet once, even under retries or concurrent requests.
export const rechargePurchasesTable = pgTable("recharge_purchases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  // RevenueCat purchase / store transaction identifier.
  rcPurchaseId: text("rc_purchase_id").notNull().unique(),
  packageId: integer("package_id").notNull(),
  coinsGranted: integer("coins_granted").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRechargePurchaseSchema = createInsertSchema(
  rechargePurchasesTable,
).omit({ id: true, createdAt: true });
export type InsertRechargePurchase = z.infer<typeof insertRechargePurchaseSchema>;
export type RechargePurchase = typeof rechargePurchasesTable.$inferSelect;
