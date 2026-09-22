CREATE TABLE "project_stage_schedules" (
	"project_id" integer NOT NULL,
	"stage" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_stage_schedules_project_id_stage_pk" PRIMARY KEY("project_id","stage"),
	CONSTRAINT "project_stage_schedules_stage_valid" CHECK ("project_stage_schedules"."stage" IN ('backlog','up_next','in_progress'))
);
--> statement-breakpoint
ALTER TABLE "project_stage_schedules" ADD CONSTRAINT "project_stage_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "rag_status";