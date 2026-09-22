import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const AUDIT_ACTIONS = ["create", "update", "delete"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = ["project", "goal", "sprint"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email"),
  action: text("action").notNull().$type<AuditAction>(),
  entityType: text("entity_type").notNull().$type<AuditEntityType>(),
  entityId: integer("entity_id").notNull(),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogTable.$inferSelect;
