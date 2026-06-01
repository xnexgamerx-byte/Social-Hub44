import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Append-only audit trail of admin grant/revoke actions. Records survive even
 * after the corresponding `admins` row is deleted, so the history of who was
 * made (or removed as) an admin — and by whom — is preserved permanently.
 */
export const adminAuditTable = pgTable("admin_audit", {
  id: serial("id").primaryKey(),
  // "grant" | "revoke"
  action: text("action").notNull(),
  // lowercased email of the admin who was granted/revoked
  targetEmail: text("target_email").notNull(),
  // email of the admin who performed the action (may be "" if unresolved)
  actorEmail: text("actor_email").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminAuditSchema = createInsertSchema(adminAuditTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminAudit = z.infer<typeof insertAdminAuditSchema>;
export type AdminAudit = typeof adminAuditTable.$inferSelect;
