CREATE TABLE "cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cycle_id" integer NOT NULL,
	"sprint_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sponsor" text,
	"team" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"confidence" text,
	"story_points" integer,
	"start_date" date,
	"end_date" date,
	"stakeholder" text,
	"impact" text,
	"blocked_reason" text,
	"cycle_id" integer,
	"sprint_id" integer,
	"completion_percent" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_completion_percent_range" CHECK ("projects"."completion_percent" IS NULL OR ("projects"."completion_percent" >= 0 AND "projects"."completion_percent" <= 100))
);
--> statement-breakpoint
CREATE TABLE "project_goals" (
	"project_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	CONSTRAINT "project_goals_project_id_goal_id_pk" PRIMARY KEY("project_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "project_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"content" text NOT NULL,
	"author_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"day_of_week" integer DEFAULT 1 NOT NULL,
	"hour" integer DEFAULT 8 NOT NULL,
	"recipients" text DEFAULT '' NOT NULL,
	"last_sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"team" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_email" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint_capacity" (
	"id" serial PRIMARY KEY NOT NULL,
	"sprint_id" integer NOT NULL,
	"sub_team" text NOT NULL,
	"capacity_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_capacity_sprint_id_sub_team_key" UNIQUE("sprint_id","sub_team"),
	CONSTRAINT "sprint_capacity_sub_team_check" CHECK ("sprint_capacity"."sub_team" IN ('a3', 'backend', 'frontend')),
	CONSTRAINT "sprint_capacity_points_non_neg" CHECK ("sprint_capacity"."capacity_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_sprint_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"sprint_id" integer NOT NULL,
	"sub_team" text NOT NULL,
	"story_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_sprint_alloc_project_sprint_sub_team_key" UNIQUE("project_id","sprint_id","sub_team"),
	CONSTRAINT "project_sprint_alloc_sub_team_check" CHECK ("project_sprint_allocations"."sub_team" IN ('a3', 'backend', 'frontend')),
	CONSTRAINT "project_sprint_alloc_story_points_non_neg" CHECK ("project_sprint_allocations"."story_points" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_capacity" ADD CONSTRAINT "sprint_capacity_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sprint_allocations" ADD CONSTRAINT "project_sprint_allocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sprint_allocations" ADD CONSTRAINT "project_sprint_allocations_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;