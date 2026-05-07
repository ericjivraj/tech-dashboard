import type { ProjectStatus } from "@workspace/api-client-react";

export interface FilterState {
  search: string;
  // Empty array means "all statuses". Multi-select; e.g. ["in_progress", "up_next"]
  // hides every other status across kanban columns, gantt rows, and the list.
  status: ProjectStatus[];
  team: string;
  functionName: string;
  goalId: string;
  cycleId: string;
  sprintId: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: [],
  team: "all",
  functionName: "all",
  goalId: "all",
  cycleId: "all",
  sprintId: "all",
};

// A project belongs to a cycle if it has an allocation row for that cycle,
// or if its start date falls inside the cycle's [start, end). Cycle ranges
// are half-open so a project starting on the boundary day belongs to the
// later cycle only. Projects with no schedule at all (no allocations and no
// dates) are considered "floating" and pass through (the caller decides
// whether to include them).
export function projectMatchesCycle(
  project: {
    startDate?: string | null;
    cycleAllocations?: { cycleId: number }[];
  },
  cycle: { id: number; startDate: string; endDate: string },
): "match" | "floating" | "miss" {
  const allocs = project.cycleAllocations ?? [];
  if (allocs.some((a) => a.cycleId === cycle.id)) return "match";
  if (project.startDate) {
    const startMs = new Date(project.startDate).getTime();
    const cycleStartMs = new Date(cycle.startDate).getTime();
    const cycleEndMs = new Date(cycle.endDate).getTime();
    if (startMs >= cycleStartMs && startMs < cycleEndMs) return "match";
  }
  if (allocs.length === 0 && !project.startDate) return "floating";
  return "miss";
}
