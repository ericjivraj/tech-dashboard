import { useMemo, useRef, useState } from "react";
import {
  ProjectWithDetails,
  ProjectStatus,
  useGetMe,
  useUpdateProject,
  getListProjectsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, Plus } from "lucide-react";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { STATUS_LABELS } from "@/lib/constants";
import { computeInsertOrder } from "@/lib/order";
import { isProjectBlocked } from "@/lib/blocked";

const COLUMN_DESCRIPTIONS: Record<ProjectStatus, string> = {
  new_request: "Newly submitted project requests awaiting triage by the respective function",
  backlog: "Projects that have been deemed important by the function and/or senior leadership",
  up_next: "Projects that have been confirmed as a priority by the function and/or senior leadership for the next available development cycle",
  in_progress: "Projects prioritized by senior leadership and actively in development",
  done: "Completed and delivered projects",
};

const COLUMNS: { id: ProjectStatus; label: string }[] = [
  { id: "new_request", label: STATUS_LABELS.new_request },
  { id: "backlog", label: STATUS_LABELS.backlog },
  { id: "up_next", label: STATUS_LABELS.up_next },
  { id: "in_progress", label: STATUS_LABELS.in_progress },
  { id: "done", label: STATUS_LABELS.done },
];

interface KanbanViewProps {
  projects: ProjectWithDetails[];
  readOnly?: boolean;
  // When set and non-empty, only these status columns are rendered. Empty
  // array (or undefined) means show all five.
  visibleStatuses?: ProjectStatus[];
}

export default function KanbanView({ projects, readOnly = false, visibleStatuses }: KanbanViewProps) {
  const visibleColumns =
    visibleStatuses && visibleStatuses.length > 0
      ? COLUMNS.filter((c) => visibleStatuses.includes(c.id))
      : COLUMNS;
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [addProjectStatus, setAddProjectStatus] = useState<ProjectStatus | null>(null);
  const justDraggedRef = useRef(false);

  const { data: me } = useGetMe();
  const isEditor = me?.isEditor === true;
  const dragEnabled = !readOnly && isEditor;

  const queryClient = useQueryClient();
  const updateProject = useUpdateProject();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const projectsByStatus = useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      acc[col.id] = projects
        .filter((p) => p.status === col.id)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
      return acc;
    }, {} as Record<ProjectStatus, ProjectWithDetails[]>);
  }, [projects]);

  const projectById = useMemo(() => {
    const m = new Map<number, ProjectWithDetails>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const activeProject = activeProjectId != null ? projectById.get(activeProjectId) ?? null : null;

  function findContainer(id: string | number): ProjectStatus | null {
    if (typeof id === "string" && (COLUMNS as { id: string }[]).some((c) => c.id === id)) {
      return id as ProjectStatus;
    }
    const numeric = typeof id === "number" ? id : Number(id);
    const project = projectById.get(numeric);
    return project ? (project.status as ProjectStatus) : null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveProjectId(Number(event.active.id));
    justDraggedRef.current = false;
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveProjectId(null);
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 100);
    const { active, over } = event;
    if (!over) return;

    const movedId = Number(active.id);
    const moved = projectById.get(movedId);
    if (!moved) return;

    const targetColumn = findContainer(over.id);
    if (!targetColumn) return;

    const targetItems = projectsByStatus[targetColumn];

    let insertIndex: number;
    if (typeof over.id === "string") {
      insertIndex = targetItems.filter((p) => p.id !== movedId).length;
    } else {
      const overIdx = targetItems.findIndex((p) => p.id === Number(over.id));
      const movedIdxInTarget = targetItems.findIndex((p) => p.id === movedId);
      const filteredOverIdx =
        movedIdxInTarget !== -1 && movedIdxInTarget < overIdx ? overIdx - 1 : overIdx;
      insertIndex = filteredOverIdx === -1 ? targetItems.length : filteredOverIdx;
    }

    const newDisplayOrder = computeInsertOrder(targetItems, insertIndex, movedId, (p) => p.displayOrder);
    const statusChanged = moved.status !== targetColumn;

    if (
      !statusChanged &&
      newDisplayOrder === moved.displayOrder
    ) {
      return;
    }

    const data: { displayOrder: number; status?: ProjectStatus } = { displayOrder: newDisplayOrder };
    if (statusChanged) data.status = targetColumn;

    const queryKey = getListProjectsQueryKey();
    const previous = queryClient.getQueryData<ProjectWithDetails[]>(queryKey);
    if (previous) {
      queryClient.setQueryData<ProjectWithDetails[]>(
        queryKey,
        previous.map((p) =>
          p.id === movedId
            ? { ...p, displayOrder: newDisplayOrder, ...(statusChanged ? { status: targetColumn } : {}) }
            : p,
        ),
      );
    }

    updateProject.mutate(
      { id: movedId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey });
          if (statusChanged) {
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          }
        },
        onError: () => {
          if (previous) queryClient.setQueryData(queryKey, previous);
          queryClient.invalidateQueries({ queryKey });
        },
      },
    );
  }

  function handleDragOver(_event: DragOverEvent) {
    // Cross-column visual feedback handled by DragOverlay; no live re-shuffle needed.
  }

  // Grid sized to the number of visible columns so kanban looks balanced when
  // filtered down to e.g. 2 statuses. Tailwind's JIT can't see dynamic class
  // strings, so the mapping has to use literal class names.
  const lgGridClass = (
    {
      1: "lg:grid-cols-1",
      2: "lg:grid-cols-2",
      3: "lg:grid-cols-3",
      4: "lg:grid-cols-4",
      5: "lg:grid-cols-5",
    } as const
  )[Math.min(5, Math.max(1, visibleColumns.length)) as 1 | 2 | 3 | 4 | 5];
  const board = (
    <div className={`grid grid-cols-1 md:grid-cols-3 ${lgGridClass} gap-4 items-start pb-4`}>
      {visibleColumns.map((col) => (
        <KanbanColumn
          key={col.id}
          column={col}
          projects={projectsByStatus[col.id]}
          dragEnabled={dragEnabled}
          showAddButton={dragEnabled}
          onAddProject={() => setAddProjectStatus(col.id)}
          hideStatusIndicators={readOnly}
          onCardClick={(id) => {
            if (justDraggedRef.current) return;
            setSelectedProjectId(id);
          }}
        />
      ))}
    </div>
  );

  return (
    <>
      {dragEnabled ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {board}
          <DragOverlay>
            {activeProject ? <ProjectCard project={activeProject} dragEnabled={false} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        board
      )}

      {selectedProjectId && (
        <ProjectModal
          projectId={selectedProjectId}
          open={!!selectedProjectId}
          onOpenChange={(open) => !open && setSelectedProjectId(null)}
          onEdit={(project) => {
            if (readOnly) return;
            setSelectedProjectId(null);
            setProjectToEdit(project);
          }}
          readOnly={readOnly}
        />
      )}
      {!readOnly && projectToEdit && (
        <ProjectForm
          open={!!projectToEdit}
          onOpenChange={(open) => !open && setProjectToEdit(null)}
          projectToEdit={projectToEdit}
        />
      )}
      {!readOnly && (
        <ProjectForm
          open={addProjectStatus !== null}
          onOpenChange={(open) => !open && setAddProjectStatus(null)}
          initialStatus={addProjectStatus ?? undefined}
        />
      )}
    </>
  );
}

function KanbanColumn({
  column,
  projects,
  dragEnabled,
  showAddButton,
  onAddProject,
  hideStatusIndicators,
  onCardClick,
}: {
  column: { id: ProjectStatus; label: string };
  projects: ProjectWithDetails[];
  dragEnabled: boolean;
  showAddButton?: boolean;
  onAddProject?: () => void;
  // Business view hides "blocked" badges + the latest-update snippet so the
  // exec-facing kanban only shows the project shape, not in-flight chatter.
  hideStatusIndicators?: boolean;
  onCardClick: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !dragEnabled });
  const itemIds = projects.map((p) => p.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-xl bg-muted/30 p-3 min-h-[600px] border ${
        isOver ? "border-primary/50 bg-muted/50" : "border-border/50"
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <h3 className="font-semibold text-sm text-foreground">{column.label}</h3>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                aria-label={`About ${column.label}`}
              >
                <Info className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-auto max-w-[180px] text-center px-3 py-1.5 text-xs">
              {COLUMN_DESCRIPTIONS[column.id]}
            </PopoverContent>
          </Popover>
        </div>
        <Badge variant="secondary" className="px-1.5 min-w-[1.5rem] flex justify-center text-xs">
          {projects.length}
        </Badge>
      </div>
      {showAddButton && onAddProject && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddProject}
          className="h-7 justify-start gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
          data-testid={`add-project-${column.id}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Add project
        </Button>
      )}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {projects.map((project) =>
            dragEnabled ? (
              <SortableProjectCard
                key={project.id}
                project={project}
                onClick={() => onCardClick(project.id)}
                hideStatusIndicators={hideStatusIndicators}
              />
            ) : (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onCardClick(project.id)}
                dragEnabled={false}
                hideStatusIndicators={hideStatusIndicators}
              />
            ),
          )}
          {projects.length === 0 && (
            <div className="text-center p-4 text-sm text-muted-foreground border border-dashed rounded-lg border-border/50">
              Empty
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableProjectCard({
  project,
  onClick,
  hideStatusIndicators,
}: {
  project: ProjectWithDetails;
  onClick: () => void;
  hideStatusIndicators?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProjectCard project={project} onClick={onClick} dragEnabled hideStatusIndicators={hideStatusIndicators} />
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  dragEnabled,
  hideStatusIndicators,
}: {
  project: ProjectWithDetails;
  onClick?: () => void;
  dragEnabled: boolean;
  hideStatusIndicators?: boolean;
}) {
  const isBlocked = isProjectBlocked(project) && !hideStatusIndicators;

  return (
    <Card
      className={`transition-all hover:shadow-md border-l-4 ${isBlocked ? "border-l-destructive shadow-sm shadow-destructive/10" : "border-l-primary/40"} hover:border-l-primary bg-card relative group ${
        dragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
      onClick={(e) => {
        if (dragEnabled) e.stopPropagation();
        onClick?.();
      }}
      data-testid={`card-project-${project.id}`}
    >
      <CardHeader className="p-3 pb-2 space-y-1">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-sm leading-tight line-clamp-2">{project.title}</CardTitle>
          {isBlocked && (
            <Badge variant="destructive" className="shrink-0 text-[9px] px-1.5 py-0 leading-none uppercase tracking-wider">
              Blocked
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {project.team && (
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{project.team}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className={`p-3 pt-0 ${hideStatusIndicators ? "pb-0" : "pb-2"}`}>
        {hideStatusIndicators ? null : project.latestUpdate ? (
          <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-1.5 rounded text-balance italic">
            "{project.latestUpdate.content}"
          </div>
        ) : (
          <div className="text-xs text-muted-foreground/50 italic">No updates yet</div>
        )}
      </CardContent>
      <CardFooter className="p-3 pt-0 flex flex-col gap-1.5 items-start text-[10px] text-muted-foreground">
        {project.functionName && (
          <div className="flex items-center gap-1 w-full" title={project.functionName}>
            <span className="text-muted-foreground/60 shrink-0">Sponsor:</span>
            <span className="truncate font-medium">{project.functionName}</span>
          </div>
        )}
        {project.sponsor && (
          <div className="flex items-center gap-1 w-full" title={project.sponsor}>
            <span className="text-muted-foreground/60 shrink-0">Stakeholder:</span>
            <span className="truncate font-medium">{project.sponsor}</span>
          </div>
        )}
        {project.goals && project.goals.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap w-full pt-1 mt-0.5 border-t border-border/40">
            {project.goals.map((g) => (
              <span key={g.id} className="flex items-center gap-1 min-w-0 max-w-full">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                <span className="truncate max-w-[80px]" title={g.name}>{g.name}</span>
              </span>
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
