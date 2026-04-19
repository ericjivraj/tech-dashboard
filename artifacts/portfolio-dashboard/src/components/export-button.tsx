import { useState, useEffect } from "react";
import { Download, FileText, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  exportProjectsToCSV,
  exportProjectsToPDF,
  PDF_COLUMNS,
  DEFAULT_PDF_COLUMN_KEYS,
} from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

const PDF_COLUMN_STORAGE_KEY = "pdf-selected-columns";

function loadStoredColumns(): string[] {
  try {
    const stored = localStorage.getItem(PDF_COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
        const valid = parsed.filter((k) => DEFAULT_PDF_COLUMN_KEYS.includes(k));
        if (valid.length > 0) return valid;
      }
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_PDF_COLUMN_KEYS;
}

interface ExportButtonProps {
  params?: ListProjectsParams;
}

export default function ExportButton({ params }: ExportButtonProps) {
  const { data: projects } = useListProjects(params);
  const [open, setOpen] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(loadStoredColumns);
  const { toast } = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(PDF_COLUMN_STORAGE_KEY, JSON.stringify(selectedColumns));
    } catch {
      // ignore storage errors
    }
  }, [selectedColumns]);

  function handleCSV() {
    if (!projects || projects.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No projects match the current filters.",
        variant: "destructive",
      });
      return;
    }
    const date = new Date().toISOString().split("T")[0];
    exportProjectsToCSV(projects, `portfolio-${date}.csv`);
    setOpen(false);
    toast({
      title: "CSV downloaded",
      description: `${projects.length} project${projects.length !== 1 ? "s" : ""} exported.`,
    });
  }

  function handlePDFClick() {
    if (!projects || projects.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No projects match the current filters.",
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    setColumnDialogOpen(true);
  }

  function handleExportPDF() {
    if (!projects) return;
    exportProjectsToPDF(projects, selectedColumns);
    setColumnDialogOpen(false);
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function selectAll() {
    setSelectedColumns(DEFAULT_PDF_COLUMN_KEYS);
  }

  function selectNone() {
    setSelectedColumns([]);
  }

  const count = projects?.length ?? null;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5" data-testid="export-button">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            {count !== null
              ? `${count} project${count !== 1 ? "s" : ""}`
              : "Loading…"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleCSV}
            className="gap-2 cursor-pointer"
            data-testid="export-csv"
          >
            <Sheet className="h-4 w-4 text-emerald-600" />
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handlePDFClick}
            className="gap-2 cursor-pointer"
            data-testid="export-pdf"
          >
            <FileText className="h-4 w-4 text-red-500" />
            Print / PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="pdf-column-dialog">
          <DialogHeader>
            <DialogTitle>Choose columns for PDF</DialogTitle>
            <DialogDescription>
              Select which columns to include in the printed report.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 text-xs mb-1">
            <button
              type="button"
              onClick={selectAll}
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

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {PDF_COLUMNS.map((col) => (
              <div key={col.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={selectedColumns.includes(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                  data-testid={`pdf-col-${col.key}`}
                />
                <Label
                  htmlFor={`col-${col.key}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {col.label}
                </Label>
              </div>
            ))}
          </div>

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
              disabled={selectedColumns.length === 0}
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
