import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Directory of app users. Clerk owns authentication, but it is not queryable
// as a feed source, so the app mirrors the display fields here on sign-in.
// Every write is keyed to the authenticated user id — a client can only ever
// upsert its own row.
export const profilesTable = pgTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    name: text("name").notNull().default(""),
    avatar: text("avatar").notNull().default(""),
    bio: text("bio").notNull().default(""),
    // "" | male | female
    gender: text("gender").notNull().default(""),
    age: integer("age").notNull().default(0),
    country: text("country").notNull().default(""),
    // Official app account — shown with a verified badge and never presented
    // as a private individual. Set server-side only.
    isOfficial: boolean("is_official").notNull().default(false),
    // Paid host badge, mirrored from the hosts table for cheap list rendering.
    isHost: boolean("is_host").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("profiles_last_seen_idx").on(table.lastSeenAt)],
);

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
