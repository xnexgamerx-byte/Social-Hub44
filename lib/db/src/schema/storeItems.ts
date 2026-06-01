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

export const storeItemsTable = pgTable("store_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // إطارات | الدخوليات | الخلفيات | رمز | بطاقة الإسترجاع
  category: text("category").notNull(),
  // first-class item kind: frame | entrance | gift | background | symbol | recovery | other
  itemType: text("item_type").notNull().default("frame"),
  // vip | svip | coins | pieces
  section: text("section").notNull().default("vip"),
  imageUrl: text("image_url").notNull().default(""),
  // animation/media URL (Lottie JSON, GIF, or remote video) for entrances/gifts previews
  mediaUrl: text("media_url").notNull().default(""),
  // gradient/icon fallback rendering hints
  color: text("color").notNull().default("#7C5CFC"),
  icon: text("icon").notNull().default("ellipse"),
  price: integer("price").notNull().default(0),
  // V (نقاط) | coins (عملات)
  currency: text("currency").notNull().default("V"),
  vipRequired: integer("vip_required").notNull().default(0),
  durationDays: integer("duration_days").notNull().default(3),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertStoreItemSchema = createInsertSchema(storeItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStoreItem = z.infer<typeof insertStoreItemSchema>;
export type StoreItem = typeof storeItemsTable.$inferSelect;
