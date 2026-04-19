import { pgTable, text, serial, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cyclesTable } from "./cycles";
import { sprintsTable } from "./sprints";

export const PROJECT_STATUSES = ["done", "in_progress", "up_next", "backlog", "blocked", "new_request"] as const;
export const CONFIDENCE_LEVELS = ["high", "medium", "low", "at_risk"] as const;

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  sponsor: text("sponsor"),
  team: text("team"),
  status: text("status").notNull().default("backlog"),
  confidence: text("confidence"),
  storyPoints: integer("story_points"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  stakeholder: text("stakeholder"),
  impact: text("impact"),
  blockedReason: text("blocked_reason"),
  cycleId: integer("cycle_id").references(() => cyclesTable.id, { onDelete: "set null" }),
  sprintId: integer("sprint_id").references(() => sprintsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
