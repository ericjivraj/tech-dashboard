import type { ProjectStatus } from "@workspace/api-client-react";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  new_request: "Not Started",
  backlog: "Pre-Discovery",
  up_next: "Discovery",
  in_progress: "In Development",
  done: "Done",
};

export const STATUS_ORDER: ProjectStatus[] = [
  "new_request",
  "backlog",
  "up_next",
  "in_progress",
  "done",
];

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  new_request: "#c084fc",
  backlog: "#a855f7",
  up_next: "#3b82f6",
  in_progress: "#22c55e",
  done: "#10b981",
};

// The three lifecycle stages that can be individually scheduled with their
// own Timeline bar. Reuses the same status literals as STATUS_LABELS so
// stage bars share labels/colors with the rest of the app.
export const STAGE_ORDER = ["backlog", "up_next", "in_progress"] as const;
export type ProjectStage = (typeof STAGE_ORDER)[number];

export const SQUADS = ["User-facing", "Operator", "Onboarding", "Pulse"];
