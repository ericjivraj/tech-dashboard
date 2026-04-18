import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { goalsTable } from "./goals";

export const projectGoalsTable = pgTable(
  "project_goals",
  {
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    goalId: integer("goal_id").notNull().references(() => goalsTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.goalId] })]
);
