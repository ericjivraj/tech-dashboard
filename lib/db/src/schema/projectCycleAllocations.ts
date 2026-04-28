import { pgTable, integer, numeric, timestamp, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { cyclesTable } from "./cycles";

// One row per (project, cycle) — captures what fraction of a given cycle's
// capacity a project is expected to consume. A project that runs through
// multiple cycles has multiple rows here; the project's Gantt bar spans
// from min(cycle.start) to max(cycle.end) across them.
export const projectCycleAllocationsTable = pgTable(
  "project_cycle_allocations",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    cycleId: integer("cycle_id")
      .notNull()
      .references(() => cyclesTable.id, { onDelete: "cascade" }),
    allocationPercent: numeric("allocation_percent", { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.cycleId] }),
    rangeCheck: check(
      "project_cycle_alloc_pct_range",
      sql`${t.allocationPercent} >= 0 AND ${t.allocationPercent} <= 100`,
    ),
  }),
);

export const insertProjectCycleAllocationSchema = createInsertSchema(projectCycleAllocationsTable).omit({ createdAt: true });
export type InsertProjectCycleAllocation = z.infer<typeof insertProjectCycleAllocationSchema>;
export type ProjectCycleAllocation = typeof projectCycleAllocationsTable.$inferSelect;
