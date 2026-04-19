import { useState } from "react";
import { ProjectWithDetails, ProjectStatus, useGetMe } from "@workspace/api-client-react";
import { formatConfidence } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { CONFIDENCE_COLORS, STATUS_LABELS } from "@/lib/constants";

const COLUMNS: { id: ProjectStatus; label: string }[] = [
  { id: "new_request", label: STATUS_LABELS.new_request },
  { id: "backlog", label: STATUS_LABELS.backlog },
  { id: "up_next", label: STATUS_LABELS.up_next },
  { id: "in_progress", label: STATUS_LABELS.in_progress },
  { id: "blocked", label: STATUS_LABELS.blocked },
  { id: "done", label: STATUS_LABELS.done },
];

interface KanbanViewProps {
  projects: ProjectWithDetails[];
}

export default function KanbanView({ projects }: KanbanViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);

  const projectsByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = projects.filter((p) => p.status === col.id);
    return acc;
  }, {} as Record<ProjectStatus, ProjectWithDetails[]>);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start pb-4">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3 min-h-[600px] border border-border/50">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
              <Badge variant="secondary" className="px-1.5 min-w-[1.5rem] flex justify-center text-xs">
                {projectsByStatus[col.id].length}
              </Badge>
            </div>
            <div className="flex flex-col gap-3">
              {projectsByStatus[col.id].map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => setSelectedProjectId(project.id)}
                />
              ))}
              {projectsByStatus[col.id].length === 0 && (
                <div className="text-center p-4 text-sm text-muted-foreground border border-dashed rounded-lg border-border/50">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedProjectId && (
        <ProjectModal
          projectId={selectedProjectId}
          open={!!selectedProjectId}
          onOpenChange={(open) => !open && setSelectedProjectId(null)}
          onEdit={(project) => {
            setSelectedProjectId(null);
            setProjectToEdit(project);
          }}
        />
      )}
      {projectToEdit && (
        <ProjectForm
          open={!!projectToEdit}
          onOpenChange={(open) => !open && setProjectToEdit(null)}
          projectToEdit={projectToEdit}
        />
      )}
    </>
  );
}

function ProjectCard({ project, onClick }: { project: ProjectWithDetails; onClick: () => void }) {
  const isBlocked = project.status === "blocked";

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${isBlocked ? 'border-l-destructive shadow-sm shadow-destructive/10' : 'border-l-primary/40'} hover:border-l-primary bg-card relative group`}
      onClick={onClick}
      data-testid={`card-project-${project.id}`}
    >
      <CardHeader className="p-3 pb-2 space-y-1">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-sm leading-tight line-clamp-2">{project.title}</CardTitle>
          {project.storyPoints && (
            <Badge variant="outline" className="text-[10px] px-1 font-mono shrink-0 bg-muted/50">
              {project.storyPoints} pts
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {project.confidence && (
            <Badge variant="secondary" className={`text-[10px] px-1.5 font-medium border-0 ${CONFIDENCE_COLORS[project.confidence]}`}>
              {formatConfidence(project.confidence)}
            </Badge>
          )}
          {project.team && (
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{project.team}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 pb-2">
        {project.latestUpdate ? (
          <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-1.5 rounded text-balance italic">
            "{project.latestUpdate.content}"
          </div>
        ) : (
          <div className="text-xs text-muted-foreground/50 italic">No updates yet</div>
        )}
      </CardContent>
      <CardFooter className="p-3 pt-0 flex justify-between items-center text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          {project.cycle ? <span className="font-medium">{project.cycle.name}</span> : <span>Unscheduled</span>}
        </div>
        {project.sponsor && (
          <div className="truncate max-w-[80px]" title={project.sponsor}>
            {project.sponsor}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
