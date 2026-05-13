import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Per-username password hash store. Hybrid auth model: TD_ADMIN_ACCOUNTS env
// var defines who is a valid admin (username allowlist + first-login
// passwords). When a user changes their password via the UI, a row is
// upserted here with the bcrypt hash; subsequent logins prefer the DB hash
// over the env var's plaintext for that username.
//
// Rotating the team via Doppler still works (add/remove usernames). To force
// an individual to re-login with the env-var password, delete their row here.
export const adminCredentialsTable = pgTable("admin_credentials", {
  username: text("username").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminCredentials = typeof adminCredentialsTable.$inferSelect;
