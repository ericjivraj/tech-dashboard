CREATE TABLE "project_sprint_capacity_allocations" (
	"project_id" integer NOT NULL,
	"sprint_id" integer NOT NULL,
	"allocation_percent" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_sprint_capacity_allocations_project_id_sprint_id_pk" PRIMARY KEY("project_id","sprint_id"),
	CONSTRAINT "project_sprint_capacity_alloc_pct_range" CHECK ("project_sprint_capacity_allocations"."allocation_percent" >= 0 AND "project_sprint_capacity_allocations"."allocation_percent" <= 100)
);
--> statement-breakpoint
ALTER TABLE "project_sprint_capacity_allocations" ADD CONSTRAINT "project_sprint_capacity_allocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sprint_capacity_allocations" ADD CONSTRAINT "project_sprint_capacity_allocations_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;