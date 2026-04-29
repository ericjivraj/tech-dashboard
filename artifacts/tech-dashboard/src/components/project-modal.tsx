import { useState } from "react";
import { storyPointsToTShirt } from "@/lib/utils";
import { 
  useGetProject, useDeleteProject, getGetProjectQueryKey, getListProjectsQueryKey,
  useListProjectUpdates, useCreateProjectUpdate, useDeleteProjectUpdate, getListProjectUpdatesQueryKey, getGetDashboardSummaryQueryKey,
  useGetMe,
  ProjectConfidence,
  ProjectStatus,
  ProjectWithDetails
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

// Render free-text fields (description, impact) with any http(s) URLs auto-
// linked. break-all on the link itself lets long URLs wrap mid-character so
// they don't blow out the layout in narrow columns.
function renderTextWithLinks(text: string): React.ReactNode {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Edit, Trash2, Clock, Send, X, Paperclip } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS } from "@/lib/constants";

export default function ProjectModal({ 
  projectId, 
  open, 
  onOpenChange,
  onEdit,
  readOnly = false
}: { 
  projectId: number, 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  onEdit: (project: ProjectWithDetails) => void,
  readOnly?: boolean
}) {
  const { data: project, isLoading } = useGetProject(projectId, { query: { enabled: open && !!projectId, queryKey: getGetProjectQueryKey(projectId) } });
  const { data: updates } = useListProjectUpdates(projectId, { query: { enabled: open && !!projectId, queryKey: getListProjectUpdatesQueryKey(projectId) } });
  const { data: user } = useGetMe();
  const isAdmin = user?.role === "admin";
  const isGuest = user?.role === "guest";
  const guestTeam = user?.team ?? null;
  const isEditor = user?.isEditor === true;

  const canEditProject = (projectTeam?: string | null) =>
    isAdmin || (isGuest && guestTeam !== null && projectTeam === guestTeam);

  const createUpdate = useCreateProjectUpdate();
  const deleteUpdate = useDeleteProjectUpdate();
  const deleteProject = useDeleteProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [newUpdateContent, setNewUpdateContent] = useState("");

  const handlePostUpdate = () => {
    if (!newUpdateContent.trim()) return;
    createUpdate.mutate({ projectId, data: { content: newUpdateContent } }, {
      onSuccess: () => {
        setNewUpdateContent("");
        queryClient.invalidateQueries({ queryKey: getListProjectUpdatesQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }); // Refresh kanban cards
        toast({ title: "Update posted" });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    deleteProject.mutate({ id: projectId }, {
      onSuccess: () => {
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Project deleted" });
      }
    });
  };

  const handleDeleteUpdate = (updateId: number) => {
    if (!confirm("Delete this update?")) return;
    deleteUpdate.mutate({ projectId, updateId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectUpdatesQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Update deleted" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading || !project ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <DialogTitle className="text-xl leading-tight">{project.title}</DialogTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={project.status === 'done' ? 'default' : project.status === 'blocked' ? 'destructive' : 'secondary'} className="font-medium text-xs">
                      {STATUS_LABELS[project.status]}
                    </Badge>
                    {project.storyPoints != null && (() => {
                      const tshirt = storyPointsToTShirt(project.storyPoints);
                      return (
                        <Badge variant="outline" className="text-xs font-semibold bg-muted/50" title={tshirt.tooltip}>
                          {tshirt.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                {!readOnly && canEditProject(project.team) && (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => onEdit(project)} className="h-8">
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteProject.isPending} className="h-8">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </DialogHeader>

            {project.status === 'blocked' && project.blockedReason && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">Blocked</h4>
                  <p className="text-sm mt-1">{project.blockedReason}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Description</h4>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {project.description ? renderTextWithLinks(project.description) : "No description provided."}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Business Impact</h4>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {project.impact ? renderTextWithLinks(project.impact) : "Not specified."}
                  </p>
                </div>
              </div>

              <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Team</span>
                    <span className="text-sm font-medium">{project.team || ""}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Sponsor</span>
                    <span className="text-sm font-medium">{project.sponsor || ""}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Stakeholder</span>
                    <span className="text-sm font-medium">{project.stakeholder || ""}</span>
                  </div>
                </div>
                
                {project.goals && project.goals.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-2">Business Goals</span>
                    <div className="flex flex-wrap gap-1.5">
                      {project.goals.map(g => (
                        <Badge key={g.id} variant="outline" className="border-0 shadow-sm text-xs font-medium px-2 py-0.5" style={{ backgroundColor: `${g.color}20`, color: g.color }}>
                          <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: g.color }} />
                          {g.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(() => {
              // Cast through `unknown` because ProjectWithDetails (from the
              // orval-generated client) doesn't yet include `attachments` —
              // the OpenAPI spec needs regenerating to surface them in the type.
              const attachments = (project as unknown as { attachments?: { id: number; name: string; url: string }[] }).attachments ?? [];
              if (attachments.length === 0) return null;
              return (
                <div className="pt-4 border-t mt-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Attachments
                  </h4>
                  <ul className="space-y-1.5">
                    {attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-2 hover:opacity-80 break-all"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          {a.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            <div className="pt-4 border-t mt-4 space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Updates
              </h4>
              
              {!readOnly && canEditProject(project?.team) && (
                <div className="flex gap-2">
                  <Textarea 
                    placeholder="Post a new update..." 
                    className="min-h-[80px] resize-none text-sm"
                    value={newUpdateContent}
                    onChange={e => setNewUpdateContent(e.target.value)}
                  />
                  <Button className="h-auto px-4" onClick={handlePostUpdate} disabled={createUpdate.isPending || !newUpdateContent.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="space-y-4 mt-4">
                {updates?.map(update => (
                  <div key={update.id} className="bg-muted/30 border border-border/50 rounded-lg p-3 group relative">
                    <p className="text-sm whitespace-pre-wrap pr-6">{update.content}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      <span>{update.authorName || 'Editor'}</span>
                      <span>{format(parseISO(update.createdAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    {!readOnly && canEditProject(project?.team) && (
                      <button
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                        onClick={() => handleDeleteUpdate(update.id)}
                        disabled={deleteUpdate.isPending}
                        aria-label="Delete update"
                        data-testid={`delete-update-${update.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {updates?.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground italic border rounded-lg border-dashed">
                    No updates posted yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
