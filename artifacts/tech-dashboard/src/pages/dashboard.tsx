import { useMemo, useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useGetDashboardSummary, useGetMe, useListProjects, useListCycles } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import KanbanView from "@/components/kanban-view";
import PipelineView from "@/components/pipeline-view";
import GanttView from "@/components/gantt-view";
import FilterBar from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Plus, Link2, Check, ExternalLink } from "lucide-react";
import ProjectModal from "@/components/project-modal";
import ProjectForm from "@/components/project-form";
import AdminPanel from "@/components/admin-panel";
import { projectMatchesCycle, type FilterState } from "@/lib/filter-types";
import { parseFromQuery, serializeToQuery, type ViewKey } from "@/lib/url-state";
import ExportButton from "@/components/export-button";
import { STATUS_LABELS, TEAMS, FUNCTIONS } from "@/lib/constants";
import { matchesSearch } from "@/lib/search";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: user } = useGetMe();
  const { data: allProjects, isLoading: isLoadingProjects } = useListProjects();
  const { data: cycles } = useListCycles();
  // Initialise from URL so a deep-linked share or hard refresh lands you on
  // the same view + filters. The effect below keeps the URL in sync as state
  // changes (replaceState — no history pollution per keystroke).
  const initial = useMemo(
    () => parseFromQuery(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const [view, setView] = useState<ViewKey>(initial.view);
  const [filters, setFilters] = useState<FilterState>(initial.filters);

  useEffect(() => {
    const qs = serializeToQuery({ view, filters });
    const next = `${window.location.pathname}${qs}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [view, filters]);

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [copiedBusinessLink, setCopiedBusinessLink] = useState(false);

  function handleShareBusinessView() {
    const businessUrl = new URL("/", window.location.origin).toString();
    navigator.clipboard.writeText(businessUrl).then(() => {
      setCopiedBusinessLink(true);
      setTimeout(() => setCopiedBusinessLink(false), 2000);
    }).catch(() => {
      window.open(businessUrl, "_blank", "noopener,noreferrer");
    });
  }

  const isEditor = user?.isEditor === true;
  const isAdmin = user?.role === "admin";

  const teams = TEAMS;
  const sponsors = FUNCTIONS;

  const today = new Date().toISOString().split("T")[0];

  const filteredProjects = useMemo(() => {
    if (!allProjects) return [];
    const focusedCycle = filters.cycleId !== "all" ? cycles?.find((c) => c.id.toString() === filters.cycleId) ?? null : null;
    return allProjects.filter((p) => {
      if (filters.search && !matchesSearch(p, filters.search)) return false;
      if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;
      if (filters.team !== "all" && p.team !== filters.team) return false;
      if (filters.functionName !== "all" && p.functionName !== filters.functionName) return false;
      if (filters.goalId !== "all" && !p.goals.some((g) => g.id.toString() === filters.goalId)) return false;
      if (focusedCycle && projectMatchesCycle(p, focusedCycle) === "miss") return false;
      if ((filters.sprintId ?? "all") !== "all" && p.sprintId?.toString() !== filters.sprintId) return false;
      return true;
    });
  }, [allProjects, cycles, filters]);

  return (
    <div className="w-full px-6 py-6 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Technology Overview</h1>
          <p className="text-muted-foreground mt-1">The centralized view for all technology projects. All projects undergo final prioritization by Senior Leadership (C-Suite).</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          {(isEditor || isAdmin) && (
            <div className="flex items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareBusinessView}
                data-testid="button-share-business-view"
                className="gap-1 rounded-r-none border-r-0"
              >
                {copiedBusinessLink ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Share business view
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(new URL("/", window.location.origin).toString(), "_blank", "noopener,noreferrer")}
                data-testid="button-open-business-view"
                className="rounded-l-none px-2"
                title="Open business view in new tab"
                aria-label="Open business view in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAdminPanelOpen(true)} data-testid="button-admin-settings">
              Admin Settings
            </Button>
          )}
          {isEditor && (
            <Button size="sm" className="gap-1" onClick={() => setProjectFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
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
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1" data-testid="metric-active-cycle">
              <p className="text-sm font-medium text-muted-foreground">Active Cycle</p>
              <p className="text-xl font-semibold truncate" title={summary.activeCycle?.name || "None"}>
                {summary.activeCycle?.name ?? "None"}
              </p>
              {summary.activeCycle?.startDate && summary.activeCycle?.endDate && (
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(summary.activeCycle.startDate), 'MMM d')} – {format(parseISO(summary.activeCycle.endDate), 'MMM d, yyyy')}
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
        <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)} className="w-full">
          <div className="flex flex-col gap-4 border-b pb-4">
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-[400px] grid-cols-3">
                <TabsTrigger value="kanban" data-testid="tab-kanban">Kanban</TabsTrigger>
                <TabsTrigger value="gantt" data-testid="tab-gantt">Timeline</TabsTrigger>
                <TabsTrigger value="pipeline" data-testid="tab-pipeline">List</TabsTrigger>
              </TabsList>
            </div>
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              teams={teams}
              sponsors={sponsors}
              filteredCount={filteredProjects.length}
              totalCount={allProjects?.length ?? 0}
            />
          </div>

          <div className="mt-4 flex-1">
            <TabsContent value="kanban" className="m-0 h-full border-0 p-0">
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
                <KanbanView projects={filteredProjects} visibleStatuses={filters.status} />
              )}
            </TabsContent>
            <TabsContent value="gantt" className="m-0 h-full border-0 p-0">
              <GanttView filters={filters} />
            </TabsContent>
            <TabsContent value="pipeline" className="m-0 h-full border-0 p-0">
              {isLoadingProjects ? (
                <div className="rounded-md border">
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <PipelineView projects={filteredProjects} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <ProjectForm open={projectFormOpen} onOpenChange={setProjectFormOpen} />
      <AdminPanel open={adminPanelOpen} onOpenChange={setAdminPanelOpen} />
    </div>
  );
}
