import { db, auditLogTable } from "@workspace/db";
import type { AuditAction, AuditEntityType } from "@workspace/db";
import type { AuthContext } from "../middlewares/requireAuth";
import { logger } from "./logger";

export async function logAudit(
  ctx: AuthContext | undefined,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: number,
  diff?: Record<string, unknown> | null,
): Promise<void> {
  await db.insert(auditLogTable).values({
    userEmail: ctx?.email ?? null,
    action,
    entityType,
    entityId,
    diff: diff ?? null,
  }).catch((err: unknown) => {
    logger.error({ err, action, entityType, entityId }, "AUDIT LOG WRITE FAILED — audit record may be missing");
  });
}
