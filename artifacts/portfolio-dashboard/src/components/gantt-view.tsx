import { useState } from "react";
import { useGetProjectsTimeline, useListCycles, ProjectWithDetails } from "@workspace/api-client-react";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval, differenceInDays, startOfQuarter, endOfQuarter } from "date-fns";
import type { FilterState } from "@/lib/filter-types";
import { storyPointsToTShirt } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  done: "#10b981",
  in_progress: "#3b82f6",
  up_next: "#818cf8",
  backlog: "#94a3b8",
  blocked: "#ef4444",
  new_request: "#a78bfa",
};

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

export default function GanttView({ filters }: GanttViewProps) {
  const currentYear = new Date().getFullYear();
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);

  const { data: projects, isLoading } = useGetProjectsTimeline({ year: currentYear });
  const { data: cycles } = useListCycles();

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

  const totalDays = Math.max(1, differenceInDays(viewEnd, viewStart));
  const months = eachMonthOfInterval({ start: viewStart, end: viewEnd });

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

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">Cycle</span>
            <Select value={selectedCycleId} onValueChange={(v) => { setSelectedCycleId(v); setSelectedQuarter("all"); }} data-testid="gantt-cycle-filter">
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder="All cycles" />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Cycles</SelectItem>
                {cycles?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(selectedQuarter !== "all" || selectedCycleId !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedQuarter("all"); setSelectedCycleId("all"); }}
              data-testid="gantt-clear-filters"
            >
              Clear view filters
            </Button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""} shown
          </span>
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
              {months.map((month, i) => (
                <div key={i} className="flex-1 text-xs font-medium text-muted-foreground text-center border-l first:border-l-0 border-border/50">
                  {format(month, months.length <= 4 ? 'MMM d' : 'MMM')}
                </div>
              ))}
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
                  const color = STATUS_COLORS[project.status] || "#94a3b8";

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
                          <span className="text-[10px] text-muted-foreground truncate">{project.team || "No team"}</span>
                          {project.storyPoints != null ? (() => {
                            const size = storyPointsToTShirt(project.storyPoints);
                            return (
                              <Badge variant="outline" className="text-[9px] font-medium px-1 py-0 h-3.5 leading-none shrink-0" title={size.tooltip}>
                                {size.label}
                              </Badge>
                            );
                          })() : null}
                        </div>
                        {project.sponsor && (
                          <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                            Sponsor: {project.sponsor}
                          </div>
                        )}
                        {project.stakeholder && (
                          <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                            Stakeholder: {project.stakeholder}
                          </div>
                        )}
                        {project.goals && project.goals.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {project.goals.map((g) => (
                              <span key={g.id} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} title={g.name} />
                            ))}
                          </div>
                        )}
                        {project.cycleName && project.cycleStartDate && project.cycleEndDate && (
                          <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                            {project.cycleName} · {format(parseISO(project.cycleStartDate), 'MMM d')} – {format(parseISO(project.cycleEndDate), 'MMM d')}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 relative h-7 bg-muted/10 rounded overflow-hidden">
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
