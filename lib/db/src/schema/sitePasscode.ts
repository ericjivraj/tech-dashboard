import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

// Single-row table (id fixed at 1) holding the optional site-wide passcode
// gate's hashed password. Not currently wired up to any route — this schema
// exists to match the table already present in the database (created by
// migration 0011) so drizzle-kit's diff engine has a declared source for it.
export const sitePasscodeTable = pgTable("site_passcode", {
  id: integer("id").primaryKey().default(1),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SitePasscode = typeof sitePasscodeTable.$inferSelect;
