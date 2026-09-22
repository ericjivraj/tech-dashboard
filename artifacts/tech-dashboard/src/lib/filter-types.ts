import type { ProjectStatus } from "@workspace/api-client-react";

export interface FilterState {
  search: string;
  // Empty array means "all statuses". Multi-select; e.g. ["in_progress", "up_next"]
  // hides every other status across kanban columns, gantt rows, and the list.
  status: ProjectStatus[];
  team: string;
  goalId: string;
  sprintId: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: [],
  team: "all",
  goalId: "all",
  sprintId: "all",
};

// A project belongs to a sprint if it has an allocation row for that sprint,
// or if its start date falls inside the sprint's [start, end). Sprint ranges
// are half-open so a project starting on the boundary day belongs to the
// later sprint only. Projects with no schedule at all (no allocations and no
// dates) are considered "floating" and pass through (the caller decides
// whether to include them).
export function projectMatchesSprint(
  project: {
    startDate?: string | null;
    sprintAllocations?: { sprintId: number }[];
  },
  sprint: { id: number; startDate: string; endDate: string },
): "match" | "floating" | "miss" {
  const allocs = project.sprintAllocations ?? [];
  if (allocs.some((a) => a.sprintId === sprint.id)) return "match";
  if (project.startDate) {
    const startMs = new Date(project.startDate).getTime();
    const sprintStartMs = new Date(sprint.startDate).getTime();
    const sprintEndMs = new Date(sprint.endDate).getTime();
    if (startMs >= sprintStartMs && startMs < sprintEndMs) return "match";
  }
  if (allocs.length === 0 && !project.startDate) return "floating";
  return "miss";
}
