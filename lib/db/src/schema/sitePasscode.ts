import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

// Single-row table holding the bcrypt hash of the site passcode. The id is
// always 1 (constrained to a single row). Seeded from TD_SITE_PASSCODE on
// first startup if empty; rotated by admins via the admin panel.
//
// The hash is verified server-side by POST /api/passcode/verify so the value
// never appears in the JS bundle. If the table is empty, no passcode is
// required (fail-open, matches the legacy "no passcode configured" path).
export const sitePasscodeTable = pgTable("site_passcode", {
  id: integer("id").primaryKey().notNull().default(1),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SitePasscode = typeof sitePasscodeTable.$inferSelect;
