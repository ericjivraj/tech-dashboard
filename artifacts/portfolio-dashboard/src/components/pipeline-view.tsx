import { useState, useMemo } from "react";
import { ProjectWithDetails, ProjectStatus } from "@workspace/api-client-react";
import { formatConfidence, storyPointsToTShirt } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { CONFIDENCE_COLORS, STATUS_LABELS } from "@/lib/constants";

const COLUMN_TOOLTIPS: Record<string, string> = {
  "Project Name": "The name and any blocked reason for the project",
  "Status": "Current workflow status of the project",
  "Team / Sponsor": "The team responsible and the business sponsor",
  "Goals": "Business goals this project contributes to",
  "Confidence": "Team's confidence in delivery",
  "Points": "Estimated story points for scope",
  "Timing": "Assigned cycle and date range",
  "Latest Update": "Most recent project update",
};

type SortOrder = "asc" | "desc" | null;

interface PipelineViewProps {
  projects: ProjectWithDetails[];
}

export default function PipelineView({ projects }: PipelineViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const [pointsSortOrder, setPointsSortOrder] = useState<SortOrder>(null);

  function cyclePointsSort() {
    setPointsSortOrder((prev) => {
      if (prev === null) return "asc";
      if (prev === "asc") return "desc";
      return null;
    });
  }

  const sortedProjects = useMemo(() => {
    if (pointsSortOrder === null) return projects;
    return [...projects].sort((a, b) => {
      const aHas = a.storyPoints != null;
      const bHas = b.storyPoints != null;
      if (!aHas && !bHas) return 0;
      if (!aHas) return 1;
      if (!bHas) return -1;
      return pointsSortOrder === "asc"
        ? a.storyPoints! - b.storyPoints!
        : b.storyPoints! - a.storyPoints!;
    });
  }, [projects, pointsSortOrder]);

  return (
    <>
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {Object.entries(COLUMN_TOOLTIPS).map(([col, tip]) => {
                if (col === "Points") {
                  return (
                    <TableHead
                      key={col}
                      title={tip}
                      aria-sort={pointsSortOrder === "asc" ? "ascending" : pointsSortOrder === "desc" ? "descending" : "none"}
                    >
                      <button
                        onClick={cyclePointsSort}
                        className="flex items-center gap-1 hover:text-foreground transition-colors text-inherit font-medium select-none"
                        aria-label={`Sort by Points ${pointsSortOrder === "asc" ? "(ascending)" : pointsSortOrder === "desc" ? "(descending)" : "(unsorted)"}`}
                      >
                        Points
                        {pointsSortOrder === "asc" && <ArrowUp className="h-3.5 w-3.5 text-foreground" />}
                        {pointsSortOrder === "desc" && <ArrowDown className="h-3.5 w-3.5 text-foreground" />}
                        {pointsSortOrder === null && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />}
                      </button>
                    </TableHead>
                  );
                }
                return (
                  <TableHead key={col} title={tip} className={col === "Project Name" ? "w-[300px]" : col === "Latest Update" ? "w-[200px]" : undefined}>
                    {col}
                  </TableHead>
                );
              })}
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
                  <Badge variant={project.status === 'done' ? 'default' : project.status === 'blocked' ? 'destructive' : 'secondary'} className="font-medium text-xs">
                    {STATUS_LABELS[project.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{project.team || "—"}</span>
                    <span className="text-xs text-muted-foreground">{project.sponsor || "—"}</span>
                  </div>
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
                  <div className="flex flex-col gap-0.5 text-xs">
                    <span className="font-medium text-foreground">{project.cycle?.name || "Unscheduled"}</span>
                    {project.startDate && project.endDate && (
                      <span className="text-muted-foreground">
                        {format(parseISO(project.startDate), 'MMM d')} - {format(parseISO(project.endDate), 'MMM d')}
                      </span>
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
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
  );
}
