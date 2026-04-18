import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, cyclesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/summary", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);

  const statuses = ["done", "in_progress", "up_next", "backlog", "blocked", "new_request"] as const;

  const countByStatus = {
    done: 0, in_progress: 0, up_next: 0, backlog: 0, blocked: 0, new_request: 0,
  };
  const pointsByStatus = {
    done: 0, in_progress: 0, up_next: 0, backlog: 0, blocked: 0, new_request: 0,
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

  const activeProjects = projects.filter(
    (p) => p.status === "in_progress" || p.status === "up_next",
  );
  const activePoints = activeProjects.reduce((sum, p) => sum + (p.storyPoints ?? 0), 0);
  const maxCapacity = 100;
  const capacityPercentage = Math.min(Math.round((activePoints / Math.max(maxCapacity, 1)) * 100), 100);

  const now = new Date().toISOString().split("T")[0];
  const allCycles = await db.select().from(cyclesTable);
  const activeCycleRow = allCycles.find(
    (c) => c.startDate <= now && c.endDate >= now,
  ) ?? allCycles[allCycles.length - 1] ?? null;

  const activeCycle = activeCycleRow
    ? {
        id: activeCycleRow.id,
        name: activeCycleRow.name,
        startDate: activeCycleRow.startDate,
        endDate: activeCycleRow.endDate,
      }
    : null;

  res.json({
    totalProjects: projects.length,
    totalStoryPoints,
    pointsByStatus,
    countByStatus,
    capacityPercentage,
    activeCycle,
  });
});

export default router;
