import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { goalsTable } from "@workspace/db";
import {
  CreateGoalBody,
  UpdateGoalBody,
  UpdateGoalParams,
  DeleteGoalParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { logAudit } from "../lib/auditLog";

const router: IRouter = Router();

router.get("/goals", async (_req, res): Promise<void> => {
  const goals = await db.select().from(goalsTable).orderBy(
    sql`CASE WHEN ${goalsTable.name} LIKE 'Strategic:%' THEN 0 ELSE 1 END`,
    sql`CASE ${goalsTable.id} WHEN 9 THEN 1 WHEN 10 THEN 2 WHEN 11 THEN 3 WHEN 12 THEN 4 ELSE 999 END`,
    goalsTable.name,
  );
  res.json(goals);
});

router.post("/goals", requireRole(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [goal] = await db.insert(goalsTable).values(parsed.data).returning();
  await logAudit(req.authContext, "create", "goal", goal.id, { after: goal });
  res.status(201).json(goal);
});

router.patch("/goals/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.color != null) updates.color = parsed.data.color;

  const [before] = await db.select().from(goalsTable).where(eq(goalsTable.id, params.data.id));
  const [goal] = await db
    .update(goalsTable)
    .set(updates)
    .where(eq(goalsTable.id, params.data.id))
    .returning();
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  await logAudit(req.authContext, "update", "goal", goal.id, { before, after: goal });
  res.json(goal);
});

router.delete("/goals/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [goal] = await db.delete(goalsTable).where(eq(goalsTable.id, params.data.id)).returning();
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  await logAudit(req.authContext, "delete", "goal", goal.id, { before: goal });
  res.sendStatus(204);
});

export default router;
