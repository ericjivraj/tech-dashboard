CREATE TABLE "project_cycle_allocations" (
	"project_id" integer NOT NULL,
	"cycle_id" integer NOT NULL,
	"allocation_percent" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_cycle_allocations_project_id_cycle_id_pk" PRIMARY KEY("project_id","cycle_id"),
	CONSTRAINT "project_cycle_alloc_pct_range" CHECK ("project_cycle_allocations"."allocation_percent" >= 0 AND "project_cycle_allocations"."allocation_percent" <= 100)
);
--> statement-breakpoint
ALTER TABLE "project_cycle_allocations" ADD CONSTRAINT "project_cycle_allocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cycle_allocations" ADD CONSTRAINT "project_cycle_allocations_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "cycle_allocation_percent";