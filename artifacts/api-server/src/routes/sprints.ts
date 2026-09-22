import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { sprintsTable } from "@workspace/db";
import {
  CreateSprintBody,
  UpdateSprintBody,
  UpdateSprintParams,
  DeleteSprintParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { logAudit } from "../lib/auditLog";

const router: IRouter = Router();

router.get("/sprints", async (_req, res): Promise<void> => {
  const sprints = await db.select().from(sprintsTable).orderBy(sprintsTable.startDate);
  res.json(sprints);
});

router.post("/sprints", requireRole(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateSprintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, sprintNumber, startDate, endDate } = parsed.data;
  const [sprint] = await db
    .insert(sprintsTable)
    .values({
      name,
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

export default router;
