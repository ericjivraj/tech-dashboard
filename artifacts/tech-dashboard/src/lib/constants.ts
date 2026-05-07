import type { ProjectStatus } from "@workspace/api-client-react";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  new_request: "New Requests",
  backlog: "Priorities",
  up_next: "Priorities Next Dev",
  in_progress: "In Progress",
  done: "Done",
};

export const STATUS_ORDER: ProjectStatus[] = [
  "new_request",
  "backlog",
  "up_next",
  "in_progress",
  "done",
];

export const PIPELINE_STATUS_ORDER: ProjectStatus[] = [
  "in_progress",
  "up_next",
  "backlog",
  "new_request",
  "done",
];

export const TEAMS = ["Development", "Data", "Infrastructure", "Cybersecurity", "SysOps"];

export const FUNCTIONS = [
  "Leadership",
  "Finance",
  "Operations",
  "Business Development",
  "Marketing",
  "Tech",
  "Cars",
  "Legal & Compliance",
  "Departments",
];

// Average story-point capacity of a single dev cycle. Used to express a
// project's total effort as a percentage of one cycle's worth of work, e.g.
// 5 / 324 = 1.54 %. TODO: move to per-cycle settings (capacity actually
// varies cycle-to-cycle based on holidays, headcount, etc.).
export const AVG_CYCLE_CAPACITY = 324;

export function cycleEffortPercent(storyPoints: number | null | undefined): string | null {
  if (storyPoints == null) return null;
  return ((storyPoints / AVG_CYCLE_CAPACITY) * 100).toFixed(2) + "%";
}
