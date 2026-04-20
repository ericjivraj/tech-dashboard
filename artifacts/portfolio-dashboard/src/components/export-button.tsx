import { useState, useEffect } from "react";
import { Download, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useListProjects, type ListProjectsParams } from "@workspace/api-client-react";
import {
  exportProjectsToPDF,
  PDF_COLUMNS,
  DEFAULT_PDF_COLUMN_KEYS,
} from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

const PDF_COLUMN_STORAGE_KEY = "pdf-selected-columns";
const PDF_COLUMN_ORDER_KEY = "pdf-column-order";

function loadStoredSelectedColumns(): Set<string> {
  try {
    const stored = localStorage.getItem(PDF_COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
        const valid = parsed.filter((k) => DEFAULT_PDF_COLUMN_KEYS.includes(k));
        if (valid.length > 0) return new Set(valid);
      }
    }
  } catch {
    // ignore
  }
  return new Set(DEFAULT_PDF_COLUMN_KEYS);
}

function loadStoredColumnOrder(): string[] {
  try {
    const stored = localStorage.getItem(PDF_COLUMN_ORDER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
        const valid = parsed.filter((k) => DEFAULT_PDF_COLUMN_KEYS.includes(k));
        const missing = DEFAULT_PDF_COLUMN_KEYS.filter((k) => !valid.includes(k));
        return [...valid, ...missing];
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PDF_COLUMN_KEYS;
}

interface SortableColumnRowProps {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function SortableColumnRow({ id, label, checked, onToggle }: SortableColumnRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        aria-label={`Drag to reorder ${label}`}
        data-testid={`drag-handle-${id}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        id={`col-${id}`}
        checked={checked}
        onCheckedChange={onToggle}
        data-testid={`pdf-col-${id}`}
      />
      <Label
        htmlFor={`col-${id}`}
        className="text-sm font-normal cursor-pointer flex-1"
      >
        {label}
      </Label>
    </div>
  );
}

interface ExportButtonProps {
  params?: ListProjectsParams;
}

export default function ExportButton({ params }: ExportButtonProps) {
  const { data: projects } = useListProjects(params);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(loadStoredSelectedColumns);
  const [columnOrder, setColumnOrder] = useState<string[]>(loadStoredColumnOrder);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    try {
      localStorage.setItem(PDF_COLUMN_STORAGE_KEY, JSON.stringify([...selectedColumns]));
    } catch {
      // ignore
    }
  }, [selectedColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(PDF_COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
    } catch {
      // ignore
    }
  }, [columnOrder]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function handleExportClick() {
    if (!projects || projects.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No projects match the current filters.",
        variant: "destructive",
      });
      return;
    }
    setColumnDialogOpen(true);
  }

  function handleExportPDF() {
    if (!projects) return;
    const orderedSelected = columnOrder.filter((k) => selectedColumns.has(k));
    exportProjectsToPDF(projects, orderedSelected);
    setColumnDialogOpen(false);
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function resetToDefaults() {
    setSelectedColumns(new Set(DEFAULT_PDF_COLUMN_KEYS));
    setColumnOrder(DEFAULT_PDF_COLUMN_KEYS);
  }

  function selectNone() {
    setSelectedColumns(new Set());
  }

  const columnLabelMap = new Map(PDF_COLUMNS.map((c) => [c.key, c.label]));

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        data-testid="export-button"
        onClick={handleExportClick}
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>

      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className="sm:max-w-xs" data-testid="pdf-column-dialog">
          <DialogHeader>
            <DialogTitle>Choose columns for PDF</DialogTitle>
            <DialogDescription>
              Check columns to include and drag to reorder them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 text-xs mb-1">
            <button
              type="button"
              onClick={resetToDefaults}
              className="text-primary underline-offset-2 hover:underline"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-0.5">
                {columnOrder.map((key) => (
                  <SortableColumnRow
                    key={key}
                    id={key}
                    label={columnLabelMap.get(key) ?? key}
                    checked={selectedColumns.has(key)}
                    onToggle={() => toggleColumn(key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumnDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExportPDF}
              disabled={selectedColumns.size === 0}
              data-testid="pdf-export-confirm"
            >
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
