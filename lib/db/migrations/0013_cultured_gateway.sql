ALTER TABLE "cycles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_cycle_allocations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cycles" CASCADE;--> statement-breakpoint
DROP TABLE "project_cycle_allocations" CASCADE;--> statement-breakpoint
ALTER TABLE "sprints" DROP COLUMN "cycle_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "cycle_id";