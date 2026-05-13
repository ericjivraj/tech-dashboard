import { useMemo, useRef, useState } from "react";
import {
  useGetProjectsTimeline,
  useListCycles,
  useListSprints,
  useGetMe,
  useUpdateProject,
  getGetProjectsTimelineQueryKey,
  getListProjectsQueryKey,
  ProjectWithDetails,
  ProjectTimeline,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Info, GripVertical, MoreHorizontal } from "lucide-react";
import { format, parseISO, startOfYear, endOfYear, differenceInDays } from "date-fns";
import { projectMatchesCycle, type FilterState } from "@/lib/filter-types";
import { matchesSearch } from "@/lib/search";
import { computeInsertOrder } from "@/lib/order";
import { isProjectBlocked } from "@/lib/blocked";
import { AVG_CYCLE_CAPACITY, cycleEffortPercent } from "@/lib/constants";
import { planMoveToCycle } from "@/lib/move-to-cycle";
import { useToast } from "@/hooks/use-toast";


interface GanttViewProps {
  filters: FilterState;
}

type CycleAllocation = {
  cycleId: number;
  cycleName: string;
  cycleStartDate: string;
  cycleEndDate: string;
  percent: number;
};

function getCycleAllocations(p: unknown): CycleAllocation[] {
  return (p as { cycleAllocations?: CycleAllocation[] }).cycleAllocations ?? [];
}

// Effective Gantt-bar span. Priority: explicit start/end dates → cycle
// allocations (min cycle start → max cycle end). A project with only a primary
// cycle assigned (and no allocations or dates) is treated as not yet
// committed to a timeline and hidden from the Gantt — it still appears in the
// kanban view under its status column.
function getEffectiveDates(p: ProjectTimeline): { start: string; end: string } | null {
  if (p.startDate && p.endDate) return { start: p.startDate, end: p.endDate };
  const allocs = getCycleAllocations(p);
  if (allocs.length > 0) {
    return { start: allocs[0].cycleStartDate, end: allocs[allocs.length - 1].cycleEndDate };
  }
  return null;
}

export default function GanttView({ filters }: GanttViewProps) {
  const currentYear = new Date().getFullYear();
  // Cycle zoom is driven by the global filter so picking a cycle in the
  // filter-bar zooms the timeline AND restricts rows in one move.
  const selectedCycleId = filters.cycleId;
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);

  const timelineCycleId = selectedCycleId !== "all" ? parseInt(selectedCycleId) : null;
  const timelineWindowDates =
    timelineCycleId != null
      ? {}
      : { startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31` };
  const { data: projects, isLoading } = useGetProjectsTimeline({
    year: currentYear,
    ...(timelineCycleId != null ? { cycleId: timelineCycleId } : {}),
    ...timelineWindowDates,
  });
  const { data: cycles } = useListCycles();
  const { data: sprints } = useListSprints();

  const { data: me } = useGetMe();
  const isEditor = me?.isEditor === true;

  const queryClient = useQueryClient();
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  const justDraggedRef = useRef(false);

  const cyclesSorted = useMemo(
    () => (cycles ? [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate)) : []),
    [cycles],
  );

  const handleMoveProjectToCycle = (project: ProjectTimeline, targetCycleId: number) => {
    const targetCycle = cyclesSorted.find((c) => c.id === targetCycleId);
    if (!targetCycle) return;
    const plan = planMoveToCycle(
      {
        storyPoints: project.storyPoints,
        startDate: project.startDate ?? null,
        endDate: project.endDate ?? null,
        cycleAllocations: getCycleAllocations(project),
      },
      targetCycle,
      cyclesSorted,
    );
    updateProject.mutate(
      {
        id: project.id,
        data: {
          cycleAllocations: plan.cycleAllocations,
          startDate: plan.startDate,
          endDate: plan.endDate,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: timelineQueryKey });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          const bits: string[] = [`Moved to ${targetCycle.name}`];
          if (plan.summary.droppedAllocations > 0) {
            bits.push(`${plan.summary.droppedAllocations} allocation${plan.summary.droppedAllocations === 1 ? "" : "s"} fell off the cycle range`);
          }
          if (plan.summary.createdAllocation) bits.push("created cycle allocation from story points");
          toast({ title: bits[0], description: bits.slice(1).join(" · ") || undefined });
        },
        onError: (err) => {
          toast({
            title: "Move failed",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        },
      },
    );
  };
  const timelineQueryKey = getGetProjectsTimelineQueryKey({
    year: currentYear,
    ...(timelineCycleId != null ? { cycleId: timelineCycleId } : {}),
    ...timelineWindowDates,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 100);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const movedId = Number(active.id);
    const overId = Number(over.id);

    const ordered = (projects ?? [])
      .slice()
      .sort((a, b) => a.timelineOrder - b.timelineOrder || a.id - b.id);
    const moved = ordered.find((p) => p.id === movedId);
    if (!moved) return;

    const overIdx = ordered.findIndex((p) => p.id === overId);
    if (overIdx === -1) return;
    const movedIdx = ordered.findIndex((p) => p.id === movedId);
    const adjusted = movedIdx !== -1 && movedIdx < overIdx ? overIdx - 1 : overIdx;

    const newTimelineOrder = computeInsertOrder(ordered, adjusted, movedId, (p) => p.timelineOrder);
    if (newTimelineOrder === moved.timelineOrder) return;

    const previous = queryClient.getQueryData<ProjectTimeline[]>(timelineQueryKey);
    if (previous) {
      queryClient.setQueryData<ProjectTimeline[]>(
        timelineQueryKey,
        previous.map((p) => (p.id === movedId ? { ...p, timelineOrder: newTimelineOrder } : p)),
      );
    }

    updateProject.mutate(
      { id: movedId, data: { timelineOrder: newTimelineOrder } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: timelineQueryKey });
        },
        onError: () => {
          if (previous) queryClient.setQueryData(timelineQueryKey, previous);
          queryClient.invalidateQueries({ queryKey: timelineQueryKey });
        },
      },
    );
  }

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

  if (selectedCycleId !== "all" && cycles) {
    const cycle = cycles.find((c) => c.id.toString() === selectedCycleId);
    if (cycle) {
      viewStart = parseISO(cycle.startDate);
      viewEnd = parseISO(cycle.endDate);
    }
  }

  // When viewing all cycles, skip completed ones by clamping viewStart to
  // the first cycle that hasn't ended yet.
  if (selectedCycleId === "all" && cycles) {
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
    const startMs = parseISO(start).getTime();
    const endMs = parseISO(end).getTime();
    // Treat cycle/view ranges as half-open [start, end) so boundary days don't
    // attribute a bar to two cycles. E.g. Cycle D ends 2026-05-13 and Cycle E
    // starts 2026-05-13 — a project starting 2026-05-13 belongs to E only,
    // and shouldn't render at the right edge of D's view.
    if (startMs >= viewEnd.getTime() || endMs <= viewStart.getTime()) return null;

    const sDate = Math.max(startMs, viewStart.getTime());
    const eDate = Math.min(endMs, viewEnd.getTime());
    const left = (differenceInDays(new Date(sDate), viewStart) / totalDays) * 100;
    const width = (differenceInDays(new Date(eDate), new Date(sDate)) / totalDays) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.max(0.5, width)}%` };
  };

  // Start with every project. Status / cycle / search filters below decide
  // what shows up. Unscheduled projects (no dates, no allocations, no primary
  // cycle) appear as rows with no bar — that's how new_request items become
  // discoverable in the timeline. Bar rendering and cycle-header %
  // calculations naturally skip projects without dates/allocations.
  let filteredProjects = [...projects];

  if (filters.search) {
    filteredProjects = filteredProjects.filter((p) => matchesSearch(p, filters.search));
  }
  if (filters.status.length > 0) {
    filteredProjects = filteredProjects.filter((p) => filters.status.includes(p.status));
  }
  if (filters.team !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.team === filters.team);
  }
  if (filters.functionName !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.functionName === filters.functionName);
  }
  if (filters.goalId !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.goals.some((g) => g.id.toString() === filters.goalId));
  }
  // The cycle filter zooms the timeline (drives viewStart/viewEnd above) AND
  // restricts rows so the focused-cycle view is honest. Same rule as
  // dashboard.tsx / business.tsx: a project shows when it has an allocation
  // for the focused cycle, when its start date falls in the cycle's
  // half-open range, or when it has no schedule at all (floating row).
  if (filters.cycleId !== "all" && cycles) {
    const focusedCycle = cycles.find((c) => c.id.toString() === filters.cycleId);
    if (focusedCycle) {
      filteredProjects = filteredProjects.filter((p) => projectMatchesCycle(p, focusedCycle) !== "miss");
    }
  }
  if ((filters.sprintId ?? "all") !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.sprintId?.toString() === filters.sprintId);
  }

  // Show every filtered project as a row. If the bar falls outside the
  // current view (e.g. zoomed to Cycle D, project has dates in Cycle E), the
  // row appears with no visible bar — Row's getBarPosition returns null and
  // the bar element is conditionally hidden.
  const visibleProjects = filteredProjects;

  // Cycle header totals are independent of the active row filters — the %
  // for "Cycle E" represents the real allocation against that cycle, not
  // "the allocation among the projects you happen to be looking at right
  // now". Built from the unfiltered project list so toggling status / team /
  // sponsor / goal / cycle / search filters never changes the header sum.
  const projectsByCycleId = new Map<number, typeof projects>();
  for (const p of projects) {
    const allocs = getCycleAllocations(p);
    if (allocs.length === 0) continue;
    for (const a of allocs) {
      if (!projectsByCycleId.has(a.cycleId)) projectsByCycleId.set(a.cycleId, []);
      projectsByCycleId.get(a.cycleId)!.push(p);
    }
  }

  return (
    <>
      <>
      <div className="space-y-4">
        {/* Quarter + Status + Clear filters used to live here, but they
            duplicated the global filter-bar above. The filter-bar now drives
            cycle zoom and status multi-select for the timeline directly. */}

        <div className="flex flex-wrap gap-3">
          {[
            { color: "#22c55e", label: "Green", desc: "On track" },
            { color: "#f59e0b", label: "Amber", desc: "At risk, needs attention" },
            { color: "#ef4444", label: "Red", desc: "Critical, escalation required" },
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
            <div className="flex flex-col mb-4 relative ml-[240px] border-b pb-2">
              <div className="absolute left-[-240px] top-0 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Project
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" aria-label="About Project column">
                      <Info className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" className="w-auto max-w-[220px] px-3 py-1.5 text-xs">
                    Project name with team, functionName, sponsor, and goals
                  </PopoverContent>
                </Popover>
              </div>
              {/* Cycle row: when zoomed, just the focused cycle (full view width).
                  Otherwise, every cycle that intersects the view. Always
                  clickable to show the per-project allocation popover. */}
              <div className="flex">
                {(showSprintHeaders && selectedCycle ? [selectedCycle] : cyclesInView).map((cycle) => {
                  const cStart = Math.max(parseISO(cycle.startDate).getTime(), viewStart.getTime());
                  const cEnd = Math.min(parseISO(cycle.endDate).getTime(), viewEnd.getTime());
                  const widthPct = (differenceInDays(new Date(cEnd), new Date(cStart)) / totalDays) * 100;
                  const isActive = parseISO(cycle.startDate) <= today && parseISO(cycle.endDate) >= today;
                  const cycleProjects = projectsByCycleId.get(cycle.id) ?? [];

                  // Sum each project's allocation percent specifically for this cycle.
                  const literalSum = cycleProjects
                    .map((p) => getCycleAllocations(p).find((a) => a.cycleId === cycle.id)?.percent ?? null)
                    .filter((v): v is number => v != null)
                    .reduce((s, v) => s + v, 0);
                  const overallCap = literalSum > 0
                    ? { pct: literalSum, label: `${literalSum.toFixed(1)}%` }
                    : null;
                  return (
                    <Popover key={cycle.id}>
                      <PopoverTrigger asChild>
                        <div
                          className={`text-sm font-medium text-foreground text-center border-l first:border-l-0 border-border/50 px-2 overflow-hidden rounded-sm cursor-pointer ${isActive ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                          style={{ width: `${widthPct}%` }}
                        >
                          <div className={`font-bold truncate text-sm ${isActive ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
                            {cycle.name}{isActive && <span className="ml-1 text-[10px] font-medium bg-blue-600 text-white rounded-full px-1.5 py-0.5 leading-none align-middle">Now</span>}
                          </div>
                          <div className="text-xs font-normal truncate mt-0.5">
                            {format(parseISO(cycle.startDate), 'MMM d')} – {format(parseISO(cycle.endDate), 'MMM d')}
                          </div>
                          {overallCap && (
                            <div className="mt-2 px-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-400"
                                    style={{ width: `${Math.min(overallCap.pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">{overallCap.label}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </PopoverTrigger>
                      {cycleProjects.length > 0 && (
                        <PopoverContent side="bottom" className="w-[28rem] max-w-[90vw] p-4 space-y-2 text-sm">
                          <p className="font-bold text-foreground text-base mb-3">{cycle.name}: Project Allocation</p>
                          {[...cycleProjects]
                            .map((p) => ({ p, percent: getCycleAllocations(p).find((a) => a.cycleId === cycle.id)?.percent ?? 0 }))
                            .sort((a, b) => b.percent - a.percent)
                            .map(({ p, percent }) => (
                              <div key={p.id} className="flex justify-between gap-3">
                                <span className="text-foreground break-words" title={p.title}>{p.title}</span>
                                <span className="shrink-0 tabular-nums font-semibold text-foreground">{percent > 0 ? `${percent.toFixed(1)}%` : "—"}</span>
                              </div>
                            ))}
                          <div className="border-t border-border/50 pt-2 mt-1 flex justify-between gap-3">
                            <span className="text-muted-foreground">Total allocated</span>
                            <span className="shrink-0 tabular-nums font-semibold text-foreground">
                              {literalSum > 0 ? `${literalSum.toFixed(1)}%` : "—"}
                            </span>
                          </div>
                        </PopoverContent>
                      )}
                    </Popover>
                  );
                })}
              </div>

              {showSprintHeaders && (
                <div className="flex mt-2 border-t border-border/30 pt-2">
                  {sprintsForCycle.map((sprint) => {
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
                  })}
                </div>
              )}
            </div>

            {visibleProjects.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground text-sm">No projects match the current filters in this period</p>
              </div>
            ) : isEditor ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={visibleProjects.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {visibleProjects.map((project) => (
                      <SortableGanttRow
                        key={project.id}
                        project={project}
                        onClick={() => {
                          if (justDraggedRef.current) return;
                          setSelectedProjectId(project.id);
                        }}
                      >
                        <GanttRowContent
                          project={project}
                          today={today}
                          viewStart={viewStart}
                          totalDays={totalDays}
                          showSprintHeaders={showSprintHeaders}
                          sprintsForCycle={sprintsForCycle}
                          cyclesInView={cyclesInView}
                          getBarPosition={getBarPosition}
                          availableCycles={cyclesSorted}
                          onMoveToCycle={(cycleId) => handleMoveProjectToCycle(project, cycleId)}
                          dragHandle={
                            <DragHandle />
                          }
                        />
                      </SortableGanttRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-3">
                {visibleProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-center group relative -mx-4 px-4 py-1 rounded cursor-pointer ${isProjectBlocked(project) ? "bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/60" : "hover:bg-muted/20"}`}
                    data-testid={`gantt-row-${project.id}`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <GanttRowContent
                      project={project}
                      today={today}
                      viewStart={viewStart}
                      totalDays={totalDays}
                      showSprintHeaders={showSprintHeaders}
                      sprintsForCycle={sprintsForCycle}
                      cyclesInView={cyclesInView}
                      getBarPosition={getBarPosition}
                      dragHandle={null}
                    />
                  </div>
                ))}
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

function SortableGanttRow({
  project,
  onClick,
  children,
}: {
  project: ProjectTimeline;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center group relative -mx-4 px-4 py-1 rounded ${isProjectBlocked(project) ? "bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/60" : "hover:bg-muted/20"}`}
      data-testid={`gantt-row-${project.id}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function DragHandle() {
  return (
    <div
      className="text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing pr-1.5 shrink-0"
      aria-hidden
    >
      <GripVertical className="h-4 w-4" />
    </div>
  );
}

// Inline kebab menu on each gantt row. Hidden until row-hover (group-hover),
// visible while open. Lists every cycle; clicking one shifts the project's
// allocations + dates to that cycle (handled by the parent's
// onMoveToCycle, which calls planMoveToCycle then PATCHes). The current
// "anchor" cycle (earliest allocated) is marked and disabled to prevent
// accidental no-op moves.
function RowKebab({
  project,
  cycles,
  onMoveToCycle,
}: {
  project: ProjectTimeline;
  cycles: { id: number; name: string }[];
  onMoveToCycle: (cycleId: number) => void;
}) {
  const allocs = getCycleAllocations(project);
  const allocCycleIds = new Set(allocs.map((a) => a.cycleId));
  // Anchor = the currently-earliest allocation, or the project's primary cycle if no allocations.
  const anchorCycleId = allocs.length > 0
    ? [...allocs].sort((a, b) => a.cycleStartDate.localeCompare(b.cycleStartDate))[0].cycleId
    : project.cycleId ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted border border-border/40"
          aria-label="Project actions"
          data-testid={`gantt-row-kebab-${project.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        className="w-56"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">Move to cycle</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {cycles.map((c) => {
          const isAnchor = c.id === anchorCycleId;
          const hasAlloc = allocCycleIds.has(c.id);
          return (
            <DropdownMenuItem
              key={c.id}
              disabled={isAnchor}
              onSelect={() => onMoveToCycle(c.id)}
              data-testid={`gantt-move-${project.id}-${c.id}`}
              className="flex items-center justify-between gap-2"
            >
              <span>{c.name}</span>
              {isAnchor ? (
                <span className="text-[10px] uppercase text-muted-foreground">Current</span>
              ) : hasAlloc ? (
                <span className="text-[10px] uppercase text-muted-foreground">Allocated</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface GanttRowContentProps {
  project: ProjectTimeline;
  today: Date;
  viewStart: Date;
  totalDays: number;
  showSprintHeaders: boolean;
  sprintsForCycle: { id: number; startDate: string; endDate: string }[];
  cyclesInView: { id: number; startDate: string }[];
  getBarPosition: (start: string, end: string) => { left: string; width: string } | null;
  dragHandle: React.ReactNode;
  // Editor-only: when set, renders a hover-revealed "..." menu in the row
  // with cycles to move the project to. Selecting a cycle reallocates the
  // project (and shifts dates) via planMoveToCycle.
  availableCycles?: { id: number; name: string }[];
  onMoveToCycle?: (cycleId: number) => void;
}

function GanttRowContent({
  project,
  today,
  viewStart,
  totalDays,
  showSprintHeaders,
  sprintsForCycle,
  cyclesInView,
  getBarPosition,
  dragHandle,
  availableCycles,
  onMoveToCycle,
}: GanttRowContentProps) {
  const dates = getEffectiveDates(project);
  const effectiveStart = dates?.start;
  const effectiveEnd = dates?.end;
  const usingCycleFallback = !project.startDate && !project.endDate;
  const pos = dates ? getBarPosition(dates.start, dates.end) : null;
  const color =
    project.ragStatus === "red"
      ? "#ef4444"
      : project.ragStatus === "amber"
        ? "#f59e0b"
        : "#22c55e";

  return (
    <>
      {dragHandle}
      <div className="w-[230px] shrink-0 pr-4">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="text-sm font-medium truncate min-w-0 flex-1" title={project.title}>
            {project.title}
          </div>
          {isProjectBlocked(project) && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300 leading-none">
              Blocked
            </span>
          )}
          {availableCycles && onMoveToCycle && (
            <RowKebab
              project={project}
              cycles={availableCycles}
              onMoveToCycle={onMoveToCycle}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-foreground truncate">{project.team || "No team"}</span>
          {project.storyPoints != null && (
            <Badge
              variant="outline"
              className="shrink-0 text-xs font-semibold px-2 py-0.5 bg-muted/50"
              title={`${project.storyPoints} pts of ~${AVG_CYCLE_CAPACITY} avg per cycle`}
            >
              {cycleEffortPercent(project.storyPoints)} of cycle
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 relative h-7 bg-muted/10 rounded overflow-hidden">
        {showSprintHeaders
          ? sprintsForCycle.map((sprint) => {
              const left = (differenceInDays(parseISO(sprint.startDate), viewStart) / totalDays) * 100;
              return (
                <div
                  key={sprint.id}
                  className="absolute top-0 bottom-0 border-l border-border/40"
                  style={{ left: `${Math.max(0, left)}%` }}
                />
              );
            })
          : cyclesInView.map((cycle) => {
              const left = (differenceInDays(parseISO(cycle.startDate), viewStart) / totalDays) * 100;
              return left > 0 ? (
                <div
                  key={cycle.id}
                  className="absolute top-0 bottom-0 border-l border-border/40"
                  style={{ left: `${left}%` }}
                />
              ) : null;
            })}
        {pos && effectiveStart && effectiveEnd && (
          <div
            className="absolute top-1 bottom-1 rounded-sm shadow-sm transition-opacity opacity-90 hover:opacity-100"
            style={{
              left: pos.left,
              width: pos.width,
              backgroundColor: color,
            }}
            title={`${project.title}\n${format(parseISO(effectiveStart), "MMM d")} to ${format(parseISO(effectiveEnd), "MMM d, yyyy")}${usingCycleFallback ? "\n(dates from cycle)" : ""}`}
          >
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-sm" />
          </div>
        )}
      </div>
    </>
  );
}
