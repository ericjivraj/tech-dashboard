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

export const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  low: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  at_risk: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export const TEAMS = ["Development", "Data", "Infrastructure", "Cybersecurity", "SysOps"];

export const SPONSORS = [
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
