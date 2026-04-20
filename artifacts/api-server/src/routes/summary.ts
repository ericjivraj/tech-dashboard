import { Router, type IRouter } from "express";
import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { projectsTable, cyclesTable, sprintsTable, projectSprintAllocationsTable, sprintCapacityTable } from "@workspace/db";

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

const CapacitySummaryQueryParams = z.object({
  cycleId: z.preprocess((v) => (v === "" || v == null || v === "null" ? undefined : v), z.coerce.number().int().positive().optional()),
  sprintId: z.preprocess((v) => (v === "" || v == null || v === "null" ? undefined : v), z.coerce.number().int().positive().optional()),
});

router.get("/capacity/summary", async (req, res): Promise<void> => {
  const parsed = CapacitySummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const cycleIdParam = parsed.data.cycleId ?? null;
  const sprintIdParam = parsed.data.sprintId ?? null;

  const subTeams = ["a3", "backend", "frontend"] as const;

  if (sprintIdParam != null) {
    const [sprint] = await db.select().from(sprintsTable).where(eq(sprintsTable.id, sprintIdParam));
    if (!sprint) {
      res.status(404).json({ error: "Sprint not found" });
      return;
    }

    const allocations = await db
      .select({
        sprintId: projectSprintAllocationsTable.sprintId,
        subTeam: projectSprintAllocationsTable.subTeam,
        storyPoints: projectSprintAllocationsTable.storyPoints,
      })
      .from(projectSprintAllocationsTable)
      .innerJoin(projectsTable, eq(projectSprintAllocationsTable.projectId, projectsTable.id))
      .where(and(eq(projectSprintAllocationsTable.sprintId, sprintIdParam), eq(projectsTable.team, "Development")));

    const capacityRows = await db
      .select()
      .from(sprintCapacityTable)
      .where(eq(sprintCapacityTable.sprintId, sprintIdParam));

    const allocated: Record<string, number> = { a3: 0, backend: 0, frontend: 0 };
    for (const a of allocations) {
      allocated[a.subTeam] = (allocated[a.subTeam] ?? 0) + a.storyPoints;
    }
    const budget: Record<string, number | null> = { a3: null, backend: null, frontend: null };
    for (const c of capacityRows) {
      budget[c.subTeam] = c.capacityPoints;
    }

    res.json({
      mode: "sprint",
      rows: [{
        id: sprint.id,
        name: sprint.name,
        a3Allocated: allocated.a3,
        a3Budget: budget.a3,
        backendAllocated: allocated.backend,
        backendBudget: budget.backend,
        frontendAllocated: allocated.frontend,
        frontendBudget: budget.frontend,
      }],
    });
    return;
  }

  if (cycleIdParam != null) {
    const cycleSprints = await db
      .select()
      .from(sprintsTable)
      .where(eq(sprintsTable.cycleId, cycleIdParam))
      .orderBy(sprintsTable.sprintNumber);

    if (cycleSprints.length === 0) {
      res.json({ mode: "sprint", rows: [] });
      return;
    }

    const sprintIds = cycleSprints.map((s) => s.id);
    const allocations = await db
      .select({
        sprintId: projectSprintAllocationsTable.sprintId,
        subTeam: projectSprintAllocationsTable.subTeam,
        storyPoints: projectSprintAllocationsTable.storyPoints,
      })
      .from(projectSprintAllocationsTable)
      .innerJoin(projectsTable, eq(projectSprintAllocationsTable.projectId, projectsTable.id))
      .where(and(inArray(projectSprintAllocationsTable.sprintId, sprintIds), eq(projectsTable.team, "Development")));

    const capacityRows = await db
      .select()
      .from(sprintCapacityTable)
      .where(inArray(sprintCapacityTable.sprintId, sprintIds));

    const rows = cycleSprints.map((sprint) => {
      const sprintAllocs = allocations.filter((a) => a.sprintId === sprint.id);
      const sprintCapRows = capacityRows.filter((c) => c.sprintId === sprint.id);

      const allocated: Record<string, number> = { a3: 0, backend: 0, frontend: 0 };
      for (const a of sprintAllocs) {
        allocated[a.subTeam] = (allocated[a.subTeam] ?? 0) + a.storyPoints;
      }
      const budget: Record<string, number | null> = { a3: null, backend: null, frontend: null };
      for (const c of sprintCapRows) {
        budget[c.subTeam] = c.capacityPoints;
      }

      return {
        id: sprint.id,
        name: sprint.name,
        a3Allocated: allocated.a3,
        a3Budget: budget.a3,
        backendAllocated: allocated.backend,
        backendBudget: budget.backend,
        frontendAllocated: allocated.frontend,
        frontendBudget: budget.frontend,
      };
    });

    res.json({ mode: "sprint", rows });
    return;
  }

  const allCycles = await db.select().from(cyclesTable).orderBy(cyclesTable.startDate);
  if (allCycles.length === 0) {
    res.json({ mode: "cycle", rows: [] });
    return;
  }

  const cycleIds = allCycles.map((c) => c.id);
  const allSprints = await db
    .select()
    .from(sprintsTable)
    .where(inArray(sprintsTable.cycleId, cycleIds));

  const allSprintIds = allSprints.map((s) => s.id);

  const allocations = allSprintIds.length > 0
    ? await db
        .select({
          sprintId: projectSprintAllocationsTable.sprintId,
          subTeam: projectSprintAllocationsTable.subTeam,
          storyPoints: projectSprintAllocationsTable.storyPoints,
        })
        .from(projectSprintAllocationsTable)
        .innerJoin(projectsTable, eq(projectSprintAllocationsTable.projectId, projectsTable.id))
        .where(and(inArray(projectSprintAllocationsTable.sprintId, allSprintIds), eq(projectsTable.team, "Development")))
    : [];
  const capacityRows = allSprintIds.length > 0
    ? await db.select().from(sprintCapacityTable).where(inArray(sprintCapacityTable.sprintId, allSprintIds))
    : [];

  const sprintsByCycle = new Map<number, typeof allSprints>();
  for (const s of allSprints) {
    const arr = sprintsByCycle.get(s.cycleId) ?? [];
    arr.push(s);
    sprintsByCycle.set(s.cycleId, arr);
  }

  const rows = allCycles.map((cycle) => {
    const cycleSprintIds = (sprintsByCycle.get(cycle.id) ?? []).map((s) => s.id);
    const cycleAllocs = allocations.filter((a) => cycleSprintIds.includes(a.sprintId));
    const cycleCap = capacityRows.filter((c) => cycleSprintIds.includes(c.sprintId));

    const allocated: Record<string, number> = { a3: 0, backend: 0, frontend: 0 };
    for (const a of cycleAllocs) {
      allocated[a.subTeam] = (allocated[a.subTeam] ?? 0) + a.storyPoints;
    }

    const hasBudget: Record<string, boolean> = { a3: false, backend: false, frontend: false };
    const budgetTotal: Record<string, number> = { a3: 0, backend: 0, frontend: 0 };
    for (const c of cycleCap) {
      hasBudget[c.subTeam] = true;
      budgetTotal[c.subTeam] = (budgetTotal[c.subTeam] ?? 0) + c.capacityPoints;
    }

    return {
      id: cycle.id,
      name: cycle.name,
      a3Allocated: allocated.a3,
      a3Budget: hasBudget.a3 ? budgetTotal.a3 : null,
      backendAllocated: allocated.backend,
      backendBudget: hasBudget.backend ? budgetTotal.backend : null,
      frontendAllocated: allocated.frontend,
      frontendBudget: hasBudget.frontend ? budgetTotal.frontend : null,
    };
  });

  res.json({ mode: "cycle", rows });
});

export default router;
