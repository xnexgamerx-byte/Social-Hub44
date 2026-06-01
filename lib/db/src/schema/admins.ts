import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * App-managed admins. Authorization resolves a user's email and treats them as
 * an admin if their email is listed here (or in the ADMIN_EMAILS bootstrap env).
 * Storing by email keeps it consistent with ADMIN_EMAILS and works even if the
 * granted user signs up only after being added.
 */
export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  // lowercased email of the admin
  email: text("email").notNull().unique(),
  // resolved Clerk user id when known (best-effort, may be "")
  userId: text("user_id").notNull().default(""),
  // email of the admin who granted this access
  addedBy: text("added_by").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminSchema = createInsertSchema(adminsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof adminsTable.$inferSelect;
