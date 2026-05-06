import { useState } from "react";
import { storyPointsToTShirt } from "@/lib/utils";
import {
  useGetProject, useDeleteProject, getGetProjectQueryKey, getListProjectsQueryKey,
  useListProjectUpdates, useCreateProjectUpdate, useUpdateProjectUpdate, useDeleteProjectUpdate, getListProjectUpdatesQueryKey, getGetDashboardSummaryQueryKey,
  useGetMe,
  ProjectConfidence,
  ProjectStatus,
  ProjectWithDetails,
  type ProjectUpdate
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

import DOMPurify from "dompurify";

// Render description / impact fields. New rows are HTML produced by the
// rich-text editor — sanitized and rendered as HTML. Legacy plain-text rows
// (no tags) fall through to the auto-link path so embedded URLs still work.
function renderRichText(value: string): React.ReactNode {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(value);
  if (looksLikeHtml) {
    const clean = DOMPurify.sanitize(value, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "a"],
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
    });
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:break-all [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }
  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {value.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
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
      )}
    </p>
  );
}
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Edit, Trash2, Clock, Send, X, Pencil, Check, ShieldOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS } from "@/lib/constants";
import { isProjectBlocked } from "@/lib/blocked";

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
  const editUpdate = useUpdateProjectUpdate();
  const deleteUpdate = useDeleteProjectUpdate();
  const deleteProject = useDeleteProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [newUpdateBlocked, setNewUpdateBlocked] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [updateToDeleteId, setUpdateToDeleteId] = useState<number | null>(null);
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editBlocked, setEditBlocked] = useState(false);

  const startEditUpdate = (update: ProjectUpdate) => {
    setEditingUpdateId(update.id);
    setEditContent(update.content);
    setEditBlocked(update.blocked);
  };

  const cancelEditUpdate = () => {
    setEditingUpdateId(null);
    setEditContent("");
    setEditBlocked(false);
  };

  const invalidateProjectViews = () => {
    queryClient.invalidateQueries({ queryKey: getListProjectUpdatesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };

  const saveEditUpdate = () => {
    if (editingUpdateId == null || !editContent.trim()) return;
    const id = editingUpdateId;
    editUpdate.mutate(
      { projectId, updateId: id, data: { content: editContent, blocked: editBlocked } },
      {
        onSuccess: () => {
          cancelEditUpdate();
          invalidateProjectViews();
          toast({ title: "Update edited" });
        },
      },
    );
  };

  const handleUnblock = () => {
    const latest = updates && updates.length > 0 ? updates[0] : null;
    if (!latest || !latest.blocked) return;
    editUpdate.mutate(
      { projectId, updateId: latest.id, data: { blocked: false } },
      {
        onSuccess: () => {
          invalidateProjectViews();
          toast({ title: "Project unblocked" });
        },
      },
    );
  };

  const handlePostUpdate = () => {
    if (!newUpdateContent.trim()) return;
    createUpdate.mutate({ projectId, data: { content: newUpdateContent, blocked: newUpdateBlocked } }, {
      onSuccess: () => {
        setNewUpdateContent("");
        setNewUpdateBlocked(false);
        invalidateProjectViews();
        toast({ title: "Update posted" });
      }
    });
  };

  const confirmDelete = () => {
    deleteProject.mutate({ id: projectId }, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Project deleted" });
      }
    });
  };

  const confirmDeleteUpdate = () => {
    if (updateToDeleteId == null) return;
    const id = updateToDeleteId;
    deleteUpdate.mutate({ projectId, updateId: id }, {
      onSuccess: () => {
        setUpdateToDeleteId(null);
        invalidateProjectViews();
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
                    <Badge variant={project.status === 'done' ? 'default' : 'secondary'} className="font-medium text-xs">
                      {STATUS_LABELS[project.status]}
                    </Badge>
                    {isProjectBlocked(project) && (
                      <Badge variant="destructive" className="font-medium text-xs">
                        Blocked
                      </Badge>
                    )}
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
                  <div className="flex gap-2 shrink-0 mr-8">
                    <Button variant="outline" size="sm" onClick={() => onEdit(project)} className="h-8">
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={deleteProject.isPending}
                      className="h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </DialogHeader>

            {isProjectBlocked(project) && project.latestUpdate?.content && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">Blocked</h4>
                  <p className="text-sm mt-1">{project.latestUpdate.content}</p>
                </div>
                {!readOnly && canEditProject(project.team) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleUnblock}
                    disabled={editUpdate.isPending}
                    data-testid="unblock-project"
                  >
                    <ShieldOff className="h-3.5 w-3.5 mr-1" />
                    {editUpdate.isPending ? "Unblocking…" : "Unblock"}
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Description</h4>
                  {project.description
                    ? renderRichText(project.description)
                    : <p className="text-sm text-muted-foreground">No description provided.</p>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Business Impact</h4>
                  {project.impact
                    ? renderRichText(project.impact)
                    : <p className="text-sm text-muted-foreground">Not specified.</p>}
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

            <div className="pt-4 border-t mt-4 space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Updates
              </h4>
              
              {!readOnly && canEditProject(project?.team) && (
                <div className="space-y-2">
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
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none w-fit">
                    <input
                      type="checkbox"
                      checked={newUpdateBlocked}
                      onChange={(e) => setNewUpdateBlocked(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-input accent-destructive cursor-pointer"
                      data-testid="new-update-blocked"
                    />
                    Mark this update as <span className="font-semibold text-destructive">Blocked</span>
                  </label>
                </div>
              )}

              <div className="space-y-4 mt-4">
                {updates?.map(update => {
                  const isEditing = editingUpdateId === update.id;
                  const editable = !readOnly && canEditProject(project?.team);
                  return (
                    <div key={update.id} className={`border rounded-lg p-3 group relative ${update.blocked ? "bg-destructive/5 border-destructive/30" : "bg-muted/30 border-border/50"}`}>
                      {update.blocked && !isEditing && (
                        <Badge variant="destructive" className="mb-1.5 text-[9px] px-1.5 py-0 leading-none uppercase tracking-wider">
                          Blocked
                        </Badge>
                      )}
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[80px] resize-none text-sm"
                            data-testid={`edit-update-textarea-${update.id}`}
                          />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none w-fit">
                            <input
                              type="checkbox"
                              checked={editBlocked}
                              onChange={(e) => setEditBlocked(e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-input accent-destructive cursor-pointer"
                              data-testid={`edit-update-blocked-${update.id}`}
                            />
                            Mark this update as <span className="font-semibold text-destructive">Blocked</span>
                          </label>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" size="sm" onClick={cancelEditUpdate} disabled={editUpdate.isPending}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={saveEditUpdate} disabled={editUpdate.isPending || !editContent.trim()}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap pr-12">{update.content}</p>
                      )}
                      {!isEditing && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                          <span>{update.authorName || 'Editor'}</span>
                          <span>{format(parseISO(update.createdAt), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      )}
                      {editable && !isEditing && (
                        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            onClick={() => startEditUpdate(update)}
                            aria-label="Edit update"
                            data-testid={`edit-update-${update.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                            onClick={() => setUpdateToDeleteId(update.id)}
                            disabled={deleteUpdate.isPending}
                            aria-label="Delete update"
                            data-testid={`delete-update-${update.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {project?.title
                ? `"${project.title}" will be permanently removed, along with its updates. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteProject.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProject.isPending ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={updateToDeleteId != null} onOpenChange={(open) => { if (!open) setUpdateToDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>
              The update will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUpdate.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteUpdate();
              }}
              disabled={deleteUpdate.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUpdate.isPending ? "Deleting…" : "Delete update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
