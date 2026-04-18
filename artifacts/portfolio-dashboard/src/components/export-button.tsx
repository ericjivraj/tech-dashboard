import { useState } from "react";
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
import { useListProjects, type ListProjectsParams } from "@workspace/api-client-react";
import { exportProjectsToCSV, exportProjectsToPDF } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  params?: ListProjectsParams;
}

export default function ExportButton({ params }: ExportButtonProps) {
  const { data: projects } = useListProjects(params);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

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

  function handlePDF() {
    if (!projects || projects.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No projects match the current filters.",
        variant: "destructive",
      });
      return;
    }
    exportProjectsToPDF(projects);
    setOpen(false);
  }

  const count = projects?.length ?? null;

  return (
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
          onClick={handlePDF}
          className="gap-2 cursor-pointer"
          data-testid="export-pdf"
        >
          <FileText className="h-4 w-4 text-red-500" />
          Print / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
