ALTER TABLE "projects" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "projects" SET "display_order" = "id" * 1024;