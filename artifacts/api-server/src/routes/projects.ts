import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  projectsTable,
  projectGoalsTable,
  projectUpdatesTable,
  goalsTable,
  sprintsTable,
  projectSprintAllocationsTable,
  projectSprintCapacityAllocationsTable,
  projectStageSchedulesTable,
} from "@workspace/db";
import { z } from "zod";
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
  UpdateProjectUpdateParams,
  UpdateProjectUpdateBody,
  ListProjectUpdatesParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { logAudit } from "../lib/auditLog";

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

  let sprint = null;
  if (project.sprintId) {
    const [s] = await db.select().from(sprintsTable).where(eq(sprintsTable.id, project.sprintId));
    if (s) sprint = { id: s.id, name: s.name, sprintNumber: s.sprintNumber };
  }

  const sprintAllocRows = await db
    .select()
    .from(projectSprintCapacityAllocationsTable)
    .where(eq(projectSprintCapacityAllocationsTable.projectId, projectId));

  const stageScheduleRows = await db
    .select()
    .from(projectStageSchedulesTable)
    .where(eq(projectStageSchedulesTable.projectId, projectId));

  return {
    ...project,
    goals: goalRows.map((r) => r.goal),
    latestUpdate: latestUpdate
      ? {
          id: latestUpdate.id,
          content: latestUpdate.content,
          authorName: latestUpdate.authorName,
          blocked: latestUpdate.blocked,
          createdAt: latestUpdate.createdAt,
        }
      : null,
    sprint,
    sprintAllocations: sprintAllocRows.map((r) => ({
      sprintId: r.sprintId,
      percent: Number(r.allocationPercent),
    })),
    stageSchedules: stageScheduleRows.map((r) => ({
      stage: r.stage,
      startDate: r.startDate,
      endDate: r.endDate,
    })),
  };
}

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, team, functionName, goalId } = query.data;

  const conditions = [];
  if (status) conditions.push(eq(projectsTable.status, status));
  if (team) conditions.push(eq(projectsTable.team, team));
  if (functionName) conditions.push(eq(projectsTable.functionName, functionName));

  let projects;
  if (conditions.length > 0) {
    projects = await db
      .select()
      .from(projectsTable)
      .where(and(...conditions))
      .orderBy(projectsTable.listOrder, projectsTable.id);
  } else {
    projects = await db.select().from(projectsTable).orderBy(projectsTable.listOrder, projectsTable.id);
  }

  if (goalId && projects.length > 0) {
    const projectIds = projects.map((p) => p.id);
    const goalProjectIds = await db
      .select({ projectId: projectGoalsTable.projectId })
      .from(projectGoalsTable)
      .where(and(inArray(projectGoalsTable.projectId, projectIds), eq(projectGoalsTable.goalId, goalId)));
    const goalProjectIdSet = new Set(goalProjectIds.map((r) => r.projectId));
    projects = projects.filter((p) => goalProjectIdSet.has(p.id));
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

  const sprintIds = [...new Set(projects.filter((p) => p.sprintId).map((p) => p.sprintId as number))];

  const sprints = sprintIds.length > 0
    ? await db.select().from(sprintsTable).where(inArray(sprintsTable.id, sprintIds))
    : [];

  const sprintMap = new Map(sprints.map((s) => [s.id, s]));

  // Per-sprint allocation rows. Sent down with each project so the dashboard
  // and other consumers can apply the same "belongs to sprint" rule the gantt
  // uses (allocation in sprint X OR start date in sprint X). Without this, the
  // dashboard's filtered count diverges from the gantt's visible count.
  const allocationRows = await db
    .select()
    .from(projectSprintCapacityAllocationsTable)
    .where(inArray(projectSprintCapacityAllocationsTable.projectId, projectIds));
  const allocationsByProject = new Map<number, { sprintId: number; percent: number }[]>();
  for (const a of allocationRows) {
    const list = allocationsByProject.get(a.projectId) ?? [];
    list.push({ sprintId: a.sprintId, percent: Number(a.allocationPercent) });
    allocationsByProject.set(a.projectId, list);
  }

  const stageScheduleRows = await db
    .select()
    .from(projectStageSchedulesTable)
    .where(inArray(projectStageSchedulesTable.projectId, projectIds));
  const stageSchedulesByProject = new Map<number, { stage: string; startDate: string; endDate: string }[]>();
  for (const s of stageScheduleRows) {
    const list = stageSchedulesByProject.get(s.projectId) ?? [];
    list.push({ stage: s.stage, startDate: s.startDate, endDate: s.endDate });
    stageSchedulesByProject.set(s.projectId, list);
  }

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
    const sprint = p.sprintId ? sprintMap.get(p.sprintId) : undefined;
    return {
      ...p,
      goals: goalsByProject.get(p.id) ?? [],
      latestUpdate: latestUpdate
        ? {
            id: latestUpdate.id,
            content: latestUpdate.content,
            authorName: latestUpdate.authorName,
            blocked: latestUpdate.blocked,
            createdAt: latestUpdate.createdAt,
          }
        : null,
      sprint: sprint ? { id: sprint.id, name: sprint.name, sprintNumber: sprint.sprintNumber } : null,
      sprintAllocations: allocationsByProject.get(p.id) ?? [],
      stageSchedules: stageSchedulesByProject.get(p.id) ?? [],
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

  const ctx = req.authContext;

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

  await logAudit(ctx, "create", "project", project.id, { after: project });

  const projectWithDetails = await getProjectWithDetails(project.id);
  res.status(201).json(projectWithDetails);
});

router.get("/projects/timeline", async (_req, res): Promise<void> => {
  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(projectsTable.timelineOrder, projectsTable.id);

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

  const sprintIds = [...new Set(projects.filter((p) => p.sprintId).map((p) => p.sprintId as number))];

  const sprints = sprintIds.length > 0 ? await db.select().from(sprintsTable).where(inArray(sprintsTable.id, sprintIds)) : [];

  const sprintMap = new Map(sprints.map((s) => [s.id, s]));

  const goalsByProject = new Map<number, typeof goalsTable.$inferSelect[]>();
  for (const r of goalRows) {
    const existing = goalsByProject.get(r.projectId) ?? [];
    existing.push(r.goal);
    goalsByProject.set(r.projectId, existing);
  }

  // Per-project per-sprint allocations (% of sprint capacity). Drives the
  // Gantt bar span (min sprint start → max sprint end).
  const allSprintAllocations = projectIds.length > 0
    ? await db
        .select()
        .from(projectSprintCapacityAllocationsTable)
        .where(inArray(projectSprintCapacityAllocationsTable.projectId, projectIds))
    : [];

  const extraSprintIds = [...new Set(
    allSprintAllocations.map((a) => a.sprintId).filter((id) => !sprintIds.includes(id)),
  )];
  const extraSprints = extraSprintIds.length > 0
    ? await db.select().from(sprintsTable).where(inArray(sprintsTable.id, extraSprintIds))
    : [];
  for (const s of extraSprints) sprintMap.set(s.id, s);

  const sprintAllocationsByProject = new Map<number, { sprintId: number; sprintName: string; sprintStartDate: string; sprintEndDate: string; percent: number }[]>();
  for (const a of allSprintAllocations) {
    const s = sprintMap.get(a.sprintId);
    if (!s) continue;
    const list = sprintAllocationsByProject.get(a.projectId) ?? [];
    list.push({
      sprintId: a.sprintId,
      sprintName: s.name,
      sprintStartDate: s.startDate,
      sprintEndDate: s.endDate,
      percent: Number(a.allocationPercent),
    });
    sprintAllocationsByProject.set(a.projectId, list);
  }
  for (const list of sprintAllocationsByProject.values()) {
    list.sort((a, b) => a.sprintStartDate.localeCompare(b.sprintStartDate));
  }

  const allStageSchedules = projectIds.length > 0
    ? await db
        .select()
        .from(projectStageSchedulesTable)
        .where(inArray(projectStageSchedulesTable.projectId, projectIds))
    : [];
  const stageSchedulesByProject = new Map<number, { stage: string; startDate: string; endDate: string }[]>();
  for (const s of allStageSchedules) {
    const list = stageSchedulesByProject.get(s.projectId) ?? [];
    list.push({ stage: s.stage, startDate: s.startDate, endDate: s.endDate });
    stageSchedulesByProject.set(s.projectId, list);
  }

  const updateRows = projectIds.length > 0
    ? await db
        .select()
        .from(projectUpdatesTable)
        .where(inArray(projectUpdatesTable.projectId, projectIds))
        .orderBy(projectUpdatesTable.createdAt)
    : [];
  const latestUpdateByProject = new Map<number, typeof projectUpdatesTable.$inferSelect>();
  for (const u of updateRows) {
    latestUpdateByProject.set(u.projectId, u);
  }

  const result = projects.map((p) => {
    const sprint = p.sprintId ? sprintMap.get(p.sprintId) : undefined;

    return {
      id: p.id,
      title: p.title,
      status: p.status,
      storyPoints: p.storyPoints,
      startDate: p.startDate,
      endDate: p.endDate,
      team: p.team,
      functionName: p.functionName,
      sponsor: p.sponsor,
      sprintId: p.sprintId ?? null,
      sprintName: sprint?.name ?? null,
      sprintNumber: sprint?.sprintNumber ?? null,
      displayOrder: p.displayOrder,
      listOrder: p.listOrder,
      timelineOrder: p.timelineOrder,
      blocked: latestUpdateByProject.get(p.id)?.blocked === true,
      sprintAllocations: sprintAllocationsByProject.get(p.id) ?? [],
      stageSchedules: stageSchedulesByProject.get(p.id) ?? [],
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
  const ctx = req.authContext;

  const [before] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));

  if (!before) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Optimistic concurrency: if the client supplied the row version it loaded,
  // refuse the write when the row has been modified since. The 409 carries
  // the latest updated_at so the client can re-prompt the user with fresh
  // data instead of clobbering whoever edited last.
  const { expectedUpdatedAt, goalIds, sprintAllocations, stageSchedules, startDate, endDate, ...fields } = parsed.data;
  if (expectedUpdatedAt) {
    const expectedMs = new Date(expectedUpdatedAt as unknown as string | Date).getTime();
    const actualMs = before.updatedAt instanceof Date ? before.updatedAt.getTime() : new Date(before.updatedAt).getTime();
    if (Number.isFinite(expectedMs) && expectedMs !== actualMs) {
      res.status(409).json({
        error: "Project was modified by someone else after you opened it.",
        currentUpdatedAt: before.updatedAt,
      });
      return;
    }
  }
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

  let after = before;
  let fieldUpdated = false;
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
    after = project;
    fieldUpdated = true;
  }

  let sprintAllocationsUpdated = false;
  if (sprintAllocations !== undefined && sprintAllocations !== null) {
    await db.delete(projectSprintCapacityAllocationsTable).where(eq(projectSprintCapacityAllocationsTable.projectId, params.data.id));
    const validRows = sprintAllocations.filter((a) => Number(a.percent) > 0);
    if (validRows.length > 0) {
      await db.insert(projectSprintCapacityAllocationsTable).values(
        validRows.map((a) => ({
          projectId: params.data.id,
          sprintId: a.sprintId,
          allocationPercent: String(Number(a.percent).toFixed(2)),
        })),
      );
    }
    sprintAllocationsUpdated = true;
  }

  let stageSchedulesUpdated = false;
  if (stageSchedules !== undefined && stageSchedules !== null) {
    await db.delete(projectStageSchedulesTable).where(eq(projectStageSchedulesTable.projectId, params.data.id));
    if (stageSchedules.length > 0) {
      await db.insert(projectStageSchedulesTable).values(
        stageSchedules.map((s) => ({
          projectId: params.data.id,
          stage: s.stage,
          startDate: s.startDate,
          endDate: s.endDate,
        })),
      );
    }
    stageSchedulesUpdated = true;
  }

  let goalsUpdated = false;
  let goalIdsBefore: number[] | undefined;
  let goalIdsAfter: number[] | undefined;
  if (goalIds !== undefined && goalIds !== null) {
    const existingGoals = await db.select({ goalId: projectGoalsTable.goalId }).from(projectGoalsTable).where(eq(projectGoalsTable.projectId, params.data.id));
    goalIdsBefore = existingGoals.map((r) => r.goalId);
    await db.delete(projectGoalsTable).where(eq(projectGoalsTable.projectId, params.data.id));
    if (goalIds.length > 0) {
      await db.insert(projectGoalsTable).values(goalIds.map((gid) => ({ projectId: params.data.id, goalId: gid })));
    }
    goalIdsAfter = goalIds;
    goalsUpdated = true;
  }

  const ORDER_FIELDS = new Set(["displayOrder", "listOrder", "timelineOrder"]);
  const onlyOrderingChanged =
    fieldUpdated &&
    !goalsUpdated &&
    Object.keys(updates).every((k) => ORDER_FIELDS.has(k));

  if ((fieldUpdated || goalsUpdated || sprintAllocationsUpdated || stageSchedulesUpdated) && !onlyOrderingChanged) {
    const diff: Record<string, unknown> = { before, after };
    if (goalsUpdated) {
      diff.goalIdsBefore = goalIdsBefore;
      diff.goalIdsAfter = goalIdsAfter;
    }
    if (sprintAllocationsUpdated) {
      diff.sprintAllocationsAfter = sprintAllocations;
    }
    if (stageSchedulesUpdated) {
      diff.stageSchedulesAfter = stageSchedules;
    }
    await logAudit(ctx, "update", "project", params.data.id, diff);
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

  const ctx = req.authContext;

  const [project] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await logAudit(ctx, "delete", "project", params.data.id, { before: project });

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
    .orderBy(desc(projectUpdatesTable.createdAt));
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
  const [project] = await db.select({ id: projectsTable.id, team: projectsTable.team }).from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const ctx = req.authContext;

  const [update] = await db
    .insert(projectUpdatesTable)
    .values({
      projectId: params.data.projectId,
      content: parsed.data.content,
      authorName: parsed.data.authorName ?? ctx?.email ?? null,
      blocked: parsed.data.blocked === true,
    })
    .returning();
  res.status(201).json(update);
});

router.patch("/projects/:projectId/updates/:updateId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProjectUpdateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { projectId, updateId } = params.data;

  const fields: Record<string, unknown> = {};
  if (parsed.data.content !== undefined) fields.content = parsed.data.content;
  if (parsed.data.blocked !== undefined) fields.blocked = parsed.data.blocked;
  if (Object.keys(fields).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  const [update] = await db
    .update(projectUpdatesTable)
    .set(fields)
    .where(
      and(
        eq(projectUpdatesTable.id, updateId),
        eq(projectUpdatesTable.projectId, projectId),
      ),
    )
    .returning();
  if (!update) {
    res.status(404).json({ error: "Update not found or does not belong to this project" });
    return;
  }
  res.json(update);
});

router.delete("/projects/:projectId/updates/:updateId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProjectUpdateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { projectId, updateId } = params.data;

  const [update] = await db
    .delete(projectUpdatesTable)
    .where(
      and(
        eq(projectUpdatesTable.id, updateId),
        eq(projectUpdatesTable.projectId, projectId),
      ),
    )
    .returning();
  if (!update) {
    res.status(404).json({ error: "Update not found or does not belong to this project" });
    return;
  }
  res.sendStatus(204);
});

const ProjectIdParams = z.object({ id: z.coerce.number().int() });
const UpsertProjectAllocationsBody = z.object({
  allocations: z.array(z.object({
    sprintId: z.number().int(),
    subTeam: z.enum(["a3", "backend", "frontend"]),
    storyPoints: z.number().int().min(0),
  })),
});

router.get("/projects/:id/allocations", async (req, res): Promise<void> => {
  const params = ProjectIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const allocations = await db
    .select()
    .from(projectSprintAllocationsTable)
    .where(eq(projectSprintAllocationsTable.projectId, params.data.id))
    .orderBy(projectSprintAllocationsTable.sprintId);
  res.json(allocations);
});

router.put("/projects/:id/allocations", requireAuth, async (req, res): Promise<void> => {
  const params = ProjectIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpsertProjectAllocationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db
    .select({ id: projectsTable.id, startDate: projectsTable.startDate, endDate: projectsTable.endDate })
    .from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const allocationKeys = parsed.data.allocations.map((a) => `${a.sprintId}:${a.subTeam}`);
  const duplicateKeys = allocationKeys.filter((k, i) => allocationKeys.indexOf(k) !== i);
  if (duplicateKeys.length > 0) {
    const unique = [...new Set(duplicateKeys)];
    res.status(400).json({ error: `Duplicate allocation entries: ${unique.join(", ")}` });
    return;
  }

  if (parsed.data.allocations.length > 0 && project.startDate && project.endDate) {
    const allocationSprintIds = [...new Set(parsed.data.allocations.map((a) => a.sprintId))];
    const allocationSprints = await db
      .select({ id: sprintsTable.id, startDate: sprintsTable.startDate, endDate: sprintsTable.endDate })
      .from(sprintsTable)
      .where(inArray(sprintsTable.id, allocationSprintIds));
    const sprintById = new Map(allocationSprints.map((s) => [s.id, s]));
    const outOfRange = allocationSprintIds.filter((id) => {
      const sprint = sprintById.get(id);
      if (!sprint) return true;
      return sprint.startDate > project.endDate! || sprint.endDate < project.startDate!;
    });
    if (outOfRange.length > 0) {
      res.status(400).json({ error: `Sprint IDs [${outOfRange.join(", ")}] do not overlap with the project date range` });
      return;
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(projectSprintAllocationsTable).where(eq(projectSprintAllocationsTable.projectId, params.data.id));
    if (parsed.data.allocations.length > 0) {
      await tx.insert(projectSprintAllocationsTable).values(
        parsed.data.allocations.map((a) => ({
          projectId: params.data.id,
          sprintId: a.sprintId,
          subTeam: a.subTeam,
          storyPoints: a.storyPoints,
        })),
      );
    }
  });

  const allocations = await db
    .select()
    .from(projectSprintAllocationsTable)
    .where(eq(projectSprintAllocationsTable.projectId, params.data.id))
    .orderBy(projectSprintAllocationsTable.sprintId);
  res.json(allocations);
});

export default router;
