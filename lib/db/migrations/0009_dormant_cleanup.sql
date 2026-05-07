-- Drop dormant columns on projects
ALTER TABLE "projects" DROP COLUMN IF EXISTS "confidence";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "blocked_reason";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "completion_percent";--> statement-breakpoint

-- Drop FK on audit_log.user_id (the users table is going away)
ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- Drop dormant tables
DROP TABLE IF EXISTS "project_attachments";--> statement-breakpoint
DROP TABLE IF EXISTS "email_schedule";--> statement-breakpoint
DROP TABLE IF EXISTS "sprint_capacity";--> statement-breakpoint
DROP TABLE IF EXISTS "users";
