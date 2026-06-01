import {
  pgTable,
  serial,
  text,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  // coins | V
  currency: text("currency").notNull().default("coins"),
  // signed: positive = credit, negative = debit
  amount: bigint("amount", { mode: "number" }).notNull(),
  balanceAfter: bigint("balance_after", { mode: "number" }).notNull().default(0),
  // recharge | purchase | gift_sent | gift_received | task_reward | adjust
  type: text("type").notNull(),
  description: text("description").notNull().default(""),
  // optional reference id (item/package/task id, or peer user id)
  refId: text("ref_id").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(
  walletTransactionsTable,
).omit({ id: true, createdAt: true });
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
