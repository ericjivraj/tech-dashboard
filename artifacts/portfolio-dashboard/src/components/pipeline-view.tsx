import { useState, useMemo } from "react";
import { ProjectWithDetails, ProjectStatus } from "@workspace/api-client-react";
import { formatConfidence, storyPointsToTShirt } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { CONFIDENCE_COLORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";

const COLUMN_TOOLTIPS: Record<string, string> = {
  "Project Name": "The name and any blocked reason for the project",
  "Status": "Current workflow status of the project",
  "Team / Sponsor": "The team responsible for delivery, and the sponsor driving this project",
  "Stakeholder": "Business stakeholder for this project",
  "Goals": "Business goals this project contributes to",
  "Confidence": "Team's confidence in being on track with the predicted delivery timeframe",
  "Points": "Estimated story points for scope",
  "Timing": "Assigned cycle and date range",
  "Latest Update": "Most recent project update",
};

const SORTABLE_COLUMNS = new Set(["Status", "Confidence", "Team / Sponsor", "Points"]);

const CONFIDENCE_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  at_risk: 0,
};

type SortOrder = "asc" | "desc" | null;
type SortColumn = "Status" | "Confidence" | "Team / Sponsor" | "Points" | null;

interface SortState {
  column: SortColumn;
  order: SortOrder;
}

interface PipelineViewProps {
  projects: ProjectWithDetails[];
}

export default function PipelineView({ projects }: PipelineViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const [sort, setSort] = useState<SortState>({ column: null, order: null });

  function cycleSort(column: SortColumn) {
    setSort((prev) => {
      if (prev.column !== column) return { column, order: "asc" };
      if (prev.order === "asc") return { column, order: "desc" };
      return { column: null, order: null };
    });
  }

  const sortedProjects = useMemo(() => {
    if (sort.column === null || sort.order === null) return projects;

    return [...projects].sort((a, b) => {
      const dir = sort.order === "asc" ? 1 : -1;

      if (sort.column === "Points") {
        const aHas = a.storyPoints != null;
        const bHas = b.storyPoints != null;
        if (!aHas && !bHas) return 0;
        if (!aHas) return 1;
        if (!bHas) return -1;
        return dir * (a.storyPoints! - b.storyPoints!);
      }

      if (sort.column === "Status") {
        const aIdx = STATUS_ORDER.indexOf(a.status as ProjectStatus);
        const bIdx = STATUS_ORDER.indexOf(b.status as ProjectStatus);
        return dir * (aIdx - bIdx);
      }

      if (sort.column === "Confidence") {
        const aScore = a.confidence ? (CONFIDENCE_ORDER[a.confidence] ?? -1) : -1;
        const bScore = b.confidence ? (CONFIDENCE_ORDER[b.confidence] ?? -1) : -1;
        if (aScore === -1 && bScore === -1) return 0;
        if (aScore === -1) return 1;
        if (bScore === -1) return -1;
        return dir * (aScore - bScore);
      }

      if (sort.column === "Team / Sponsor") {
        const aTeam = (a.team ?? "").toLowerCase();
        const bTeam = (b.team ?? "").toLowerCase();
        if (!aTeam && !bTeam) return 0;
        if (!aTeam) return 1;
        if (!bTeam) return -1;
        return dir * aTeam.localeCompare(bTeam);
      }

      return 0;
    });
  }, [projects, sort]);

  function SortIcon({ column }: { column: SortColumn }) {
    const isActive = sort.column === column;
    if (isActive && sort.order === "asc") return <ArrowUp className="h-3.5 w-3.5 text-foreground" />;
    if (isActive && sort.order === "desc") return <ArrowDown className="h-3.5 w-3.5 text-foreground" />;
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />;
  }

  function renderHeader(col: string, tip: string) {
    const infoIcon = (
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0" aria-label={`About ${col}`}>
            <Info className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-auto max-w-[200px] px-3 py-1.5 text-xs">
          {tip}
        </PopoverContent>
      </Popover>
    );

    if (!SORTABLE_COLUMNS.has(col)) {
      return (
        <TableHead
          key={col}
          className={col === "Project Name" ? "w-[280px]" : col === "Latest Update" ? "w-[200px]" : col === "Stakeholder" ? "w-[120px]" : undefined}
        >
          <span className="flex items-center gap-1">
            {col}
            {infoIcon}
          </span>
        </TableHead>
      );
    }

    const sortCol = col as SortColumn;
    const isActive = sort.column === sortCol;
    const ariaSort = isActive
      ? sort.order === "asc" ? "ascending" : "descending"
      : "none";

    return (
      <TableHead key={col} aria-sort={ariaSort}>
        <span className="flex items-center gap-1">
          <button
            onClick={() => cycleSort(sortCol)}
            className="flex items-center gap-1 hover:text-foreground transition-colors text-inherit font-medium select-none"
            aria-label={`Sort by ${col}${isActive ? ` (${sort.order === "asc" ? "ascending" : "descending"})` : " (unsorted)"}`}
          >
            {col}
            <SortIcon column={sortCol} />
          </button>
          {infoIcon}
        </span>
      </TableHead>
    );
  }

  const totalColSpan = Object.keys(COLUMN_TOOLTIPS).length;

  return (
    <>
      <>
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                {Object.entries(COLUMN_TOOLTIPS).map(([col, tip]) => renderHeader(col, tip))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="group cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedProjectId(project.id)}
                  data-testid={`pipeline-row-${project.id}`}
                >
                  <TableCell>
                    <div className="font-medium text-sm">{project.title}</div>
                    {project.status === 'blocked' && project.blockedReason && (
                      <div className="text-xs text-destructive mt-1 flex items-center gap-1 font-medium bg-destructive/10 px-1.5 py-0.5 rounded w-fit">
                        Blocked: {project.blockedReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`font-medium text-xs ${
                        project.status === 'done'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : project.status === 'blocked'
                          ? 'bg-destructive text-destructive-foreground'
                          : ''
                      }`}
                    >
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{project.team || "—"}</span>
                      {project.sponsor && <span className="text-xs text-muted-foreground">Sponsor: {project.sponsor}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.stakeholder ? (
                      <span className="text-sm text-foreground">{project.stakeholder}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap max-w-[150px]">
                      {project.goals?.map(g => (
                        <div key={g.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} title={g.name} />
                      ))}
                      {(!project.goals || project.goals.length === 0) && <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.confidence ? (
                      <Badge variant="secondary" className={`text-xs font-medium border-0 ${CONFIDENCE_COLORS[project.confidence]}`}>
                        {formatConfidence(project.confidence)}
                      </Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    {project.storyPoints != null ? (() => {
                      const size = storyPointsToTShirt(project.storyPoints);
                      return (
                        <span className="flex items-center gap-1.5" title={size.tooltip}>
                          <Badge variant="outline" className="text-xs font-medium px-1.5 py-0">{size.label}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">{project.storyPoints}</span>
                        </span>
                      );
                    })() : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {project.cycle ? (
                        <span className="font-medium text-foreground">
                          {project.cycle.name}
                          {project.cycle.startDate && project.cycle.endDate && (
                            <span className="text-muted-foreground font-normal">
                              {" · "}
                              {format(parseISO(project.cycle.startDate), 'MMM d')} – {format(parseISO(project.cycle.endDate), 'MMM d')}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unscheduled</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.latestUpdate ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs line-clamp-2 text-muted-foreground italic">"{project.latestUpdate.content}"</span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {format(parseISO(project.latestUpdate.createdAt), 'MMM d')} by {project.latestUpdate.authorName || 'Unknown'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">No updates</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sortedProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={totalColSpan} className="text-center py-8 text-muted-foreground">
                    No projects match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
