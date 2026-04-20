import { pgTable, serial, integer, text, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sprintsTable } from "./sprints";

export const SUB_TEAMS = ["a3", "backend", "frontend"] as const;
export type SubTeam = typeof SUB_TEAMS[number];

export const sprintCapacityTable = pgTable("sprint_capacity", {
  id: serial("id").primaryKey(),
  sprintId: integer("sprint_id").notNull().references(() => sprintsTable.id, { onDelete: "cascade" }),
  subTeam: text("sub_team").notNull().$type<SubTeam>(),
  capacityPoints: integer("capacity_points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sprintSubTeamUniq: unique("sprint_capacity_sprint_id_sub_team_key").on(t.sprintId, t.subTeam),
  subTeamCheck: check("sprint_capacity_sub_team_check", sql`${t.subTeam} IN ('a3', 'backend', 'frontend')`),
  capacityPointsCheck: check("sprint_capacity_points_non_neg", sql`${t.capacityPoints} >= 0`),
}));

export const insertSprintCapacitySchema = createInsertSchema(sprintCapacityTable).omit({ id: true, createdAt: true });
export type InsertSprintCapacity = z.infer<typeof insertSprintCapacitySchema>;
export type SprintCapacity = typeof sprintCapacityTable.$inferSelect;
