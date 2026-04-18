import { useState } from "react";
import { useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import KanbanView from "@/components/kanban-view";
import PipelineView from "@/components/pipeline-view";
import GanttView from "@/components/gantt-view";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ProjectModal from "@/components/project-modal";
import ProjectForm from "@/components/project-form";
import AdminPanel from "@/components/admin-panel";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: user } = useGetMe();
  const [view, setView] = useState("kanban");
  
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  
  const isEditor = user?.isAuthenticated;

  return (
    <div className="container max-w-screen-2xl py-6 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio Overview</h1>
          <p className="text-muted-foreground mt-1">Command center for engineering operations and delivery.</p>
        </div>
        {isEditor && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdminPanelOpen(true)}>
              Admin Settings
            </Button>
            <Button size="sm" className="gap-1" onClick={() => setProjectFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        )}
      </div>

      {isLoadingSummary || !summary ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1" data-testid="metric-total-projects">
              <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
              <p className="text-3xl font-bold">{summary.totalProjects}</p>
            </div>
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1" data-testid="metric-story-points">
              <p className="text-sm font-medium text-muted-foreground">Total Story Points</p>
              <p className="text-3xl font-bold">{summary.totalStoryPoints}</p>
            </div>
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1" data-testid="metric-capacity">
              <p className="text-sm font-medium text-muted-foreground">Capacity</p>
              <p className="text-3xl font-bold">{summary.capacityPercentage}%</p>
            </div>
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1" data-testid="metric-active-cycle">
              <p className="text-sm font-medium text-muted-foreground">Active Cycle</p>
              <p className="text-xl font-semibold truncate" title={summary.activeCycle?.name || "None"}>
                {summary.activeCycle?.name || "None"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm px-6 py-4" data-testid="status-breakdown">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Projects by Status</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {[
                { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
                { key: "up_next", label: "Up Next", color: "bg-indigo-400" },
                { key: "blocked", label: "Blocked", color: "bg-red-500" },
                { key: "new_request", label: "New Request", color: "bg-purple-400" },
                { key: "backlog", label: "Backlog", color: "bg-slate-400" },
                { key: "done", label: "Done", color: "bg-emerald-500" },
              ].map(({ key, label, color }) => {
                const count = (summary.countByStatus as Record<string, number>)[key] ?? 0;
                return (
                  <div key={key} className="flex flex-col gap-1" data-testid={`status-count-${key}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className="text-xl font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full space-y-4">
        <Tabs value={view} onValueChange={setView} className="w-full">
          <div className="flex items-center justify-between border-b pb-4">
            <TabsList className="grid w-full max-w-[400px] grid-cols-3">
              <TabsTrigger value="kanban" data-testid="tab-kanban">Kanban</TabsTrigger>
              <TabsTrigger value="gantt" data-testid="tab-gantt">Timeline</TabsTrigger>
              <TabsTrigger value="pipeline" data-testid="tab-pipeline">List</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="mt-4 flex-1">
            <TabsContent value="kanban" className="m-0 h-full border-0 p-0">
              <KanbanView />
            </TabsContent>
            <TabsContent value="gantt" className="m-0 h-full border-0 p-0">
              <GanttView />
            </TabsContent>
            <TabsContent value="pipeline" className="m-0 h-full border-0 p-0">
              <PipelineView />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <ProjectForm open={projectFormOpen} onOpenChange={setProjectFormOpen} />
      <AdminPanel open={adminPanelOpen} onOpenChange={setAdminPanelOpen} />
    </div>
  );
}