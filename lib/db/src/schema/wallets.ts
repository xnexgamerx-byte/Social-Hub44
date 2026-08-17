import {
  pgTable,
  serial,
  text,
  bigint,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  // keyed to the existing app user id
  userId: text("user_id").notNull().unique(),
  // short, human-friendly public account id shown in the profile and used by
  // the owner to send coins to a specific account. Unique 8-digit string.
  publicId: text("public_id").unique(),
  // كوينزات (coins) balance
  coins: bigint("coins", { mode: "number" }).notNull().default(0),
  // نقاط / ماسات (vPoints / diamonds) balance
  vPoints: bigint("v_points", { mode: "number" }).notNull().default(0),
  // Server-validated VIP status: level 0 + "" means no VIP. Activation is
  // gated on vPoints reaching the tier's pointsRequired (see /wallet/:id/vip).
  vipLevel: integer("vip_level").notNull().default(0),
  // "" | vip | svip
  vipType: text("vip_type").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
