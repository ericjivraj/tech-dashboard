import { useState, useEffect } from "react";
import { 
  useCreateProject, useUpdateProject, 
  getListProjectsQueryKey, getGetDashboardSummaryQueryKey, getGetProjectQueryKey, getGetProjectsTimelineQueryKey,
  useListGoals, useListCycles, useListSprints,
  useGetMe,
  useGetProjectAllocations, useUpsertProjectAllocations, getGetProjectAllocationsQueryKey,
  ProjectWithDetails, ProjectStatus, ProjectConfidence
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TEAMS, SPONSORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import { format, parseISO } from "date-fns";

const SHOW_CONFIDENCE = false;
const SHOW_STORY_POINTS = false;
const SHOW_DATES = false;
const SHOW_SPRINT = false;
const SHOW_SUB_TEAM_ALLOCATION = false;

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  sponsor: z.string().optional().nullable(),
  team: z.string().optional().nullable(),
  stakeholder: z.string().optional().nullable(),
  status: z.enum(["done", "in_progress", "up_next", "backlog", "new_request"]),
  confidence: z.enum(["high", "medium", "low", "at_risk"]).optional().nullable(),
  storyPoints: z.coerce.number().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  impact: z.string().optional().nullable(),
  blockedReason: z.string().optional().nullable(),
  cycleId: z.coerce.number().optional().nullable(),
  sprintId: z.coerce.number().optional().nullable(),
  completionPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  goalIds: z.array(z.number()).default([])
});

type AllocationEntry = {
  sprintId: number;
  sprintName: string;
  a3: number;
  backend: number;
  frontend: number;
};

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
  const { data: cycles } = useListCycles();
  const { data: sprints } = useListSprints();
  const { data: user } = useGetMe();
  const isGuest = user?.role === "guest";
  const guestTeam = user?.team ?? null;
  
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const upsertAllocations = useUpsertProjectAllocations();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [allocations, setAllocations] = useState<AllocationEntry[]>([]);

  const allocProjectId = projectToEdit?.id ?? 0;
  const { data: existingAllocations } = useGetProjectAllocations(
    allocProjectId,
    { query: {
      enabled: !!projectToEdit && projectToEdit.team === "Development",
      queryKey: getGetProjectAllocationsQueryKey(allocProjectId),
    } }
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      sponsor: "",
      team: "",
      stakeholder: "",
      status: "new_request",
      confidence: "medium",
      storyPoints: null,
      startDate: "",
      endDate: "",
      impact: "",
      blockedReason: "",
      cycleId: null,
      sprintId: null,
      completionPercent: null,
      goalIds: []
    }
  });

  const watchedTeam = form.watch("team");
  const watchedCycleId = form.watch("cycleId");
  const watchedStoryPoints = form.watch("storyPoints");
  const isDevTeam = watchedTeam === "Development";

  const watchedStartDate = form.watch("startDate");
  const watchedEndDate = form.watch("endDate");

  const cycleSprintsForAllocation = (() => {
    if (!sprints || !isDevTeam) return [];
    const projectStart = watchedStartDate || (projectToEdit?.startDate?.split("T")[0] ?? null);
    const projectEnd = watchedEndDate || (projectToEdit?.endDate?.split("T")[0] ?? null);
    if (projectStart && projectEnd) {
      return sprints
        .filter(s => s.endDate >= projectStart && s.startDate <= projectEnd)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    if (watchedCycleId) {
      return sprints
        .filter(s => s.cycleId.toString() === watchedCycleId.toString())
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return [];
  })();

  useEffect(() => {
    if (projectToEdit) {
      form.reset({
        title: projectToEdit.title,
        description: projectToEdit.description,
        sponsor: projectToEdit.sponsor,
        team: projectToEdit.team,
        stakeholder: projectToEdit.stakeholder || "",
        status: projectToEdit.status as "done" | "in_progress" | "up_next" | "backlog" | "new_request",
        confidence: projectToEdit.confidence as "high" | "medium" | "low" | "at_risk" | null,
        storyPoints: projectToEdit.storyPoints,
        startDate: projectToEdit.startDate?.split('T')[0] || "",
        endDate: projectToEdit.endDate?.split('T')[0] || "",
        impact: projectToEdit.impact,
        blockedReason: projectToEdit.blockedReason,
        cycleId: projectToEdit.cycleId,
        sprintId: projectToEdit.sprintId,
        completionPercent: projectToEdit.completionPercent ?? null,
        goalIds: projectToEdit.goals?.map(g => g.id) || []
      });
    } else {
      form.reset({
        title: "",
        description: "",
        sponsor: "",
        team: isGuest && guestTeam ? guestTeam : "",
        stakeholder: "",
        status: initialStatus ?? "new_request",
        confidence: "medium",
        storyPoints: null,
        startDate: "",
        endDate: "",
        impact: "",
        blockedReason: "",
        cycleId: null,
        sprintId: null,
        completionPercent: null,
        goalIds: []
      });
      setAllocations([]);
    }
  }, [projectToEdit, form, isGuest, guestTeam, initialStatus, open]);

  useEffect(() => {
    if (!projectToEdit || !existingAllocations || !sprints) return;
    const projectStart = projectToEdit.startDate?.split("T")[0] ?? null;
    const projectEnd = projectToEdit.endDate?.split("T")[0] ?? null;
    let relevantSprints = projectStart && projectEnd
      ? sprints.filter(s => s.endDate >= projectStart && s.startDate <= projectEnd)
      : (projectToEdit.cycleId ? sprints.filter(s => s.cycleId === projectToEdit.cycleId) : []);
    relevantSprints = relevantSprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
    const newAllocations: AllocationEntry[] = relevantSprints.map(sprint => {
      const a3 = existingAllocations.find(a => a.sprintId === sprint.id && a.subTeam === "a3")?.storyPoints ?? 0;
      const backend = existingAllocations.find(a => a.sprintId === sprint.id && a.subTeam === "backend")?.storyPoints ?? 0;
      const frontend = existingAllocations.find(a => a.sprintId === sprint.id && a.subTeam === "frontend")?.storyPoints ?? 0;
      return { sprintId: sprint.id, sprintName: sprint.name, a3, backend, frontend };
    });
    setAllocations(newAllocations);
  }, [existingAllocations, sprints, projectToEdit]);

  useEffect(() => {
    if (!isDevTeam || !cycleSprintsForAllocation.length) return;
    setAllocations(prev => {
      return cycleSprintsForAllocation.map(sprint => {
        const existing = prev.find(a => a.sprintId === sprint.id);
        return existing ?? { sprintId: sprint.id, sprintName: sprint.name, a3: 0, backend: 0, frontend: 0 };
      });
    });
  }, [watchedCycleId, watchedStartDate, watchedEndDate, isDevTeam, sprints]);

  const today = new Date().toISOString().slice(0, 10);
  const totalAllocated = allocations.reduce((sum, a) => sum + a.a3 + a.backend + a.frontend, 0);
  const pastAllocated = allocations
    .filter(a => {
      const sprint = sprints?.find(s => s.id === a.sprintId);
      return sprint && sprint.endDate <= today;
    })
    .reduce((sum, a) => sum + a.a3 + a.backend + a.frontend, 0);
  const autoCompletionPercent = watchedStoryPoints && watchedStoryPoints > 0 && pastAllocated > 0
    ? Math.min(100, Math.round((pastAllocated / watchedStoryPoints) * 100))
    : null;

  const updateAllocation = (sprintId: number, field: "a3" | "backend" | "frontend", value: number) => {
    setAllocations(prev => prev.map(a => a.sprintId === sprintId ? { ...a, [field]: value } : a));
  };

  const saveAllocations = async (projectId: number) => {
    if (!isDevTeam) return;
    const entries = allocations.flatMap(a => [
      ...(a.a3 > 0 ? [{ sprintId: a.sprintId, subTeam: "a3" as const, storyPoints: a.a3 }] : []),
      ...(a.backend > 0 ? [{ sprintId: a.sprintId, subTeam: "backend" as const, storyPoints: a.backend }] : []),
      ...(a.frontend > 0 ? [{ sprintId: a.sprintId, subTeam: "frontend" as const, storyPoints: a.frontend }] : []),
    ]);
    await upsertAllocations.mutateAsync({ id: projectId, data: { allocations: entries } });
  };

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
      sponsor: trim(values.sponsor),
      team: trim(values.team),
      stakeholder: trim(values.stakeholder),
      impact: trim(values.impact),
      blockedReason: trim(values.blockedReason),
      startDate: trim(values.startDate),
      endDate: trim(values.endDate),
      storyPoints: values.storyPoints ? Number(values.storyPoints) : null,
      cycleId: values.cycleId ? Number(values.cycleId) : null,
      sprintId: values.sprintId ? Number(values.sprintId) : null,
      completionPercent: values.completionPercent != null ? Number(values.completionPercent) : null,
    };

    const errorToast = (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      console.error("Project save failed:", err);
    };

    if (projectToEdit) {
      updateProject.mutate({ id: projectToEdit.id, data: payload }, {
        onSuccess: async () => {
          try {
            await saveAllocations(projectToEdit.id);
          } catch {
            toast({ title: "Project updated, but allocations failed to save", variant: "destructive" });
          }
          onOpenChange(false);
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectToEdit.id) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectsTimelineQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/capacity/summary"] });
          toast({ title: "Project updated" });
        },
        onError: errorToast,
      });
    } else {
      createProject.mutate({ data: payload }, {
        onSuccess: async (created) => {
          try {
            await saveAllocations(created.id);
          } catch {
            toast({ title: "Project created, but allocations failed to save", variant: "destructive" });
          }
          onOpenChange(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectsTimelineQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/capacity/summary"] });
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
            
            <div className={SHOW_CONFIDENCE ? "grid grid-cols-2 gap-4" : ""}>
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

              {SHOW_CONFIDENCE && (
                <FormField
                  control={form.control}
                  name="confidence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confidence</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select confidence" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="at_risk">At Risk</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>


            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="team"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={isGuest && !!guestTeam}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TEAMS.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isGuest && guestTeam && (
                      <p className="text-xs text-muted-foreground">Guests can only create projects for their assigned team.</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sponsor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sponsor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sponsor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPONSORS.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="stakeholder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stakeholder</FormLabel>
                  <FormControl>
                    <Input placeholder="Primary stakeholder contact" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(SHOW_STORY_POINTS || SHOW_DATES) && (
              <div className="grid grid-cols-3 gap-4">
                {SHOW_STORY_POINTS && (
                  <FormField
                    control={form.control}
                    name="storyPoints"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Story Points</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {SHOW_DATES && (
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {SHOW_DATES && (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <div className={SHOW_SPRINT ? "grid grid-cols-2 gap-4" : ""}>
              <FormField
                control={form.control}
                name="cycleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cycle</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                      value={field.value != null ? field.value.toString() : "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select cycle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {cycles?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {SHOW_SPRINT && (
                <FormField
                  control={form.control}
                  name="sprintId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sprint</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                        value={field.value != null ? field.value.toString() : "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sprint" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {sprints?.filter(s => !form.watch("cycleId") || s.cycleId.toString() === form.watch("cycleId")?.toString()).map(s => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {SHOW_SUB_TEAM_ALLOCATION && isDevTeam && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-950/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Sub-team Allocation</h4>
                  {watchedCycleId ? null : (
                    <span className="text-xs text-muted-foreground">Select a cycle to enter sprint allocations</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="completionPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">% Complete</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              placeholder={autoCompletionPercent != null ? `Auto: ${autoCompletionPercent}%` : "0–100"}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          {field.value != null && (
                            <Button type="button" variant="ghost" size="sm" className="text-xs px-2 h-8" onClick={() => form.setValue("completionPercent", null)}>
                              Reset
                            </Button>
                          )}
                        </div>
                        {field.value == null && autoCompletionPercent != null && (
                          <p className="text-xs text-muted-foreground">Auto-calculated: {autoCompletionPercent}%</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {cycleSprintsForAllocation.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground">
                      <div>Sprint</div>
                      <div>A3 pts</div>
                      <div>Backend pts</div>
                      <div>Frontend pts</div>
                    </div>
                    {cycleSprintsForAllocation.map(sprint => {
                      const alloc = allocations.find(a => a.sprintId === sprint.id) ?? { sprintId: sprint.id, sprintName: sprint.name, a3: 0, backend: 0, frontend: 0 };
                      return (
                        <div key={sprint.id} className="grid grid-cols-4 gap-2 items-center">
                          <div className="text-xs font-medium truncate" title={sprint.name}>{sprint.name}</div>
                          <Input
                            type="number"
                            min={0}
                            className="h-7 text-xs"
                            value={alloc.a3 || ""}
                            placeholder="0"
                            onChange={e => updateAllocation(sprint.id, "a3", Number(e.target.value) || 0)}
                          />
                          <Input
                            type="number"
                            min={0}
                            className="h-7 text-xs"
                            value={alloc.backend || ""}
                            placeholder="0"
                            onChange={e => updateAllocation(sprint.id, "backend", Number(e.target.value) || 0)}
                          />
                          <Input
                            type="number"
                            min={0}
                            className="h-7 text-xs"
                            value={alloc.frontend || ""}
                            placeholder="0"
                            onChange={e => updateAllocation(sprint.id, "frontend", Number(e.target.value) || 0)}
                          />
                        </div>
                      );
                    })}
                    {totalAllocated > 0 && (
                      <p className="text-xs text-muted-foreground pt-1">
                        Total allocated: {totalAllocated} pts
                        {watchedStoryPoints ? ` / ${watchedStoryPoints} pts (${Math.round((totalAllocated / watchedStoryPoints) * 100)}%)` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[100px]" {...field} value={field.value || ""} />
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
                    <Textarea className="min-h-[80px]" {...field} value={field.value || ""} />
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
