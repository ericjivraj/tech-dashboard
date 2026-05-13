import { useMemo, useRef, useState } from "react";
import {
  ProjectWithDetails,
  ProjectStatus,
  useGetMe,
  useUpdateProject,
  getListProjectsQueryKey,
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
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { computeInsertOrder } from "@/lib/order";
import { isProjectBlocked } from "@/lib/blocked";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, GripVertical } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import ProjectModal from "./project-modal";
import ProjectForm from "./project-form";
import { STATUS_LABELS, PIPELINE_STATUS_ORDER, AVG_CYCLE_CAPACITY, cycleEffortPercent } from "@/lib/constants";

const COLUMN_TOOLTIPS: Record<string, string> = {
  "Project Name": "The name and any blocked reason for the project",
  "Status": "Current workflow status of the project",
  "Team / Sponsor": "The team responsible for delivery, and the function driving this project",
  "Stakeholder": "Business sponsor for this project",
  "Goals": "Business goals this project contributes to",
  "Latest Update": "Most recent project update",
};

const SORTABLE_COLUMNS = new Set(["Status", "Team / Sponsor"]);

type SortOrder = "asc" | "desc" | null;
type SortColumn = "Status" | "Team / Sponsor" | null;

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
  const [sort, setSort] = useState<SortState>({ column: "Status", order: "asc" });

  const { data: me } = useGetMe();
  const isEditor = me?.isEditor === true;

  const queryClient = useQueryClient();
  const updateProject = useUpdateProject();
  const justDraggedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function cycleSort(column: SortColumn) {
    setSort((prev) => {
      if (prev.column !== column) return { column, order: "asc" };
      if (prev.order === "asc") return { column, order: "desc" };
      return { column: null, order: null };
    });
  }

  const sortedProjects = useMemo(() => {
    if (sort.column === null || sort.order === null) {
      return [...projects].sort((a, b) => a.listOrder - b.listOrder || a.id - b.id);
    }

    return [...projects].sort((a, b) => {
      const dir = sort.order === "asc" ? 1 : -1;

      if (sort.column === "Status") {
        const aIdx = PIPELINE_STATUS_ORDER.indexOf(a.status as ProjectStatus);
        const bIdx = PIPELINE_STATUS_ORDER.indexOf(b.status as ProjectStatus);
        return dir * (aIdx - bIdx);
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

  function handleDragStart(_event: DragStartEvent) {
    justDraggedRef.current = false;
    if (sort.column !== null) {
      setSort({ column: null, order: null });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 100);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const movedId = Number(active.id);
    const overId = Number(over.id);

    const manualOrder = [...projects].sort((a, b) => a.listOrder - b.listOrder || a.id - b.id);
    const moved = manualOrder.find((p) => p.id === movedId);
    if (!moved) return;

    const overIdx = manualOrder.findIndex((p) => p.id === overId);
    if (overIdx === -1) return;
    const movedIdx = manualOrder.findIndex((p) => p.id === movedId);
    const adjusted = movedIdx !== -1 && movedIdx < overIdx ? overIdx - 1 : overIdx;

    const newListOrder = computeInsertOrder(manualOrder, adjusted, movedId, (p) => p.listOrder);
    if (newListOrder === moved.listOrder) return;

    const queryKey = getListProjectsQueryKey();
    const previous = queryClient.getQueryData<ProjectWithDetails[]>(queryKey);
    if (previous) {
      queryClient.setQueryData<ProjectWithDetails[]>(
        queryKey,
        previous.map((p) => (p.id === movedId ? { ...p, listOrder: newListOrder } : p)),
      );
    }

    updateProject.mutate(
      { id: movedId, data: { listOrder: newListOrder } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
        onError: () => {
          if (previous) queryClient.setQueryData(queryKey, previous);
          queryClient.invalidateQueries({ queryKey });
        },
      },
    );
  }

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

  const totalColSpan = Object.keys(COLUMN_TOOLTIPS).length + (isEditor ? 1 : 0);

  const tableBody = (
    <TableBody>
      {sortedProjects.map((project) =>
        isEditor ? (
          <SortableProjectRow
            key={project.id}
            project={project}
            onClick={() => {
              if (justDraggedRef.current) return;
              setSelectedProjectId(project.id);
            }}
          />
        ) : (
          <ProjectRow
            key={project.id}
            project={project}
            onClick={() => setSelectedProjectId(project.id)}
          />
        ),
      )}
      {sortedProjects.length === 0 && (
        <TableRow>
          <TableCell colSpan={totalColSpan} className="text-center py-8 text-muted-foreground">
            No projects match the current filters.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );

  const tableInner = (
    <div className="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {isEditor && <TableHead className="w-8 p-0" aria-label="Drag handle" />}
            {Object.entries(COLUMN_TOOLTIPS).map(([col, tip]) => renderHeader(col, tip))}
          </TableRow>
        </TableHeader>
        {isEditor ? (
          <SortableContext
            items={sortedProjects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {tableBody}
          </SortableContext>
        ) : (
          tableBody
        )}
      </Table>
    </div>
  );

  return (
    <>
      {isEditor ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {tableInner}
        </DndContext>
      ) : (
        tableInner
      )}

      {selectedProjectId && (
        <ProjectModal
          projectId={selectedProjectId}
          open={!!selectedProjectId}
          onOpenChange={(open) => {
            if (!open) setSelectedProjectId(null);
          }}
          onEdit={(project) => {
            setSelectedProjectId(null);
            setProjectToEdit(project);
          }}
        />
      )}
      <ProjectForm
        open={!!projectToEdit}
        onOpenChange={(open) => {
          if (!open) setProjectToEdit(null);
        }}
        projectToEdit={projectToEdit}
      />
    </>
  );
}

function SortableProjectRow({
  project,
  onClick,
}: {
  project: ProjectWithDetails;
  onClick: () => void;
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
    <TableRow
      ref={setNodeRef}
      style={style}
      className="group cursor-pointer hover:bg-muted/30"
      onClick={onClick}
      data-testid={`pipeline-row-${project.id}`}
    >
      <TableCell className="w-8 p-0 text-center">
        <button
          type="button"
          className="text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing px-1 py-2"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <ProjectRowCells project={project} />
    </TableRow>
  );
}

function ProjectRow({
  project,
  onClick,
}: {
  project: ProjectWithDetails;
  onClick: () => void;
}) {
  return (
    <TableRow
      className="group cursor-pointer hover:bg-muted/30"
      onClick={onClick}
      data-testid={`pipeline-row-${project.id}`}
    >
      <ProjectRowCells project={project} />
    </TableRow>
  );
}

function ProjectRowCells({ project }: { project: ProjectWithDetails }) {
  return (
    <>
      <TableCell>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{project.title}</span>
          {project.storyPoints != null && (
            <Badge
              variant="outline"
              className="shrink-0 text-xs font-semibold px-2 py-0.5 bg-muted/50"
              title={`${project.storyPoints} pts of ~${AVG_CYCLE_CAPACITY} avg per cycle`}
            >
              {cycleEffortPercent(project.storyPoints)} of cycle
            </Badge>
          )}
          {isProjectBlocked(project) && (
            <Badge variant="destructive" className="shrink-0 text-[9px] px-1.5 py-0 leading-none uppercase tracking-wider">
              Blocked
            </Badge>
          )}
        </div>
        {isProjectBlocked(project) && project.latestUpdate?.content && (
          <div className="text-xs text-destructive mt-1 font-medium bg-destructive/10 px-1.5 py-0.5 rounded w-fit max-w-full truncate" title={project.latestUpdate.content}>
            {project.latestUpdate.content}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={`font-medium text-xs ${
            project.status === "done"
              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              : ""
          }`}
        >
          {STATUS_LABELS[project.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{project.team || ""}</span>
          {project.functionName && <span className="text-xs text-muted-foreground">Sponsor: {project.functionName}</span>}
        </div>
      </TableCell>
      <TableCell>
        {project.sponsor ? (
          <span className="text-sm text-foreground">{project.sponsor}</span>
        ) : (
          <span className="text-muted-foreground text-sm"></span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap max-w-[150px]">
          {project.goals?.map((g) => (
            <div key={g.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} title={g.name} />
          ))}
          {(!project.goals || project.goals.length === 0) && <span className="text-muted-foreground text-xs"></span>}
        </div>
      </TableCell>
      <TableCell>
        {project.latestUpdate ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs line-clamp-2 text-muted-foreground italic">"{project.latestUpdate.content}"</span>
            <span className="text-[10px] text-muted-foreground/70">
              {format(parseISO(project.latestUpdate.createdAt), "MMM d")} by {project.latestUpdate.authorName || "Unknown"}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">No updates</span>
        )}
      </TableCell>
    </>
  );
}
