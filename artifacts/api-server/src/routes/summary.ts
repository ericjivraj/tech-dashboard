import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, sprintsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/summary", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);

  const statuses = ["done", "in_progress", "up_next", "backlog", "new_request"] as const;

  const countByStatus = {
    done: 0, in_progress: 0, up_next: 0, backlog: 0, new_request: 0,
  };
  const pointsByStatus = {
    done: 0, in_progress: 0, up_next: 0, backlog: 0, new_request: 0,
  };

  let totalStoryPoints = 0;
  for (const p of projects) {
    const s = p.status as typeof statuses[number];
    if (statuses.includes(s)) {
      countByStatus[s]++;
      const pts = p.storyPoints ?? 0;
      pointsByStatus[s] += pts;
      totalStoryPoints += pts;
    }
  }

  const now = new Date().toISOString().split("T")[0];
  const allSprints = await db.select().from(sprintsTable);
  const sortedSprints = [...allSprints].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const activeSprintRow = sortedSprints.find(
    (s) => s.startDate <= now && s.endDate >= now,
  ) ?? sortedSprints[sortedSprints.length - 1] ?? null;

  const activeSprint = activeSprintRow
    ? {
        id: activeSprintRow.id,
        name: activeSprintRow.name,
        sprintNumber: activeSprintRow.sprintNumber,
        startDate: activeSprintRow.startDate,
        endDate: activeSprintRow.endDate,
      }
    : null;

  res.json({
    totalProjects: projects.length,
    totalStoryPoints,
    pointsByStatus,
    countByStatus,
    activeSprint,
  });
});

export default router;
