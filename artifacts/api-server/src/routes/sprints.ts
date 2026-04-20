import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { sprintsTable, sprintCapacityTable } from "@workspace/db";
import {
  CreateSprintBody,
  UpdateSprintBody,
  UpdateSprintParams,
  DeleteSprintParams,
  ListSprintsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { logAudit } from "../lib/auditLog";
import { z } from "zod";

const router: IRouter = Router();

router.get("/sprints", async (req, res): Promise<void> => {
  const query = ListSprintsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const cycleId = query.data.cycleId;
  let sprints;
  if (cycleId != null) {
    sprints = await db
      .select()
      .from(sprintsTable)
      .where(eq(sprintsTable.cycleId, cycleId))
      .orderBy(sprintsTable.sprintNumber);
  } else {
    sprints = await db.select().from(sprintsTable).orderBy(sprintsTable.startDate);
  }
  res.json(sprints);
});

router.post("/sprints", requireRole(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateSprintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, cycleId, sprintNumber, startDate, endDate } = parsed.data;
  const [sprint] = await db
    .insert(sprintsTable)
    .values({
      name,
      cycleId,
      sprintNumber,
      startDate: startDate instanceof Date ? startDate.toISOString().split("T")[0] : String(startDate),
      endDate: endDate instanceof Date ? endDate.toISOString().split("T")[0] : String(endDate),
    })
    .returning();
  await logAudit(req.authContext, "create", "sprint", sprint.id, { after: sprint });
  res.status(201).json(sprint);
});

router.patch("/sprints/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const params = UpdateSprintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSprintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.cycleId != null) updates.cycleId = parsed.data.cycleId;
  if (parsed.data.sprintNumber != null) updates.sprintNumber = parsed.data.sprintNumber;
  if (parsed.data.startDate != null) {
    const d = parsed.data.startDate;
    updates.startDate = d instanceof Date ? d.toISOString().split("T")[0] : String(d);
  }
  if (parsed.data.endDate != null) {
    const d = parsed.data.endDate;
    updates.endDate = d instanceof Date ? d.toISOString().split("T")[0] : String(d);
  }
  const [before] = await db.select().from(sprintsTable).where(eq(sprintsTable.id, params.data.id));
  const [sprint] = await db
    .update(sprintsTable)
    .set(updates)
    .where(eq(sprintsTable.id, params.data.id))
    .returning();
  if (!sprint) {
    res.status(404).json({ error: "Sprint not found" });
    return;
  }
  await logAudit(req.authContext, "update", "sprint", sprint.id, { before, after: sprint });
  res.json(sprint);
});

router.delete("/sprints/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteSprintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [sprint] = await db.delete(sprintsTable).where(eq(sprintsTable.id, params.data.id)).returning();
  if (!sprint) {
    res.status(404).json({ error: "Sprint not found" });
    return;
  }
  await logAudit(req.authContext, "delete", "sprint", sprint.id, { before: sprint });
  res.sendStatus(204);
});

const SprintIdParams = z.object({ id: z.coerce.number().int() });
const UpsertCapacityBody = z.object({
  a3: z.number().int().min(0).nullable().optional(),
  backend: z.number().int().min(0).nullable().optional(),
  frontend: z.number().int().min(0).nullable().optional(),
});

async function getSprintCapacityResponse(sprintId: number) {
  const rows = await db
    .select()
    .from(sprintCapacityTable)
    .where(eq(sprintCapacityTable.sprintId, sprintId));
  const a3Row = rows.find((r) => r.subTeam === "a3");
  const backendRow = rows.find((r) => r.subTeam === "backend");
  const frontendRow = rows.find((r) => r.subTeam === "frontend");
  return {
    sprintId,
    a3: a3Row?.capacityPoints ?? null,
    backend: backendRow?.capacityPoints ?? null,
    frontend: frontendRow?.capacityPoints ?? null,
  };
}

router.get("/sprints/:id/capacity", async (req, res): Promise<void> => {
  const params = SprintIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [sprint] = await db.select({ id: sprintsTable.id }).from(sprintsTable).where(eq(sprintsTable.id, params.data.id));
  if (!sprint) {
    res.status(404).json({ error: "Sprint not found" });
    return;
  }
  res.json(await getSprintCapacityResponse(params.data.id));
});

router.put("/sprints/:id/capacity", requireRole(["admin"]), async (req, res): Promise<void> => {
  const params = SprintIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpsertCapacityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [sprint] = await db.select({ id: sprintsTable.id }).from(sprintsTable).where(eq(sprintsTable.id, params.data.id));
  if (!sprint) {
    res.status(404).json({ error: "Sprint not found" });
    return;
  }

  const subTeams = ["a3", "backend", "frontend"] as const;
  for (const subTeam of subTeams) {
    if (!(subTeam in parsed.data)) continue;
    const val = parsed.data[subTeam];
    const existing = await db
      .select()
      .from(sprintCapacityTable)
      .where(and(eq(sprintCapacityTable.sprintId, params.data.id), eq(sprintCapacityTable.subTeam, subTeam)));
    if (val === null || val === undefined) {
      if (existing.length > 0) {
        await db.delete(sprintCapacityTable).where(eq(sprintCapacityTable.id, existing[0].id));
      }
    } else if (existing.length > 0) {
      await db
        .update(sprintCapacityTable)
        .set({ capacityPoints: val })
        .where(eq(sprintCapacityTable.id, existing[0].id));
    } else {
      await db.insert(sprintCapacityTable).values({
        sprintId: params.data.id,
        subTeam,
        capacityPoints: val,
      });
    }
  }

  res.json(await getSprintCapacityResponse(params.data.id));
});

export default router;
