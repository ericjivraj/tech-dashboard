import { pgTable, integer, numeric, timestamp, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { sprintsTable } from "./sprints";

// One row per (project, sprint) — captures what fraction of a given sprint's
// capacity a project is expected to consume. A project that runs through
// multiple sprints has multiple rows here; the project's Gantt bar spans
// from min(sprint.start) to max(sprint.end) across them.
export const projectSprintCapacityAllocationsTable = pgTable(
  "project_sprint_capacity_allocations",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    sprintId: integer("sprint_id")
      .notNull()
      .references(() => sprintsTable.id, { onDelete: "cascade" }),
    allocationPercent: numeric("allocation_percent", { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.sprintId] }),
    rangeCheck: check(
      "project_sprint_capacity_alloc_pct_range",
      sql`${t.allocationPercent} >= 0 AND ${t.allocationPercent} <= 100`,
    ),
  }),
);

export const insertProjectSprintCapacityAllocationSchema = createInsertSchema(projectSprintCapacityAllocationsTable).omit({ createdAt: true });
export type InsertProjectSprintCapacityAllocation = z.infer<typeof insertProjectSprintCapacityAllocationSchema>;
export type ProjectSprintCapacityAllocation = typeof projectSprintCapacityAllocationsTable.$inferSelect;
