import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  projectsTable,
  projectGoalsTable,
  projectUpdatesTable,
  goalsTable,
  cyclesTable,
  sprintsTable,
} from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  UpdateProjectParams,
  DeleteProjectParams,
  GetProjectParams,
  ListProjectsQueryParams,
  CreateProjectUpdateBody,
  CreateProjectUpdateParams,
  DeleteProjectUpdateParams,
  ListProjectUpdatesParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function getProjectWithDetails(projectId: number) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return null;

  const goalRows = await db
    .select({ goal: goalsTable })
    .from(projectGoalsTable)
    .innerJoin(goalsTable, eq(projectGoalsTable.goalId, goalsTable.id))
    .where(eq(projectGoalsTable.projectId, projectId));

  const updateRows = await db
    .select()
    .from(projectUpdatesTable)
    .where(eq(projectUpdatesTable.projectId, projectId))
    .orderBy(projectUpdatesTable.createdAt);

  const latestUpdate = updateRows.length > 0 ? updateRows[updateRows.length - 1] : null;

  let cycle = null;
  if (project.cycleId) {
    const [c] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, project.cycleId));
    if (c) cycle = { id: c.id, name: c.name };
  }

  let sprint = null;
  if (project.sprintId) {
    const [s] = await db.select().from(sprintsTable).where(eq(sprintsTable.id, project.sprintId));
    if (s) sprint = { id: s.id, name: s.name, sprintNumber: s.sprintNumber };
  }

  return {
    ...project,
    goals: goalRows.map((r) => r.goal),
    latestUpdate: latestUpdate
      ? {
          id: latestUpdate.id,
          content: latestUpdate.content,
          authorName: latestUpdate.authorName,
          createdAt: latestUpdate.createdAt,
        }
      : null,
    cycle,
    sprint,
  };
}

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const status = query.data.status;
  let projects;
  if (status) {
    projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.status, status))
      .orderBy(projectsTable.createdAt);
  } else {
    projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  }

  if (projects.length === 0) {
    res.json([]);
    return;
  }

  const projectIds = projects.map((p) => p.id);

  const goalRows = await db
    .select({ projectId: projectGoalsTable.projectId, goal: goalsTable })
    .from(projectGoalsTable)
    .innerJoin(goalsTable, eq(projectGoalsTable.goalId, goalsTable.id))
    .where(inArray(projectGoalsTable.projectId, projectIds));

  const updateRows = await db
    .select()
    .from(projectUpdatesTable)
    .where(inArray(projectUpdatesTable.projectId, projectIds))
    .orderBy(projectUpdatesTable.createdAt);

  const cycleIds = [...new Set(projects.filter((p) => p.cycleId).map((p) => p.cycleId as number))];
  const sprintIds = [...new Set(projects.filter((p) => p.sprintId).map((p) => p.sprintId as number))];

  const cycles = cycleIds.length > 0
    ? await db.select().from(cyclesTable).where(inArray(cyclesTable.id, cycleIds))
    : [];
  const sprints = sprintIds.length > 0
    ? await db.select().from(sprintsTable).where(inArray(sprintsTable.id, sprintIds))
    : [];

  const cycleMap = new Map(cycles.map((c) => [c.id, c]));
  const sprintMap = new Map(sprints.map((s) => [s.id, s]));

  const goalsByProject = new Map<number, typeof goalsTable.$inferSelect[]>();
  for (const r of goalRows) {
    const existing = goalsByProject.get(r.projectId) ?? [];
    existing.push(r.goal);
    goalsByProject.set(r.projectId, existing);
  }

  const latestUpdateByProject = new Map<number, typeof projectUpdatesTable.$inferSelect>();
  for (const u of updateRows) {
    latestUpdateByProject.set(u.projectId, u);
  }

  const result = projects.map((p) => {
    const latestUpdate = latestUpdateByProject.get(p.id) ?? null;
    const cycle = p.cycleId ? cycleMap.get(p.cycleId) : undefined;
    const sprint = p.sprintId ? sprintMap.get(p.sprintId) : undefined;
    return {
      ...p,
      goals: goalsByProject.get(p.id) ?? [],
      latestUpdate: latestUpdate
        ? {
            id: latestUpdate.id,
            content: latestUpdate.content,
            authorName: latestUpdate.authorName,
            createdAt: latestUpdate.createdAt,
          }
        : null,
      cycle: cycle ? { id: cycle.id, name: cycle.name } : null,
      sprint: sprint ? { id: sprint.id, name: sprint.name, sprintNumber: sprint.sprintNumber } : null,
    };
  });

  res.json(result);
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { goalIds, startDate, endDate, ...fields } = parsed.data;

  const [project] = await db
    .insert(projectsTable)
    .values({
      ...fields,
      startDate: startDate ? (startDate instanceof Date ? startDate.toISOString().split("T")[0] : String(startDate)) : null,
      endDate: endDate ? (endDate instanceof Date ? endDate.toISOString().split("T")[0] : String(endDate)) : null,
    })
    .returning();

  if (goalIds && goalIds.length > 0) {
    await db.insert(projectGoalsTable).values(goalIds.map((gid) => ({ projectId: project.id, goalId: gid })));
  }

  const projectWithDetails = await getProjectWithDetails(project.id);
  res.status(201).json(projectWithDetails);
});

router.get("/projects/timeline", async (req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.startDate);

  if (projects.length === 0) {
    res.json([]);
    return;
  }

  const projectIds = projects.map((p) => p.id);

  const goalRows = await db
    .select({ projectId: projectGoalsTable.projectId, goal: goalsTable })
    .from(projectGoalsTable)
    .innerJoin(goalsTable, eq(projectGoalsTable.goalId, goalsTable.id))
    .where(inArray(projectGoalsTable.projectId, projectIds));

  const cycleIds = [...new Set(projects.filter((p) => p.cycleId).map((p) => p.cycleId as number))];
  const sprintIds = [...new Set(projects.filter((p) => p.sprintId).map((p) => p.sprintId as number))];

  const cycles = cycleIds.length > 0 ? await db.select().from(cyclesTable).where(inArray(cyclesTable.id, cycleIds)) : [];
  const sprints = sprintIds.length > 0 ? await db.select().from(sprintsTable).where(inArray(sprintsTable.id, sprintIds)) : [];

  const cycleMap = new Map(cycles.map((c) => [c.id, c]));
  const sprintMap = new Map(sprints.map((s) => [s.id, s]));

  const goalsByProject = new Map<number, typeof goalsTable.$inferSelect[]>();
  for (const r of goalRows) {
    const existing = goalsByProject.get(r.projectId) ?? [];
    existing.push(r.goal);
    goalsByProject.set(r.projectId, existing);
  }

  const result = projects.map((p) => {
    const cycle = p.cycleId ? cycleMap.get(p.cycleId) : undefined;
    const sprint = p.sprintId ? sprintMap.get(p.sprintId) : undefined;
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      confidence: p.confidence,
      storyPoints: p.storyPoints,
      startDate: p.startDate,
      endDate: p.endDate,
      team: p.team,
      sponsor: p.sponsor,
      cycleName: cycle?.name ?? null,
      cycleStartDate: cycle?.startDate ?? null,
      cycleEndDate: cycle?.endDate ?? null,
      sprintName: sprint?.name ?? null,
      sprintNumber: sprint?.sprintNumber ?? null,
      goals: goalsByProject.get(p.id) ?? [],
    };
  });

  res.json(result);
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const project = await getProjectWithDetails(params.data.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { goalIds, startDate, endDate, ...fields } = parsed.data;
  const updates: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) updates[key] = val;
  }

  if (startDate !== undefined) {
    updates.startDate = startDate ? (startDate instanceof Date ? startDate.toISOString().split("T")[0] : String(startDate)) : null;
  }
  if (endDate !== undefined) {
    updates.endDate = endDate ? (endDate instanceof Date ? endDate.toISOString().split("T")[0] : String(endDate)) : null;
  }

  if (Object.keys(updates).length > 0) {
    const [project] = await db
      .update(projectsTable)
      .set(updates)
      .where(eq(projectsTable.id, params.data.id))
      .returning();
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
  }

  if (goalIds !== undefined && goalIds !== null) {
    await db.delete(projectGoalsTable).where(eq(projectGoalsTable.projectId, params.data.id));
    if (goalIds.length > 0) {
      await db.insert(projectGoalsTable).values(goalIds.map((gid) => ({ projectId: params.data.id, goalId: gid })));
    }
  }

  const projectWithDetails = await getProjectWithDetails(params.data.id);
  if (!projectWithDetails) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(projectWithDetails);
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/projects/:projectId/updates", async (req, res): Promise<void> => {
  const params = ListProjectUpdatesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const updates = await db
    .select()
    .from(projectUpdatesTable)
    .where(eq(projectUpdatesTable.projectId, params.data.projectId))
    .orderBy(projectUpdatesTable.createdAt);
  res.json(updates);
});

router.post("/projects/:projectId/updates", requireAuth, async (req, res): Promise<void> => {
  const params = CreateProjectUpdateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateProjectUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [update] = await db
    .insert(projectUpdatesTable)
    .values({
      projectId: params.data.projectId,
      content: parsed.data.content,
      authorName: parsed.data.authorName ?? null,
    })
    .returning();
  res.status(201).json(update);
});

router.delete("/projects/:projectId/updates/:updateId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProjectUpdateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [update] = await db
    .delete(projectUpdatesTable)
    .where(eq(projectUpdatesTable.id, params.data.updateId))
    .returning();
  if (!update) {
    res.status(404).json({ error: "Update not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
