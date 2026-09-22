import { pgTable, integer, text, date, timestamp, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

// The three lifecycle stages that can be individually scheduled — reuses the
// same string literals as project.status so stage labels/colors can be
// looked up directly from STATUS_LABELS/STATUS_COLORS with no translation.
export const PROJECT_STAGES = ["backlog", "up_next", "in_progress"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

// One row per (project, stage) — the planned date window for that stage of
// the project's lifecycle (e.g. Pre-Discovery in Sprint 31, Discovery in
// Sprint 32). A project has at most one schedule row per stage.
export const projectStageSchedulesTable = pgTable(
  "project_stage_schedules",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().$type<ProjectStage>(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.stage] }),
    stageCheck: check(
      "project_stage_schedules_stage_valid",
      sql`${t.stage} IN ('backlog','up_next','in_progress')`,
    ),
  }),
);

export const insertProjectStageScheduleSchema = createInsertSchema(projectStageSchedulesTable).omit({ createdAt: true });
export type InsertProjectStageSchedule = z.infer<typeof insertProjectStageScheduleSchema>;
export type ProjectStageSchedule = typeof projectStageSchedulesTable.$inferSelect;
