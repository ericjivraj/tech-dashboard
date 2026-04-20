import { pgTable, serial, integer, text, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { sprintsTable } from "./sprints";
import { SUB_TEAMS, type SubTeam } from "./sprintCapacity";

export const projectSprintAllocationsTable = pgTable("project_sprint_allocations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sprintId: integer("sprint_id").notNull().references(() => sprintsTable.id, { onDelete: "cascade" }),
  subTeam: text("sub_team").notNull().$type<SubTeam>(),
  storyPoints: integer("story_points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectSprintSubTeamUniq: unique("project_sprint_alloc_project_sprint_sub_team_key").on(t.projectId, t.sprintId, t.subTeam),
  subTeamCheck: check("project_sprint_alloc_sub_team_check", sql`${t.subTeam} IN ('a3', 'backend', 'frontend')`),
  storyPointsCheck: check("project_sprint_alloc_story_points_non_neg", sql`${t.storyPoints} >= 0`),
}));

export const insertProjectSprintAllocationSchema = createInsertSchema(projectSprintAllocationsTable).omit({ id: true, createdAt: true });
export type InsertProjectSprintAllocation = z.infer<typeof insertProjectSprintAllocationSchema>;
export type ProjectSprintAllocation = typeof projectSprintAllocationsTable.$inferSelect;

export { SUB_TEAMS, type SubTeam };
