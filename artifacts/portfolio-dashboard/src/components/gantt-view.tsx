import { useState } from "react";
import { useGetProjectsTimeline, useListCycles, useListSprints, useGetCapacitySummary, ProjectWithDetails, ProjectTimeline } from "@workspace/api-client-react";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { format, parseISO, startOfYear, endOfYear, differenceInDays, startOfQuarter, endOfQuarter } from "date-fns";
import type { FilterState } from "@/lib/filter-types";
import { storyPointsToTShirt } from "@/lib/utils";


const QUARTERS = [
  { label: "Q1 (Jan–Mar)", value: "1" },
  { label: "Q2 (Apr–Jun)", value: "2" },
  { label: "Q3 (Jul–Sep)", value: "3" },
  { label: "Q4 (Oct–Dec)", value: "4" },
];

function getQuarterBounds(year: number, quarter: number): { start: Date; end: Date } {
  const monthStart = (quarter - 1) * 3;
  const start = startOfQuarter(new Date(year, monthStart, 1));
  const end = endOfQuarter(new Date(year, monthStart, 1));
  return { start, end };
}

interface GanttViewProps {
  filters: FilterState;
}

type CapacitySummaryRow = {
  id: number;
  name: string;
  a3Allocated: number;
  a3Budget: number | null;
  backendAllocated: number;
  backendBudget: number | null;
  frontendAllocated: number;
  frontendBudget: number | null;
};

function cycleOverallPct(row: CapacitySummaryRow | undefined): { pct: number; label: string } | null {
  if (!row) return null;
  const totalBudget = (row.a3Budget ?? 0) + (row.backendBudget ?? 0) + (row.frontendBudget ?? 0);
  if (totalBudget === 0) return null;
  const totalAllocated = row.a3Allocated + row.backendAllocated + row.frontendAllocated;
  const pct = Math.round((totalAllocated / totalBudget) * 100);
  return { pct, label: `${pct}%` };
}

export default function GanttView({ filters }: GanttViewProps) {
  const currentYear = new Date().getFullYear();
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);

  const timelineCycleId = selectedCycleId !== "all" ? parseInt(selectedCycleId) : null;
  const timelineWindowDates = (() => {
    if (timelineCycleId != null) return {};
    if (selectedQuarter !== "all") {
      const { start, end } = getQuarterBounds(currentYear, parseInt(selectedQuarter));
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    }
    return { startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31` };
  })();
  const { data: projects, isLoading } = useGetProjectsTimeline({
    year: currentYear,
    ...(timelineCycleId != null ? { cycleId: timelineCycleId } : {}),
    ...timelineWindowDates,
  });
  const { data: cycles } = useListCycles();
  const { data: sprints } = useListSprints();

  const { data: capacitySummary } = useGetCapacitySummary(
    selectedCycleId !== "all" ? { cycleId: parseInt(selectedCycleId) } : {},
  );

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full rounded-xl" />;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-muted/20">
        <p className="text-muted-foreground text-sm">No timeline data available for {currentYear}</p>
      </div>
    );
  }

  let viewStart = startOfYear(new Date(currentYear, 0, 1));
  let viewEnd = endOfYear(viewStart);

  if (selectedQuarter !== "all") {
    const q = parseInt(selectedQuarter);
    const bounds = getQuarterBounds(currentYear, q);
    viewStart = bounds.start;
    viewEnd = bounds.end;
  }

  if (selectedCycleId !== "all" && cycles) {
    const cycle = cycles.find((c) => c.id.toString() === selectedCycleId);
    if (cycle) {
      viewStart = parseISO(cycle.startDate);
      viewEnd = parseISO(cycle.endDate);
    }
  }

  // When viewing all cycles with no quarter filter, skip completed cycles
  // by clamping viewStart to the first cycle that hasn't ended yet.
  if (selectedCycleId === "all" && selectedQuarter === "all" && cycles) {
    const today = new Date();
    const firstActiveCycle = [...cycles]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .find((c) => parseISO(c.endDate) >= today);
    if (firstActiveCycle) {
      viewStart = parseISO(firstActiveCycle.startDate);
    }
  }

  const totalDays = Math.max(1, differenceInDays(viewEnd, viewStart));
  const today = new Date();

  const cyclesInView = cycles
    ? cycles
        .filter((c) => parseISO(c.startDate) < viewEnd && parseISO(c.endDate) > viewStart)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  const selectedCycle = selectedCycleId !== "all" ? cycles?.find((c) => c.id.toString() === selectedCycleId) ?? null : null;
  const sprintsForCycle = selectedCycle && sprints
    ? [...sprints.filter((s) => s.cycleId === selectedCycle.id)].sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];
  const showSprintHeaders = sprintsForCycle.length > 0;

  const getBarPosition = (start: string, end: string) => {
    const sDate = Math.max(parseISO(start).getTime(), viewStart.getTime());
    const eDate = Math.min(parseISO(end).getTime(), viewEnd.getTime());

    if (sDate > viewEnd.getTime() || eDate < viewStart.getTime()) return null;

    const left = (differenceInDays(new Date(sDate), viewStart) / totalDays) * 100;
    const width = (differenceInDays(new Date(eDate), new Date(sDate)) / totalDays) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.max(0.5, width)}%` };
  };

  let filteredProjects = projects.filter((p) => {
    const hasOwnDates = p.startDate && p.endDate;
    const hasCycleFallback = !p.startDate && !p.endDate && p.status === "blocked" && p.cycleStartDate && p.cycleEndDate;
    return hasOwnDates || hasCycleFallback;
  });

  if (selectedCycleId !== "all") {
    filteredProjects = filteredProjects.filter((p) => {
      const cycle = cycles?.find((c) => c.id.toString() === selectedCycleId);
      if (!cycle) return false;
      return p.cycleName === cycle.name;
    });
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    filteredProjects = filteredProjects.filter((p) => p.title.toLowerCase().includes(q));
  }
  if (filters.status !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.status === filters.status);
  }
  if (filters.team !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.team === filters.team);
  }
  if (filters.sponsor !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.sponsor === filters.sponsor);
  }
  if (filters.goalId !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.goals.some((g) => g.id.toString() === filters.goalId));
  }
  if (filters.cycleId !== "all" && cycles) {
    const cycle = cycles.find((c) => c.id.toString() === filters.cycleId);
    if (cycle) {
      filteredProjects = filteredProjects.filter((p) => p.cycleName === cycle.name);
    }
  }
  if ((filters.sprintId ?? "all") !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.sprintId?.toString() === filters.sprintId);
  }
  if ((filters.size ?? "all") !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.storyPoints != null && storyPointsToTShirt(p.storyPoints).label === filters.size);
  }

  const visibleProjects = filteredProjects.filter((p) => {
    const startDate = p.startDate ?? p.cycleStartDate;
    const endDate = p.endDate ?? p.cycleEndDate;
    if (!startDate || !endDate) return false;
    const pos = getBarPosition(startDate, endDate);
    return pos !== null;
  });

  const capacityByCycleId = new Map(
    (capacitySummary?.rows as CapacitySummaryRow[] ?? []).map((r) => [r.id, r])
  );

  const projectsByCycleId = new Map<number, typeof visibleProjects>();
  for (const p of visibleProjects) {
    if (p.cycleId == null) continue;
    if (!projectsByCycleId.has(p.cycleId)) projectsByCycleId.set(p.cycleId, []);
    projectsByCycleId.get(p.cycleId)!.push(p);
  }

  return (
    <>
      <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3" data-testid="gantt-filters">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">Quarter</span>
            <Select value={selectedQuarter} onValueChange={(v) => { setSelectedQuarter(v); setSelectedCycleId("all"); }} data-testid="gantt-quarter-filter">
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="All quarters" />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Year</SelectItem>
                {QUARTERS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedQuarter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedQuarter("all")}
              data-testid="gantt-clear-filters"
            >
              Clear view filters
            </Button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""} shown
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {[
            { color: "#3b82f6", label: "In development", desc: "Prioritized & actively being built this cycle" },
            { color: "#eab308", label: "Planned & upcoming", desc: "Prioritized & scheduled for a future cycle" },
            { color: "#a855f7", label: "Awaiting scheduling", desc: "Future opportunity identified, not yet planned or prioritized" },
            { color: "#ef4444", label: "Blocked", desc: "Progress halted, needs attention" },
          ].map(({ color, label, desc }) => (
            <div key={label} className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 min-w-[200px]">
              <span className="w-4 h-4 rounded shrink-0 mt-0.5" style={{ backgroundColor: color }} />
              <div>
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <div className="min-w-[700px] p-4">
            <div className="flex mb-4 relative ml-[240px] border-b pb-2">
              <div className="absolute left-[-240px] flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Project
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" aria-label="About Project column">
                      <Info className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" className="w-auto max-w-[220px] px-3 py-1.5 text-xs">
                    Project name with team, sponsor, stakeholder, and goals
                  </PopoverContent>
                </Popover>
              </div>
              {showSprintHeaders ? (
                sprintsForCycle.map((sprint) => {
                  const sprintDays = Math.max(1, differenceInDays(parseISO(sprint.endDate), parseISO(sprint.startDate)));
                  const widthPct = (sprintDays / totalDays) * 100;
                  return (
                    <div
                      key={sprint.id}
                      className="text-xs font-medium text-muted-foreground text-center border-l first:border-l-0 border-border/50 px-1 overflow-hidden"
                      style={{ width: `${widthPct}%` }}
                    >
                      <div className="font-semibold text-foreground truncate">{sprint.name}</div>
                      <div className="text-[10px] font-normal truncate">
                        {format(parseISO(sprint.startDate), 'MMM d')} – {format(parseISO(sprint.endDate), 'MMM d')}
                      </div>
                    </div>
                  );
                })
              ) : (
                cyclesInView.map((cycle) => {
                  const cStart = Math.max(parseISO(cycle.startDate).getTime(), viewStart.getTime());
                  const cEnd = Math.min(parseISO(cycle.endDate).getTime(), viewEnd.getTime());
                  const widthPct = (differenceInDays(new Date(cEnd), new Date(cStart)) / totalDays) * 100;
                  const cap = capacityByCycleId.get(cycle.id);
                  const overallCap = cycleOverallPct(cap);
                  const isActive = parseISO(cycle.startDate) <= today && parseISO(cycle.endDate) >= today;
                  const cycleProjects = projectsByCycleId.get(cycle.id) ?? [];
                  const totalBudget = (cap?.a3Budget ?? 0) + (cap?.backendBudget ?? 0) + (cap?.frontendBudget ?? 0);
                  return (
                    <Popover key={cycle.id}>
                      <PopoverTrigger asChild>
                        <div
                          className={`text-xs font-medium text-foreground text-center border-l first:border-l-0 border-border/50 px-1 overflow-hidden rounded-sm cursor-pointer ${isActive ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                          style={{ width: `${widthPct}%` }}
                        >
                          <div className={`font-semibold truncate ${isActive ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
                            {cycle.name}{isActive && <span className="ml-1 text-[9px] font-medium bg-blue-600 text-white rounded-full px-1 py-0.5 leading-none align-middle">Now</span>}
                          </div>
                          <div className="text-xs font-normal truncate">
                            {format(parseISO(cycle.startDate), 'MMM d')} – {format(parseISO(cycle.endDate), 'MMM d')}
                          </div>
                          {overallCap && (
                            <div className="mt-1.5 px-0.5">
                              <div className="flex items-center gap-1">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${overallCap.pct >= 100 ? "bg-red-500" : overallCap.pct >= 80 ? "bg-amber-400" : "bg-blue-400"}`}
                                    style={{ width: `${Math.min(overallCap.pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-foreground w-7 text-right shrink-0 tabular-nums">{overallCap.label}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </PopoverTrigger>
                      {cycleProjects.length > 0 && cap && totalBudget > 0 && (
                        <PopoverContent side="bottom" className="w-52 p-3 space-y-1.5 text-xs">
                          <p className="font-semibold text-foreground text-sm mb-2">{cycle.name} — capacity</p>
                          {cycleProjects.map((p) => {
                            const pts = p.storyPoints ?? 0;
                            const pct = Math.round((pts / totalBudget) * 100);
                            return (
                              <div key={p.id} className="flex justify-between gap-2">
                                <span className="truncate text-foreground">{p.title}</span>
                                <span className="shrink-0 tabular-nums font-medium text-foreground">{pct}%</span>
                              </div>
                            );
                          })}
                        </PopoverContent>
                      )}
                    </Popover>
                  );
                })
              )}
            </div>

            {visibleProjects.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground text-sm">No projects match the current filters in this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleProjects.map((project) => {
                  const effectiveStart = project.startDate ?? project.cycleStartDate!;
                  const effectiveEnd = project.endDate ?? project.cycleEndDate!;
                  const usingCycleFallback = !project.startDate && !project.endDate;
                  const pos = getBarPosition(effectiveStart, effectiveEnd);
                  if (!pos) return null;
                  const isCurrent = project.cycleStartDate && project.cycleEndDate
                    && parseISO(project.cycleStartDate) <= today && parseISO(project.cycleEndDate) >= today;
                  const isFuture = project.cycleStartDate && parseISO(project.cycleStartDate) > today;
                  const color = project.status === "blocked"
                    ? "#ef4444"
                    : project.team === "Data"
                      ? "#a855f7"
                      : isCurrent
                        ? "#3b82f6"
                        : isFuture
                          ? "#eab308"
                          : "#94a3b8";

                  return (
                    <div
                      key={project.id}
                      className={`flex items-center group relative -mx-4 px-4 py-1 rounded cursor-pointer ${project.status === "blocked" ? "bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/60" : "hover:bg-muted/20"}`}
                      data-testid={`gantt-row-${project.id}`}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <div className="w-[230px] shrink-0 pr-4">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-medium truncate" title={project.title}>{project.title}</div>
                          {project.status === "blocked" && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300 leading-none">Blocked</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-foreground truncate">{project.team || "No team"}</span>
                        </div>
                      </div>

                      <div className="flex-1 relative h-7 bg-muted/10 rounded overflow-hidden">
                        {showSprintHeaders ? sprintsForCycle.map((sprint) => {
                          const left = (differenceInDays(parseISO(sprint.startDate), viewStart) / totalDays) * 100;
                          return (
                            <div
                              key={sprint.id}
                              className="absolute top-0 bottom-0 border-l border-border/40"
                              style={{ left: `${Math.max(0, left)}%` }}
                            />
                          );
                        }) : cyclesInView.map((cycle) => {
                          const left = (differenceInDays(parseISO(cycle.startDate), viewStart) / totalDays) * 100;
                          return left > 0 ? (
                            <div
                              key={cycle.id}
                              className="absolute top-0 bottom-0 border-l border-border/40"
                              style={{ left: `${left}%` }}
                            />
                          ) : null;
                        })}
                        <div
                          className="absolute top-1 bottom-1 rounded-sm shadow-sm transition-opacity opacity-90 hover:opacity-100"
                          style={{
                            left: pos.left,
                            width: pos.width,
                            ...(project.status === "blocked"
                              ? { backgroundImage: `repeating-linear-gradient(-45deg, ${color}, ${color} 5px, rgba(0,0,0,0.18) 5px, rgba(0,0,0,0.18) 10px)` }
                              : { backgroundColor: color })
                          }}
                          title={`${project.title}\n${format(parseISO(effectiveStart), 'MMM d')} — ${format(parseISO(effectiveEnd), 'MMM d, yyyy')}${usingCycleFallback ? '\n(dates from cycle)' : ''}`}
                        >
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-sm" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {selectedProjectId && (
        <ProjectModal
          projectId={selectedProjectId}
          open={!!selectedProjectId}
          onOpenChange={(open) => { if (!open) setSelectedProjectId(null); }}
          onEdit={(project) => {
            setSelectedProjectId(null);
            setProjectToEdit(project);
          }}
        />
      )}
      <ProjectForm
        open={!!projectToEdit}
        onOpenChange={(open) => { if (!open) setProjectToEdit(null); }}
        projectToEdit={projectToEdit}
      />
      </>
    </>
  );
}
