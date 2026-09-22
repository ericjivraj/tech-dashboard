import { useEffect } from "react";
import {
  useCreateProject, useUpdateProject,
  getListProjectsQueryKey, getGetDashboardSummaryQueryKey, getGetProjectQueryKey, getGetProjectsTimelineQueryKey,
  useListGoals, useListSprints,
  ProjectWithDetails, ProjectStatus,
  ApiError,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "./rich-text-editor";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SQUADS, STATUS_LABELS, STATUS_ORDER, STAGE_ORDER } from "@/lib/constants";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  team: z.string().optional().nullable(),
  status: z.enum(["done", "in_progress", "up_next", "backlog", "new_request"]),
  stageSchedules: z.array(z.object({
    stage: z.enum(["backlog", "up_next", "in_progress"]),
    startDate: z.string(),
    endDate: z.string(),
  })).default([]),
  impact: z.string().optional().nullable(),
  goalIds: z.array(z.number()).default([])
});

export default function ProjectForm({
  open,
  onOpenChange,
  projectToEdit,
  initialStatus,
}: {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  projectToEdit?: ProjectWithDetails | null,
  initialStatus?: ProjectStatus,
}) {
  const { data: goals } = useListGoals();
  const { data: sprints } = useListSprints();

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      team: "",
      status: "new_request",
      impact: "",
      goalIds: [],
      stageSchedules: STAGE_ORDER.map(stage => ({ stage, startDate: "", endDate: "" })),
    }
  });

  useEffect(() => {
    if (projectToEdit) {
      form.reset({
        title: projectToEdit.title,
        description: projectToEdit.description,
        team: projectToEdit.team,
        status: projectToEdit.status as "done" | "in_progress" | "up_next" | "backlog" | "new_request",
        impact: projectToEdit.impact,
        goalIds: projectToEdit.goals?.map(g => g.id) || [],
        stageSchedules: STAGE_ORDER.map(stage => {
          const existing = projectToEdit.stageSchedules?.find(s => s.stage === stage);
          return {
            stage,
            startDate: existing?.startDate?.split('T')[0] ?? "",
            endDate: existing?.endDate?.split('T')[0] ?? "",
          };
        }),
      });
    } else {
      form.reset({
        title: "",
        description: "",
        team: "",
        status: initialStatus ?? "new_request",
        impact: "",
        goalIds: [],
        stageSchedules: STAGE_ORDER.map(stage => ({ stage, startDate: "", endDate: "" })),
      });
    }
  }, [projectToEdit, form, initialStatus, open]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const trim = (v: string | null | undefined) => {
      if (v == null) return null;
      const t = v.trim();
      return t === "" ? null : t;
    };
    const payload = {
      ...values,
      title: values.title.trim(),
      description: trim(values.description),
      team: trim(values.team),
      impact: trim(values.impact),
      stageSchedules: values.stageSchedules.filter((s) => s.startDate && s.endDate),
      // Optimistic concurrency token: the server compares this to the row's
      // current updated_at and 409s if someone else saved in between.
      expectedUpdatedAt: projectToEdit?.updatedAt ?? undefined,
    };

    const errorToast = (err: unknown) => {
      // Stale-write rejection from the server (someone else edited this
      // project after the form was opened). Refetch so the form picks up
      // the latest data on next open, and tell the user clearly so they can
      // re-apply their change instead of clobbering.
      if (err instanceof ApiError && err.status === 409 && projectToEdit) {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectToEdit.id) });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProjectsTimelineQueryKey() });
        toast({
          title: "Project changed by someone else",
          description: "Reopen this project to see the latest version, then re-apply your edit. Your changes were not saved.",
          variant: "destructive",
        });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      console.error("Project save failed:", err);
    };

    if (projectToEdit) {
      updateProject.mutate({ id: projectToEdit.id, data: payload }, {
        onSuccess: () => {
          onOpenChange(false);
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectToEdit.id) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectsTimelineQueryKey() });
          toast({ title: "Project updated" });
        },
        onError: errorToast,
      });
    } else {
      createProject.mutate({ data: payload }, {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectsTimelineQueryKey() });
          toast({ title: "Project created" });
        },
        onError: errorToast,
      });
    }
  };

  const currentStatus = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{projectToEdit ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              const firstField = Object.keys(errors)[0];
              const firstMsg = (errors[firstField as keyof typeof errors] as { message?: string } | undefined)?.message;
              toast({
                title: "Couldn't save — please check the form",
                description: firstField ? `${firstField}: ${firstMsg ?? "invalid"}` : undefined,
                variant: "destructive",
              });
              console.error("Project form validation errors:", errors);
            })}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Project title" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_ORDER.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="team"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Squad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select squad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SQUADS.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stageSchedules"
              render={({ field }) => {
                const rows = field.value ?? [];
                const getRow = (stage: (typeof STAGE_ORDER)[number]) =>
                  rows.find((r) => r.stage === stage) ?? { stage, startDate: "", endDate: "" };
                const setRow = (stage: (typeof STAGE_ORDER)[number], startDate: string, endDate: string) => {
                  const others = rows.filter((r) => r.stage !== stage);
                  field.onChange([...others, { stage, startDate, endDate }]);
                };
                const applySprint = (stage: (typeof STAGE_ORDER)[number], sprintId: string) => {
                  const sprint = sprints?.find((s) => s.id.toString() === sprintId);
                  if (!sprint) return;
                  setRow(stage, sprint.startDate, sprint.endDate);
                };

                return (
                  <FormItem>
                    <FormLabel className="m-0">Project Stages</FormLabel>
                    <p className="text-xs text-muted-foreground mt-1">
                      Schedule when each lifecycle stage takes place — shown as separate bars in the Timeline view.
                    </p>
                    <div className="rounded-md border bg-muted/20 p-3 space-y-3 mt-1.5">
                      {STAGE_ORDER.map((stage) => {
                        const row = getRow(stage);
                        return (
                          <div key={stage} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                            <div className="space-y-1">
                              <label className="text-xs font-medium">{STATUS_LABELS[stage]}</label>
                              <Input
                                type="date"
                                className="h-8 text-sm"
                                value={row.startDate}
                                onChange={(e) => setRow(stage, e.target.value, row.endDate)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-transparent select-none">End</label>
                              <Input
                                type="date"
                                className="h-8 text-sm"
                                value={row.endDate}
                                onChange={(e) => setRow(stage, row.startDate, e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-transparent select-none">Sprint</label>
                              <Select value="" onValueChange={(v) => applySprint(stage, v)}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Pick sprint..." />
                                </SelectTrigger>
                                <SelectContent side="bottom" align="start">
                                  {(sprints ?? []).map((s) => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {(row.startDate || row.endDate) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => setRow(stage, "", "")}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      minHeight="120px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="impact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Impact</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      minHeight="80px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goalIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Goals</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1" data-testid="goal-selection">
                    {goals?.map((goal) => {
                      const checked = (field.value ?? []).includes(goal.id);
                      return (
                        <label
                          key={goal.id}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              const current = field.value ?? [];
                              if (val) {
                                field.onChange([...current, goal.id]);
                              } else {
                                field.onChange(current.filter((id: number) => id !== goal.id));
                              }
                            }}
                            data-testid={`goal-checkbox-${goal.id}`}
                          />
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: goal.color }}
                          />
                          <span className="text-sm">{goal.name}</span>
                        </label>
                      );
                    })}
                    {(!goals || goals.length === 0) && (
                      <p className="text-sm text-muted-foreground col-span-2">
                        No business goals defined. Add them via Admin Settings.
                      </p>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4 gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
                {projectToEdit ? "Save Changes" : "Create Project"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
