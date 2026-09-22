import { useMemo, useRef, useState } from "react";
import {
  useGetProjectsTimeline,
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
import { format, parseISO, startOfYear, endOfYear, differenceInDays, eachMonthOfInterval, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { projectMatchesSprint, type FilterState } from "@/lib/filter-types";
import { matchesSearch } from "@/lib/search";
import { computeInsertOrder } from "@/lib/order";
import { isProjectBlocked } from "@/lib/blocked";
import { planMoveToSprint } from "@/lib/move-to-sprint";
import { useToast } from "@/hooks/use-toast";
import { STAGE_ORDER, STATUS_COLORS, STATUS_LABELS, type ProjectStage } from "@/lib/constants";


interface GanttViewProps {
  filters: FilterState;
}

type SprintAllocation = {
  sprintId: number;
  sprintName: string;
  sprintStartDate: string;
  sprintEndDate: string;
  percent: number;
};

function getSprintAllocations(p: unknown): SprintAllocation[] {
  return (p as { sprintAllocations?: SprintAllocation[] }).sprintAllocations ?? [];
}

// Effective Gantt-bar span. Priority: explicit start/end dates → sprint
// allocations (min sprint start → max sprint end). A project with only a
// primary sprint assigned (and no allocations or dates) is treated as not yet
// committed to a timeline and hidden from the Gantt — it still appears in the
// kanban view under its status column.
function getEffectiveDates(p: ProjectTimeline): { start: string; end: string } | null {
  if (p.startDate && p.endDate) return { start: p.startDate, end: p.endDate };
  const allocs = getSprintAllocations(p);
  if (allocs.length > 0) {
    return { start: allocs[0].sprintStartDate, end: allocs[allocs.length - 1].sprintEndDate };
  }
  return null;
}

export default function GanttView({ filters }: GanttViewProps) {
  const currentYear = new Date().getFullYear();
  // Sprint zoom is driven by the global filter so picking a sprint in the
  // filter-bar zooms the timeline AND restricts rows in one move.
  const selectedSprintId = filters.sprintId;
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const [headerMode, setHeaderMode] = useState<"sprints" | "months">("sprints");

  const { data: projects, isLoading } = useGetProjectsTimeline();
  const { data: sprints } = useListSprints();

  const { data: me } = useGetMe();
  const isEditor = me?.isEditor === true;

  const queryClient = useQueryClient();
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  const justDraggedRef = useRef(false);

  const sprintsSorted = useMemo(
    () => (sprints ? [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate)) : []),
    [sprints],
  );

  const handleMoveProjectToSprint = (project: ProjectTimeline, targetSprintId: number) => {
    const targetSprint = sprintsSorted.find((s) => s.id === targetSprintId);
    if (!targetSprint) return;
    const plan = planMoveToSprint(
      {
        storyPoints: project.storyPoints,
        startDate: project.startDate ?? null,
        endDate: project.endDate ?? null,
        sprintAllocations: getSprintAllocations(project),
      },
      targetSprint,
      sprintsSorted,
    );
    updateProject.mutate(
      {
        id: project.id,
        data: {
          sprintAllocations: plan.sprintAllocations,
          startDate: plan.startDate,
          endDate: plan.endDate,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: timelineQueryKey });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          const bits: string[] = [`Moved to ${targetSprint.name}`];
          if (plan.summary.droppedAllocations > 0) {
            bits.push(`${plan.summary.droppedAllocations} allocation${plan.summary.droppedAllocations === 1 ? "" : "s"} fell off the sprint range`);
          }
          if (plan.summary.createdAllocation) bits.push("created sprint allocation from story points");
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
  const timelineQueryKey = getGetProjectsTimelineQueryKey();

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

  if (selectedSprintId !== "all" && sprints) {
    const sprint = sprints.find((s) => s.id.toString() === selectedSprintId);
    if (sprint) {
      viewStart = parseISO(sprint.startDate);
      viewEnd = parseISO(sprint.endDate);
    }
  }

  // When viewing all sprints, skip completed ones by clamping viewStart to
  // the first sprint that hasn't ended yet.
  if (selectedSprintId === "all" && sprints) {
    const today = new Date();
    const firstActiveSprint = [...sprints]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .find((s) => parseISO(s.endDate) >= today);
    if (firstActiveSprint) {
      viewStart = parseISO(firstActiveSprint.startDate);
    }
  }

  // When viewing all sprints (not zoomed to one), don't let the default
  // calendar-year window cut off a project scheduled further out — stretch
  // viewEnd to cover the latest stage-schedule or fallback end date across
  // every project. Built from the unfiltered list, same rule as the sprint
  // header totals below, so search/status/team/goal filters never change it.
  if (selectedSprintId === "all") {
    const maxScheduledEndMs = projects.reduce((max, p) => {
      const ends: number[] = [];
      for (const s of p.stageSchedules ?? []) {
        const t = parseISO(s.endDate).getTime();
        if (!Number.isNaN(t)) ends.push(t);
      }
      const effective = getEffectiveDates(p);
      if (effective) {
        const t = parseISO(effective.end).getTime();
        if (!Number.isNaN(t)) ends.push(t);
      }
      return ends.length ? Math.max(max, ...ends) : max;
    }, viewEnd.getTime());
    if (maxScheduledEndMs > viewEnd.getTime()) {
      viewEnd = new Date(maxScheduledEndMs);
    }
  }

  const totalDays = Math.max(1, differenceInDays(viewEnd, viewStart));
  const today = new Date();

  const sprintsInView = sprints
    ? sprints
        .filter((s) => parseISO(s.startDate) < viewEnd && parseISO(s.endDate) > viewStart)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  // Calendar months intersecting the view window — the alternative header
  // mode to sprints. Bar positioning (getBarPosition) is date-based and
  // doesn't care which header mode is active; only the header row and
  // gridlines change.
  const monthsInView = eachMonthOfInterval({ start: viewStart, end: viewEnd }).map((m) => ({
    key: format(m, "yyyy-MM"),
    monthStart: startOfMonth(m),
    monthEnd: endOfMonth(m),
    label: format(m, "MMMM yyyy"),
  }));

  const gridlineColumns = headerMode === "months"
    ? monthsInView.map((m) => ({ key: m.key, start: m.monthStart }))
    : sprintsInView.map((s) => ({ key: `sprint-${s.id}`, start: parseISO(s.startDate) }));

  const getBarPosition = (start: string, end: string) => {
    const startMs = parseISO(start).getTime();
    const endMs = parseISO(end).getTime();
    // Treat sprint/view ranges as half-open [start, end) so boundary days don't
    // attribute a bar to two sprints. E.g. Sprint 32 ends 2026-11-04 and
    // Sprint 33 starts 2026-11-05 — a project starting 2026-11-05 belongs to
    // 33 only, and shouldn't render at the right edge of 32's view.
    if (startMs >= viewEnd.getTime() || endMs <= viewStart.getTime()) return null;

    const sDate = Math.max(startMs, viewStart.getTime());
    const eDate = Math.min(endMs, viewEnd.getTime());
    const left = (differenceInDays(new Date(sDate), viewStart) / totalDays) * 100;
    const width = (differenceInDays(new Date(eDate), new Date(sDate)) / totalDays) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.max(0.5, width)}%` };
  };

  // Start with every project. Status / sprint / search filters below decide
  // what shows up. Unscheduled projects (no dates, no allocations, no primary
  // sprint) appear as rows with no bar — that's how new_request items become
  // discoverable in the timeline. Bar rendering and sprint-header %
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
  if (filters.goalId !== "all") {
    filteredProjects = filteredProjects.filter((p) => p.goals.some((g) => g.id.toString() === filters.goalId));
  }
  // The sprint filter zooms the timeline (drives viewStart/viewEnd above) AND
  // restricts rows so the focused-sprint view is honest. Same rule as
  // dashboard.tsx / business.tsx: a project shows when it has an allocation
  // for the focused sprint, when its start date falls in the sprint's
  // half-open range, or when it has no schedule at all (floating row).
  if (filters.sprintId !== "all" && sprints) {
    const focusedSprint = sprints.find((s) => s.id.toString() === filters.sprintId);
    if (focusedSprint) {
      filteredProjects = filteredProjects.filter((p) => projectMatchesSprint(p, focusedSprint) !== "miss");
    }
  }

  // Show every filtered project as a row. If the bar falls outside the
  // current view (e.g. zoomed to Sprint 32, project has dates in Sprint 33),
  // the row appears with no visible bar — Row's getBarPosition returns null
  // and the bar element is conditionally hidden.
  const visibleProjects = filteredProjects;

  // Sprint header totals are independent of the active row filters — the %
  // for "Sprint 32" represents the real allocation against that sprint, not
  // "the allocation among the projects you happen to be looking at right
  // now". Built from the unfiltered project list so toggling status / team /
  // goal / sprint / search filters never changes the header sum.
  const projectsBySprintId = new Map<number, typeof projects>();
  for (const p of projects) {
    const allocs = getSprintAllocations(p);
    if (allocs.length === 0) continue;
    for (const a of allocs) {
      if (!projectsBySprintId.has(a.sprintId)) projectsBySprintId.set(a.sprintId, []);
      projectsBySprintId.get(a.sprintId)!.push(p);
    }
  }

  return (
    <>
      <>
      <div className="space-y-4">
        {/* Quarter + Status + Clear filters used to live here, but they
            duplicated the global filter-bar above. The filter-bar now drives
            sprint zoom and status multi-select for the timeline directly. */}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            {STAGE_ORDER.map((stage) => (
              <div key={stage} className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
                <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: STATUS_COLORS[stage] }} />
                <div className="text-sm font-semibold text-foreground">{STATUS_LABELS[stage]}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground mr-1">Columns:</span>
            <Button
              type="button"
              size="sm"
              variant={headerMode === "sprints" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setHeaderMode("sprints")}
            >
              Sprints
            </Button>
            <Button
              type="button"
              size="sm"
              variant={headerMode === "months" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setHeaderMode("months")}
            >
              Months
            </Button>
          </div>
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
                    Project name with squad and goals
                  </PopoverContent>
                </Popover>
              </div>
              {/* Sprint row: when zoomed, just the focused sprint (full view width).
                  Otherwise, every sprint that intersects the view. Always
                  clickable to show the per-project allocation popover. */}
              <div className="flex">
                {headerMode === "months" ? monthsInView.map((month) => {
                  const mStart = Math.max(month.monthStart.getTime(), viewStart.getTime());
                  const mEnd = Math.min(month.monthEnd.getTime(), viewEnd.getTime());
                  const widthPct = (differenceInDays(new Date(mEnd), new Date(mStart)) / totalDays) * 100;
                  const isCurrentMonth = isSameMonth(month.monthStart, today);
                  return (
                    <div
                      key={month.key}
                      className={`text-sm font-medium text-foreground text-center border-l first:border-l-0 border-border/50 px-2 overflow-hidden rounded-sm ${isCurrentMonth ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                      style={{ width: `${widthPct}%` }}
                    >
                      <div className={`font-bold truncate text-sm ${isCurrentMonth ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
                        {month.label}{isCurrentMonth && <span className="ml-1 text-[10px] font-medium bg-blue-600 text-white rounded-full px-1.5 py-0.5 leading-none align-middle">Now</span>}
                      </div>
                    </div>
                  );
                }) : sprintsInView.map((sprint) => {
                  const sStart = Math.max(parseISO(sprint.startDate).getTime(), viewStart.getTime());
                  const sEnd = Math.min(parseISO(sprint.endDate).getTime(), viewEnd.getTime());
                  const widthPct = (differenceInDays(new Date(sEnd), new Date(sStart)) / totalDays) * 100;
                  const isActive = parseISO(sprint.startDate) <= today && parseISO(sprint.endDate) >= today;
                  const sprintProjects = projectsBySprintId.get(sprint.id) ?? [];

                  // Sum each project's allocation percent specifically for this sprint.
                  const literalSum = sprintProjects
                    .map((p) => getSprintAllocations(p).find((a) => a.sprintId === sprint.id)?.percent ?? null)
                    .filter((v): v is number => v != null)
                    .reduce((s, v) => s + v, 0);
                  const overallCap = literalSum > 0
                    ? { pct: literalSum, label: `${literalSum.toFixed(1)}%` }
                    : null;
                  return (
                    <Popover key={sprint.id}>
                      <PopoverTrigger asChild>
                        <div
                          className={`text-sm font-medium text-foreground text-center border-l first:border-l-0 border-border/50 px-2 overflow-hidden rounded-sm cursor-pointer ${isActive ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                          style={{ width: `${widthPct}%` }}
                        >
                          <div className={`font-bold truncate text-sm ${isActive ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
                            {sprint.name}{isActive && <span className="ml-1 text-[10px] font-medium bg-blue-600 text-white rounded-full px-1.5 py-0.5 leading-none align-middle">Now</span>}
                          </div>
                          <div className="text-xs font-normal truncate mt-0.5">
                            {format(parseISO(sprint.startDate), 'MMM d')} – {format(parseISO(sprint.endDate), 'MMM d')}
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
                      {sprintProjects.length > 0 && (
                        <PopoverContent side="bottom" className="w-[28rem] max-w-[90vw] p-4 space-y-2 text-sm">
                          <p className="font-bold text-foreground text-base mb-3">{sprint.name}: Project Allocation</p>
                          {[...sprintProjects]
                            .map((p) => ({ p, percent: getSprintAllocations(p).find((a) => a.sprintId === sprint.id)?.percent ?? 0 }))
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
                          gridlineColumns={gridlineColumns}
                          getBarPosition={getBarPosition}
                          availableSprints={sprintsSorted}
                          onMoveToSprint={(sprintId) => handleMoveProjectToSprint(project, sprintId)}
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
                      gridlineColumns={gridlineColumns}
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
// visible while open. Lists every sprint; clicking one shifts the project's
// allocations + dates to that sprint (handled by the parent's
// onMoveToSprint, which calls planMoveToSprint then PATCHes). The current
// "anchor" sprint (earliest allocated) is marked and disabled to prevent
// accidental no-op moves.
function RowKebab({
  project,
  sprints,
  onMoveToSprint,
}: {
  project: ProjectTimeline;
  sprints: { id: number; name: string }[];
  onMoveToSprint: (sprintId: number) => void;
}) {
  const allocs = getSprintAllocations(project);
  const allocSprintIds = new Set(allocs.map((a) => a.sprintId));
  // Anchor = the currently-earliest allocation, or the project's primary sprint if no allocations.
  const anchorSprintId = allocs.length > 0
    ? [...allocs].sort((a, b) => a.sprintStartDate.localeCompare(b.sprintStartDate))[0].sprintId
    : project.sprintId ?? null;

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
        <DropdownMenuLabel className="text-xs text-muted-foreground">Move to sprint</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sprints.map((s) => {
          const isAnchor = s.id === anchorSprintId;
          const hasAlloc = allocSprintIds.has(s.id);
          return (
            <DropdownMenuItem
              key={s.id}
              disabled={isAnchor}
              onSelect={() => onMoveToSprint(s.id)}
              data-testid={`gantt-move-${project.id}-${s.id}`}
              className="flex items-center justify-between gap-2"
            >
              <span>{s.name}</span>
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
  gridlineColumns: { key: string; start: Date }[];
  getBarPosition: (start: string, end: string) => { left: string; width: string } | null;
  dragHandle: React.ReactNode;
  // Editor-only: when set, renders a hover-revealed "..." menu in the row
  // with sprints to move the project to. Selecting a sprint reallocates the
  // project (and shifts dates) via planMoveToSprint.
  availableSprints?: { id: number; name: string }[];
  onMoveToSprint?: (sprintId: number) => void;
}

function GanttRowContent({
  project,
  today,
  viewStart,
  totalDays,
  gridlineColumns,
  getBarPosition,
  dragHandle,
  availableSprints,
  onMoveToSprint,
}: GanttRowContentProps) {
  const dates = getEffectiveDates(project);
  const effectiveStart = dates?.start;
  const effectiveEnd = dates?.end;
  const usingSprintFallback = !project.startDate && !project.endDate;
  const pos = dates ? getBarPosition(dates.start, dates.end) : null;
  const color = STATUS_COLORS[project.status];
  const stageSchedules = project.stageSchedules ?? [];

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
          {availableSprints && onMoveToSprint && (
            <RowKebab
              project={project}
              sprints={availableSprints}
              onMoveToSprint={onMoveToSprint}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-foreground truncate">{project.team || "No squad"}</span>
        </div>
      </div>

      <div className="flex-1 relative h-7 bg-muted/10 rounded overflow-hidden">
        {gridlineColumns.map((col) => {
          const left = (differenceInDays(col.start, viewStart) / totalDays) * 100;
          return left > 0 ? (
            <div
              key={col.key}
              className="absolute top-0 bottom-0 border-l border-border/40"
              style={{ left: `${left}%` }}
            />
          ) : null;
        })}
        {stageSchedules.length > 0
          ? stageSchedules.map((s) => {
              const stagePos = getBarPosition(s.startDate, s.endDate);
              if (!stagePos) return null;
              const stage = s.stage as ProjectStage;
              return (
                <div
                  key={stage}
                  className="absolute top-1 bottom-1 rounded-sm shadow-sm transition-opacity opacity-90 hover:opacity-100"
                  style={{
                    left: stagePos.left,
                    width: stagePos.width,
                    backgroundColor: STATUS_COLORS[stage],
                  }}
                  title={`${project.title} — ${STATUS_LABELS[stage]}\n${format(parseISO(s.startDate), "MMM d")} to ${format(parseISO(s.endDate), "MMM d, yyyy")}`}
                >
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-sm" />
                </div>
              );
            })
          : pos && effectiveStart && effectiveEnd && (
              <div
                className="absolute top-1 bottom-1 rounded-sm shadow-sm transition-opacity opacity-90 hover:opacity-100"
                style={{
                  left: pos.left,
                  width: pos.width,
                  backgroundColor: color,
                }}
                title={`${project.title}\n${format(parseISO(effectiveStart), "MMM d")} to ${format(parseISO(effectiveEnd), "MMM d, yyyy")}${usingSprintFallback ? "\n(dates from sprint)" : ""}`}
              >
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-sm" />
              </div>
            )}
      </div>
    </>
  );
}
