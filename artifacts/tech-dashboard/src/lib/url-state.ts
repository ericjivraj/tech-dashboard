// View + filter state ↔ URL query string. Lets users share a link to a
// specific view/cycle/status combo and survives hard refresh.
//
// Encoding favours compactness and readability — default values are omitted,
// arrays are comma-joined, and short keys (q, cycle, function) are used.

import type { ProjectStatus } from "@workspace/api-client-react";
import { DEFAULT_FILTERS, type FilterState } from "./filter-types";

export type ViewKey = "kanban" | "gantt" | "pipeline";

const DEFAULT_VIEW: ViewKey = "kanban";
const VALID_VIEWS: ViewKey[] = ["kanban", "gantt", "pipeline"];
const VALID_STATUSES: ProjectStatus[] = ["new_request", "backlog", "up_next", "in_progress", "done"];

export interface UrlState {
  view: ViewKey;
  filters: FilterState;
}

export function serializeToQuery(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.view !== DEFAULT_VIEW) params.set("view", state.view);
  if (state.filters.search) params.set("q", state.filters.search);
  if (state.filters.status.length > 0) params.set("status", state.filters.status.join(","));
  if (state.filters.team !== "all") params.set("team", state.filters.team);
  if (state.filters.functionName !== "all") params.set("function", state.filters.functionName);
  if (state.filters.goalId !== "all") params.set("goal", state.filters.goalId);
  if (state.filters.cycleId !== "all") params.set("cycle", state.filters.cycleId);
  if (state.filters.sprintId !== "all") params.set("sprint", state.filters.sprintId);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function parseFromQuery(search: string): UrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawView = params.get("view");
  const view: ViewKey = rawView && (VALID_VIEWS as string[]).includes(rawView) ? (rawView as ViewKey) : DEFAULT_VIEW;
  const rawStatus = params.get("status");
  const status: ProjectStatus[] = rawStatus
    ? rawStatus
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is ProjectStatus => (VALID_STATUSES as string[]).includes(s))
    : [];
  return {
    view,
    filters: {
      ...DEFAULT_FILTERS,
      search: params.get("q") ?? "",
      status,
      team: params.get("team") ?? "all",
      functionName: params.get("function") ?? "all",
      goalId: params.get("goal") ?? "all",
      cycleId: params.get("cycle") ?? "all",
      sprintId: params.get("sprint") ?? "all",
    },
  };
}
