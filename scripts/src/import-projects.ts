// Wipes the "click-data" tables (projects, goals, project_goals,
// project_updates, project_sprint_allocations) and reinserts everything from a
// JSON file. Sprints are left alone — they're auto-seeded by the api server's
// seedIfEmpty() on startup.
//
// Usage:
//   pnpm --filter @workspace/scripts run import-projects [-- --file path/to/data.json]
//
// Default file: ./data/projects.json (relative to repo root).
//
// Connection: uses the same DATABASE_URL / POSTGRES_* resolution as the api
// server (lib/db/src/url.ts), so the same env wiring works for local docker
// compose, preprod, and production.

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  pool,
  sprintsTable,
  goalsTable,
  projectsTable,
  projectGoalsTable,
  projectUpdatesTable,
  projectSprintAllocationsTable,
  projectSprintCapacityAllocationsTable,
  PROJECT_STATUSES,
  SUB_TEAMS,
} from "@workspace/db";

// ────────────────────────────────────────────────────────────────────────────
// JSON schema (validated with zod)
// ────────────────────────────────────────────────────────────────────────────

const goalInput = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const allocationInput = z.object({
  sprint: z.string().min(1),                       // e.g. "D/2"
  subTeam: z.enum(SUB_TEAMS as readonly [string, ...string[]]),
  storyPoints: z.number().int().nonnegative(),
});

const updateInput = z.object({
  content: z.string().min(1),
  author: z.string().optional(),
  createdAt: z.string().datetime().optional(),     // ISO 8601 timestamp
});

const projectInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  functionName: z.string().optional(),
  team: z.string().optional(),
  status: z.enum(PROJECT_STATUSES as readonly [string, ...string[]]),
  storyPoints: z.number().int().nonnegative().optional(),
  sprintAllocations: z.array(z.object({
    sprint: z.string().min(1),                                        // sprint name, e.g. "Sprint 32"
    percent: z.number().min(0).max(100),
  })).default([]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sponsor: z.string().optional(),
  impact: z.string().optional(),
  sprint: z.string().optional(),                   // sprint name, e.g. "Sprint 32"
  goals: z.array(z.string()).default([]),          // names — must exist in goals[]
  allocations: z.array(allocationInput).default([]),
  updates: z.array(updateInput).default([]),
});

const fileInput = z.object({
  goals: z.array(goalInput).default([]),
  projects: z.array(projectInput).default([]),
});

type FileInput = z.infer<typeof fileInput>;

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== "/") {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Could not find repo root (no pnpm-workspace.yaml found)");
}

function parseArgs(): { file: string } {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const file = fileIdx >= 0 && args[fileIdx + 1] ? args[fileIdx + 1] : "data/projects.json";
  return { file: isAbsolute(file) ? file : resolve(findRepoRoot(), file) };
}

async function main() {
  const { file } = parseArgs();

  console.log(`Reading ${file}...`);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const data: FileInput = fileInput.parse(raw);
  console.log(`  ${data.goals.length} goals, ${data.projects.length} projects`);

  // Build a name → id map for sprints (already seeded; used to resolve
  // project.sprint / allocation.sprint / sprintAllocation.sprint references).
  const sprints = await db.select({ id: sprintsTable.id, name: sprintsTable.name }).from(sprintsTable);
  const sprintByName = new Map(sprints.map((s) => [s.name, s.id]));

  // Validate references before any writes so we fail fast with a clear message.
  for (const p of data.projects) {
    if (p.sprint && !sprintByName.has(p.sprint)) {
      throw new Error(`Project "${p.title}": sprint "${p.sprint}" not found. Available: ${[...sprintByName.keys()].join(", ")}`);
    }
    for (const alloc of p.allocations) {
      if (!sprintByName.has(alloc.sprint)) {
        throw new Error(`Project "${p.title}" allocation: sprint "${alloc.sprint}" not found.`);
      }
    }
    for (const sa of p.sprintAllocations) {
      if (!sprintByName.has(sa.sprint)) {
        throw new Error(`Project "${p.title}" sprintAllocation: sprint "${sa.sprint}" not found.`);
      }
    }
    const goalNamesInFile = new Set(data.goals.map((g) => g.name));
    for (const gname of p.goals) {
      if (!goalNamesInFile.has(gname)) {
        throw new Error(`Project "${p.title}": goal "${gname}" not declared in top-level "goals" array.`);
      }
    }
  }

  await db.transaction(async (tx) => {
    // Wipe click-data tables in FK-safe order.
    console.log("Wiping click-data tables...");
    await tx.execute(sql`TRUNCATE TABLE project_updates, project_sprint_capacity_allocations, project_sprint_allocations, project_goals, projects, goals RESTART IDENTITY CASCADE`);

    // Insert goals; build name → id map for project_goals lookup.
    console.log(`Inserting ${data.goals.length} goals...`);
    const goalRows = data.goals.length
      ? await tx.insert(goalsTable).values(data.goals.map((g) => ({ name: g.name, color: g.color ?? "#6366f1" }))).returning({ id: goalsTable.id, name: goalsTable.name })
      : [];
    const goalByName = new Map(goalRows.map((g) => [g.name, g.id]));

    // Insert projects one at a time so we can attach goals/allocations/updates per id.
    console.log(`Inserting ${data.projects.length} projects + their allocations/updates/goals...`);
    for (const p of data.projects) {
      const [proj] = await tx.insert(projectsTable).values({
        title: p.title,
        description: p.description ?? null,
        functionName: p.functionName ?? null,
        team: p.team ?? null,
        status: p.status,
        storyPoints: p.storyPoints ?? null,
        startDate: p.startDate ?? null,
        endDate: p.endDate ?? null,
        sponsor: p.sponsor ?? null,
        impact: p.impact ?? null,
        sprintId: p.sprint ? sprintByName.get(p.sprint)! : null,
      }).returning({ id: projectsTable.id });

      if (p.sprintAllocations.length) {
        await tx.insert(projectSprintCapacityAllocationsTable).values(
          p.sprintAllocations.map((sa) => ({
            projectId: proj.id,
            sprintId: sprintByName.get(sa.sprint)!,
            allocationPercent: sa.percent.toString(),
          })),
        );
      }

      if (p.goals.length) {
        await tx.insert(projectGoalsTable).values(
          p.goals.map((gname) => ({ projectId: proj.id, goalId: goalByName.get(gname)! })),
        );
      }

      if (p.allocations.length) {
        await tx.insert(projectSprintAllocationsTable).values(
          p.allocations.map((a) => ({
            projectId: proj.id,
            sprintId: sprintByName.get(a.sprint)!,
            subTeam: a.subTeam as (typeof SUB_TEAMS)[number],
            storyPoints: a.storyPoints,
          })),
        );
      }

      if (p.updates.length) {
        await tx.insert(projectUpdatesTable).values(
          p.updates.map((u) => ({
            projectId: proj.id,
            content: u.content,
            authorName: u.author ?? null,
            ...(u.createdAt ? { createdAt: new Date(u.createdAt) } : {}),
          })),
        );
      }
    }
  });

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
