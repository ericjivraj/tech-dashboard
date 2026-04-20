import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, auditLogTable } from "@workspace/db";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/audit-log", requireRole(["admin"]), async (_req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(auditLogTable)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(200);
  res.json(entries);
});

export default router;
