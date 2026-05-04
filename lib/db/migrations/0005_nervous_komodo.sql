ALTER TABLE "projects" ADD COLUMN "list_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "timeline_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "projects" SET "list_order" = "display_order", "timeline_order" = "display_order";