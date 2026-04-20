import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { cyclesTable } from "@workspace/db";
import {
  CreateCycleBody,
  UpdateCycleBody,
  UpdateCycleParams,
  DeleteCycleParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { logAudit } from "../lib/auditLog";

const router: IRouter = Router();

router.get("/cycles", async (_req, res): Promise<void> => {
  const cycles = await db.select().from(cyclesTable).orderBy(cyclesTable.startDate);
  res.json(cycles);
});

router.post("/cycles", requireRole(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateCycleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, startDate, endDate } = parsed.data;
  const [cycle] = await db
    .insert(cyclesTable)
    .values({
      name,
      startDate: startDate instanceof Date ? startDate.toISOString().split("T")[0] : String(startDate),
      endDate: endDate instanceof Date ? endDate.toISOString().split("T")[0] : String(endDate),
    })
    .returning();
  await logAudit(req.authContext, "create", "cycle", cycle.id, { after: cycle });
  res.status(201).json(cycle);
});

router.patch("/cycles/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const params = UpdateCycleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCycleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.startDate != null) {
    const d = parsed.data.startDate;
    updates.startDate = d instanceof Date ? d.toISOString().split("T")[0] : String(d);
  }
  if (parsed.data.endDate != null) {
    const d = parsed.data.endDate;
    updates.endDate = d instanceof Date ? d.toISOString().split("T")[0] : String(d);
  }
  const [before] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, params.data.id));
  const [cycle] = await db
    .update(cyclesTable)
    .set(updates)
    .where(eq(cyclesTable.id, params.data.id))
    .returning();
  if (!cycle) {
    res.status(404).json({ error: "Cycle not found" });
    return;
  }
  await logAudit(req.authContext, "update", "cycle", cycle.id, { before, after: cycle });
  res.json(cycle);
});

router.delete("/cycles/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteCycleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cycle] = await db.delete(cyclesTable).where(eq(cyclesTable.id, params.data.id)).returning();
  if (!cycle) {
    res.status(404).json({ error: "Cycle not found" });
    return;
  }
  await logAudit(req.authContext, "delete", "cycle", cycle.id, { before: cycle });
  res.sendStatus(204);
});

export default router;
