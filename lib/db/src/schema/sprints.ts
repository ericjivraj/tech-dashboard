import { pgTable, text, serial, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cyclesTable } from "./cycles";

export const sprintsTable = pgTable("sprints", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cycleId: integer("cycle_id").notNull().references(() => cyclesTable.id, { onDelete: "cascade" }),
  sprintNumber: integer("sprint_number").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSprintSchema = createInsertSchema(sprintsTable).omit({ id: true, createdAt: true });
export type InsertSprint = z.infer<typeof insertSprintSchema>;
export type Sprint = typeof sprintsTable.$inferSelect;
