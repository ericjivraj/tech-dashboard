import { Router, type IRouter } from "express";
import { and, eq, inArray, lte, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  projectsTable,
  projectGoalsTable,
  projectUpdatesTable,
  goalsTable,
  cyclesTable,
  sprintsTable,
  projectSprintAllocationsTable,
  projectCycleAllocationsTable,
  projectAttachmentsTable,
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
  ListProjectUpdatesParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { logAudit } from "../lib/auditLog";

const router: IRouter = Router();

async function getActiveCycleId(): Promise<number | null> {
  const today = new Date().toISOString().split("T")[0];
  const [cycle] = await db
    .select({ id: cyclesTable.id })
    .from(cyclesTable)
    .where(and(lte(cyclesTable.startDate, today), gte(cyclesTable.endDate, today)))
    .limit(1);
  return cycle?.id ?? null;
}

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
    if (c) cycle = { id: c.id, name: c.name, startDate: c.startDate, endDate: c.endDate };
  }

  let sprint = null;
  if (project.sprintId) {
    const [s] = await db.select().from(sprintsTable).where(eq(sprintsTable.id, project.sprintId));
    if (s) sprint = { id: s.id, name: s.name, sprintNumber: s.sprintNumber };
  }

  const attachmentRows = await db
    .select({ id: projectAttachmentsTable.id, name: projectAttachmentsTable.name, url: projectAttachmentsTable.url })
    .from(projectAttachmentsTable)
    .where(eq(projectAttachmentsTable.projectId, projectId));

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
    attachments: attachmentRows,
  };
}

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, team, sponsor, goalId, cycleId } = query.data;

  const conditions = [];
  if (status) conditions.push(eq(projectsTable.status, status));
  if (team) conditions.push(eq(projectsTable.team, team));
  if (sponsor) conditions.push(eq(projectsTable.sponsor, sponsor));
  if (cycleId) conditions.push(eq(projectsTable.cycleId, cycleId));

  let projects;
  if (conditions.length > 0) {
    projects = await db
      .select()
      .from(projectsTable)
      .where(and(...conditions))
      .orderBy(projectsTable.createdAt);
  } else {
    projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
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
      cycle: cycle ? { id: cycle.id, name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate } : null,
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
  if (parsed.data.completionPercent != null && (parsed.data.completionPercent < 0 || parsed.data.completionPercent > 100)) {
    res.status(400).json({ error: "completionPercent must be between 0 and 100" });
    return;
  }

  const ctx = req.authContext;

  if (ctx?.role === "guest") {
    const requestedTeam = parsed.data.team ?? null;
    if (requestedTeam !== ctx.team) {
      res.status(403).json({ error: "Forbidden: guests can only create projects for their assigned team" });
      return;
    }
  }

  const { goalIds, startDate, endDate, ...fields } = parsed.data;

  if (fields.status === "in_progress" && !fields.cycleId) {
    const activeCycleId = await getActiveCycleId();
    if (activeCycleId) fields.cycleId = activeCycleId;
  }

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

router.get("/projects/timeline", async (req, res): Promise<void> => {
  const windowCycleId = req.query.cycleId != null && req.query.cycleId !== "" && req.query.cycleId !== "null"
    ? Number(req.query.cycleId)
    : null;
  const windowStartDate = typeof req.query.startDate === "string" && req.query.startDate ? req.query.startDate : null;
  const windowEndDate = typeof req.query.endDate === "string" && req.query.endDate ? req.query.endDate : null;

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

  const allAllocations = projectIds.length > 0
    ? await db
        .select()
        .from(projectSprintAllocationsTable)
        .where(inArray(projectSprintAllocationsTable.projectId, projectIds))
    : [];

  // Per-project per-cycle allocations (% of cycle capacity). Drives the Gantt
  // bar span (min cycle start → max cycle end) and the cycle-header popover.
  const allCycleAllocations = projectIds.length > 0
    ? await db
        .select()
        .from(projectCycleAllocationsTable)
        .where(inArray(projectCycleAllocationsTable.projectId, projectIds))
    : [];

  const extraCycleIds = [...new Set(
    allCycleAllocations.map((a) => a.cycleId).filter((id) => !cycleIds.includes(id)),
  )];
  const extraCycles = extraCycleIds.length > 0
    ? await db.select().from(cyclesTable).where(inArray(cyclesTable.id, extraCycleIds))
    : [];
  for (const c of extraCycles) cycleMap.set(c.id, c);

  const cycleAllocationsByProject = new Map<number, { cycleId: number; cycleName: string; cycleStartDate: string; cycleEndDate: string; percent: number }[]>();
  for (const a of allCycleAllocations) {
    const c = cycleMap.get(a.cycleId);
    if (!c) continue;
    const list = cycleAllocationsByProject.get(a.projectId) ?? [];
    list.push({
      cycleId: a.cycleId,
      cycleName: c.name,
      cycleStartDate: c.startDate,
      cycleEndDate: c.endDate,
      percent: Number(a.allocationPercent),
    });
    cycleAllocationsByProject.set(a.projectId, list);
  }
  for (const list of cycleAllocationsByProject.values()) {
    list.sort((a, b) => a.cycleStartDate.localeCompare(b.cycleStartDate));
  }

  // Attachments shown in the project modal. URL may be a relative
  // /attachments/<file> path or a full external link.
  const allAttachments = projectIds.length > 0
    ? await db
        .select()
        .from(projectAttachmentsTable)
        .where(inArray(projectAttachmentsTable.projectId, projectIds))
    : [];

  const attachmentsByProject = new Map<number, { id: number; name: string; url: string }[]>();
  for (const a of allAttachments) {
    const list = attachmentsByProject.get(a.projectId) ?? [];
    list.push({ id: a.id, name: a.name, url: a.url });
    attachmentsByProject.set(a.projectId, list);
  }

  const allSprintIds = [...new Set(allAllocations.map((a) => a.sprintId))];
  const allocationSprints = allSprintIds.length > 0
    ? await db.select().from(sprintsTable).where(inArray(sprintsTable.id, allSprintIds))
    : [];
  const allocationSprintMap = new Map(allocationSprints.map((s) => [s.id, s]));

  const today = new Date().toISOString().split("T")[0];

  const windowSprintIds: Set<number> | null = (() => {
    if (windowCycleId != null) {
      return new Set(allocationSprints.filter((s) => s.cycleId === windowCycleId).map((s) => s.id));
    }
    if (windowStartDate && windowEndDate) {
      return new Set(allocationSprints
        .filter((s) => s.startDate <= windowEndDate && s.endDate >= windowStartDate)
        .map((s) => s.id));
    }
    return null;
  })();

  const allocationsByProject = new Map<number, typeof projectSprintAllocationsTable.$inferSelect[]>();
  for (const a of allAllocations) {
    const existing = allocationsByProject.get(a.projectId) ?? [];
    existing.push(a);
    allocationsByProject.set(a.projectId, existing);
  }

  const result = projects.map((p) => {
    const cycle = p.cycleId ? cycleMap.get(p.cycleId) : undefined;
    const sprint = p.sprintId ? sprintMap.get(p.sprintId) : undefined;
    const allocations = allocationsByProject.get(p.id) ?? [];
    const totalPoints = p.storyPoints ?? 0;

    const windowAllocations = windowSprintIds != null
      ? allocations.filter((a) => windowSprintIds.has(a.sprintId))
      : allocations;

    let subTeamSummary: { a3Percent: number | null; backendPercent: number | null; frontendPercent: number | null } | null = null;
    if (p.team === "Development" && windowAllocations.length > 0 && totalPoints > 0) {
      const a3Total = windowAllocations.filter((a) => a.subTeam === "a3").reduce((s, a) => s + a.storyPoints, 0);
      const beTotal = windowAllocations.filter((a) => a.subTeam === "backend").reduce((s, a) => s + a.storyPoints, 0);
      const feTotal = windowAllocations.filter((a) => a.subTeam === "frontend").reduce((s, a) => s + a.storyPoints, 0);
      subTeamSummary = {
        a3Percent: a3Total > 0 ? Math.round((a3Total / totalPoints) * 100) : null,
        backendPercent: beTotal > 0 ? Math.round((beTotal / totalPoints) * 100) : null,
        frontendPercent: feTotal > 0 ? Math.round((feTotal / totalPoints) * 100) : null,
      };
    }

    let resolvedCompletionPercent: number | null = p.completionPercent ?? null;
    if (resolvedCompletionPercent == null && p.team === "Development" && allocations.length > 0 && totalPoints > 0) {
      const pastAllocations = allocations.filter((a) => {
        const s = allocationSprintMap.get(a.sprintId);
        return s != null && s.endDate <= today;
      });
      const pastTotal = pastAllocations.reduce((sum, a) => sum + a.storyPoints, 0);
      if (pastTotal > 0) {
        resolvedCompletionPercent = Math.min(100, Math.round((pastTotal / totalPoints) * 100));
      }
    }

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
      stakeholder: p.stakeholder,
      cycleName: cycle?.name ?? null,
      cycleStartDate: cycle?.startDate ?? null,
      cycleEndDate: cycle?.endDate ?? null,
      cycleId: p.cycleId ?? null,
      sprintId: p.sprintId ?? null,
      sprintName: sprint?.name ?? null,
      sprintNumber: sprint?.sprintNumber ?? null,
      completionPercent: resolvedCompletionPercent,
      cycleAllocations: cycleAllocationsByProject.get(p.id) ?? [],
      attachments: attachmentsByProject.get(p.id) ?? [],
      subTeamSummary: subTeamSummary ?? { a3Percent: null, backendPercent: null, frontendPercent: null },
      goals: goalsByProject.get(p.id) ?? [],
    };
  });

  res.json(result);
});

router.get("/projects/export", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const validStatuses = ["done", "in_progress", "up_next", "backlog", "blocked", "new_request"];

  let projects;
  if (status && validStatuses.includes(status)) {
    projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.status, status as typeof projectsTable.$inferSelect.status))
      .orderBy(projectsTable.createdAt);
  } else {
    projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  }

  if (projects.length === 0) {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="portfolio-export.csv"`);
    res.send("Title,Status,Confidence,Sponsor,Team,Stakeholder,Story Points,Cycle,Goals,Latest Update,Start Date,End Date\n");
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
  const cycles = cycleIds.length > 0 ? await db.select().from(cyclesTable).where(inArray(cyclesTable.id, cycleIds)) : [];
  const cycleMap = new Map(cycles.map((c) => [c.id, c]));

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

  const statusLabels: Record<string, string> = {
    new_request: "New Request",
    backlog: "Backlog",
    up_next: "Up Next",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Done",
  };

  function csvCell(value: string | null | undefined): string {
    const str = value ?? "";
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headers = ["Title", "Status", "Confidence", "Sponsor", "Team", "Stakeholder", "Story Points", "Cycle", "Goals", "Latest Update", "Start Date", "End Date"];

  const rows = projects.map((p) => {
    const cycle = p.cycleId ? cycleMap.get(p.cycleId) : undefined;
    const goals = goalsByProject.get(p.id) ?? [];
    const latestUpdate = latestUpdateByProject.get(p.id) ?? null;
    return [
      csvCell(p.title),
      csvCell(statusLabels[p.status] ?? p.status),
      csvCell(p.confidence?.replace(/_/g, " ") ?? ""),
      csvCell(p.sponsor ?? ""),
      csvCell(p.team ?? ""),
      csvCell(p.stakeholder ?? ""),
      csvCell(p.storyPoints?.toString() ?? ""),
      csvCell(cycle?.name ?? ""),
      csvCell(goals.map((g) => g.name).join("; ")),
      csvCell(latestUpdate?.content ?? ""),
      csvCell(p.startDate ?? ""),
      csvCell(p.endDate ?? ""),
    ].join(",");
  });

  const csvContent = [headers.map(csvCell).join(","), ...rows].join("\n");
  const date = new Date().toISOString().split("T")[0];

  res.setHeader("Content-Type", "text/csv;charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="portfolio-${date}.csv"`);
  res.send(csvContent);
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
  if (parsed.data.completionPercent != null && (parsed.data.completionPercent < 0 || parsed.data.completionPercent > 100)) {
    res.status(400).json({ error: "completionPercent must be between 0 and 100" });
    return;
  }

  const ctx = req.authContext;

  if (ctx?.role === "guest") {
    const [existingProject] = await db.select({ team: projectsTable.team }).from(projectsTable).where(eq(projectsTable.id, params.data.id));
    if (!existingProject || existingProject.team !== ctx.team) {
      res.status(403).json({ error: "Forbidden: guests can only edit projects belonging to their team" });
      return;
    }
    if (parsed.data.team !== undefined && parsed.data.team !== ctx.team) {
      res.status(403).json({ error: "Forbidden: guests cannot reassign a project to a different team" });
      return;
    }
  }

  const [before] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));

  if (!before) {
    res.status(404).json({ error: "Project not found" });
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

  if (updates.status === "in_progress" && !updates.cycleId) {
    const activeCycleId = await getActiveCycleId();
    if (activeCycleId) updates.cycleId = activeCycleId;
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
    if (before.team === "Development" && after.team !== "Development") {
      await db.delete(projectSprintAllocationsTable).where(eq(projectSprintAllocationsTable.projectId, params.data.id));
    }
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

  if (fieldUpdated || goalsUpdated) {
    const diff: Record<string, unknown> = { before, after };
    if (goalsUpdated) {
      diff.goalIdsBefore = goalIdsBefore;
      diff.goalIdsAfter = goalIdsAfter;
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

  if (ctx?.role === "guest") {
    const [existingProject] = await db.select({ team: projectsTable.team }).from(projectsTable).where(eq(projectsTable.id, params.data.id));
    if (!existingProject || existingProject.team !== ctx.team) {
      res.status(403).json({ error: "Forbidden: guests can only delete projects belonging to their team" });
      return;
    }
  }

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
  const [project] = await db.select({ id: projectsTable.id, team: projectsTable.team }).from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const ctx = req.authContext;
  if (ctx?.role === "guest" && project.team !== ctx.team) {
    res.status(403).json({ error: "Forbidden: guests can only add updates to projects belonging to their team" });
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
  const { projectId, updateId } = params.data;

  const ctx = req.authContext;
  if (ctx?.role === "guest") {
    const [project] = await db.select({ team: projectsTable.team }).from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project || project.team !== ctx.team) {
      res.status(403).json({ error: "Forbidden: guests can only delete updates on projects belonging to their team" });
      return;
    }
  }

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
    .select({ id: projectsTable.id, team: projectsTable.team, startDate: projectsTable.startDate, endDate: projectsTable.endDate })
    .from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.team !== "Development") {
    res.status(400).json({ error: "Allocations can only be set for Development team projects" });
    return;
  }
  const ctx = req.authContext;
  if (ctx?.role === "guest" && project.team !== ctx.team) {
    res.status(403).json({ error: "Forbidden: guests can only update allocations for projects belonging to their team" });
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
