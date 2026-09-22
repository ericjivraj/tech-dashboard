import { useMemo, useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useGetDashboardSummary, useListProjects, useListSprints } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import KanbanView from "@/components/kanban-view";
import FilterBar from "@/components/filter-bar";
import { projectMatchesSprint, type FilterState } from "@/lib/filter-types";
import { parseFromQuery, serializeToQuery } from "@/lib/url-state";
import type { ProjectStatus } from "@workspace/api-client-react";

// Business view is intentionally narrower than the editor dashboard: only
// statuses that signal forward-looking or shipped work. Hides backlog and
// new_request entirely.
const BUSINESS_VISIBLE_STATUSES: ProjectStatus[] = ["up_next", "in_progress", "done"];
import { STATUS_LABELS, SQUADS } from "@/lib/constants";
import { matchesSearch } from "@/lib/search";

export default function BusinessView() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: allProjects, isLoading: isLoadingProjects } = useListProjects();
  const { data: sprints } = useListSprints();
  const initial = useMemo(
    () => parseFromQuery(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const [filters, setFilters] = useState<FilterState>(initial.filters);

  // Business view has no view-tab, so we always serialize view as kanban
  // (the default — gets omitted from the query string).
  useEffect(() => {
    const qs = serializeToQuery({ view: "kanban", filters });
    const next = `${window.location.pathname}${qs}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [filters]);

  const squads = SQUADS;

  const filteredProjects = useMemo(() => {
    if (!allProjects) return [];
    const focusedSprint = filters.sprintId !== "all" ? sprints?.find((s) => s.id.toString() === filters.sprintId) ?? null : null;
    return allProjects.filter((p) => {
      // Hard-gate to the business-allowed statuses regardless of any
      // user-applied status filter, so backlog/new_request never leak in.
      if (!BUSINESS_VISIBLE_STATUSES.includes(p.status as ProjectStatus)) return false;
      if (filters.search && !matchesSearch(p, filters.search)) return false;
      if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;
      if (filters.team !== "all" && p.team !== filters.team) return false;
      if (filters.goalId !== "all" && !p.goals.some((g) => g.id.toString() === filters.goalId)) return false;
      if (focusedSprint && projectMatchesSprint(p, focusedSprint) === "miss") return false;
      return true;
    });
  }, [allProjects, sprints, filters]);

  // Intersect the user's status filter with the allowed business set. Empty
  // user filter falls back to "all three allowed columns".
  const visibleStatuses = filters.status.length > 0
    ? filters.status.filter((s) => BUSINESS_VISIBLE_STATUSES.includes(s))
    : BUSINESS_VISIBLE_STATUSES;

  return (
    <div className="w-full px-6 py-6 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Overview</h1>
          <p className="text-muted-foreground mt-1">The centralized view for customer-facing product software development projects.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Dashboard created by Eric Jivraj</p>
        </div>
      </div>

      {isLoadingSummary || !summary ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1" data-testid="metric-total-projects">
              <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
              <p className="text-3xl font-bold">{summary.totalProjects}</p>
            </div>
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1" data-testid="metric-active-sprint">
              <p className="text-sm font-medium text-muted-foreground">Active Sprint</p>
              <p className="text-xl font-semibold truncate" title={summary.activeSprint?.name || "None"}>
                {summary.activeSprint?.name ?? "None"}
              </p>
              {summary.activeSprint?.startDate && summary.activeSprint?.endDate && (
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(summary.activeSprint.startDate), 'MMM d')} – {format(parseISO(summary.activeSprint.endDate), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm px-6 py-4" data-testid="status-breakdown">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Projects by Status</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
              {(
                [
                  { key: "new_request", color: "bg-purple-400" },
                  { key: "backlog", color: "bg-slate-400" },
                  { key: "up_next", color: "bg-indigo-400" },
                  { key: "in_progress", color: "bg-blue-500" },
                  { key: "done", color: "bg-emerald-500" },
                ] as const
              ).map(({ key, color }) => {
                const label = STATUS_LABELS[key];
                const count = (summary.countByStatus as Record<string, number>)[key] ?? 0;
                return (
                  <div key={key} className="flex flex-col gap-1" data-testid={`status-count-${key}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className="text-xl font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full space-y-4">
        <div className="flex flex-col gap-4 border-b pb-4">
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            squads={squads}
            filteredCount={filteredProjects.length}
            totalCount={allProjects?.length ?? 0}
            availableStatuses={BUSINESS_VISIBLE_STATUSES}
          />
        </div>

        <div className="mt-4 flex-1">
          {isLoadingProjects ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 h-full">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-2 min-h-[500px]">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <KanbanView projects={filteredProjects} readOnly={true} visibleStatuses={visibleStatuses} />
          )}
        </div>
      </div>
    </div>
  );
}
