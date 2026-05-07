import { pgTable, text, serial, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cyclesTable } from "./cycles";
import { sprintsTable } from "./sprints";

export const PROJECT_STATUSES = ["done", "in_progress", "up_next", "backlog", "new_request"] as const;
export const RAG_STATUSES = ["green", "amber", "red"] as const;
export type RagStatus = (typeof RAG_STATUSES)[number];

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  functionName: text("function_name"),
  team: text("team"),
  status: text("status").notNull().default("backlog"),
  storyPoints: integer("story_points"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  sponsor: text("sponsor"),
  impact: text("impact"),
  cycleId: integer("cycle_id").references(() => cyclesTable.id, { onDelete: "set null" }),
  sprintId: integer("sprint_id").references(() => sprintsTable.id, { onDelete: "set null" }),
  ragStatus: text("rag_status").notNull().default("green").$type<RagStatus>(),
  displayOrder: integer("display_order").notNull().default(0),
  listOrder: integer("list_order").notNull().default(0),
  timelineOrder: integer("timeline_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
