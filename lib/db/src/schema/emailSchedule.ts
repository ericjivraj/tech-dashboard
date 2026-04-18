import { pgTable, serial, boolean, integer, text, timestamp } from "drizzle-orm/pg-core";

export const emailScheduleTable = pgTable("email_schedule", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  dayOfWeek: integer("day_of_week").notNull().default(1),
  hour: integer("hour").notNull().default(8),
  recipients: text("recipients").notNull().default(""),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type EmailSchedule = typeof emailScheduleTable.$inferSelect;
