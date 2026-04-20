import { useState, useEffect } from "react";
import { 
  useCreateProject, useUpdateProject, 
  getListProjectsQueryKey, getGetDashboardSummaryQueryKey, getGetProjectQueryKey, getGetProjectsTimelineQueryKey,
  useListGoals, useListCycles, useListSprints,
  useGetMe,
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

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  sponsor: z.string().optional().nullable(),
  team: z.string().optional().nullable(),
  stakeholder: z.string().optional().nullable(),
  status: z.enum(["done", "in_progress", "up_next", "backlog", "blocked", "new_request"]),
  confidence: z.enum(["high", "medium", "low", "at_risk"]).optional().nullable(),
  storyPoints: z.coerce.number().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  impact: z.string().optional().nullable(),
  blockedReason: z.string().optional().nullable(),
  cycleId: z.coerce.number().optional().nullable(),
  sprintId: z.coerce.number().optional().nullable(),
  goalIds: z.array(z.number()).default([])
});

export default function ProjectForm({ 
  open, 
  onOpenChange,
  projectToEdit
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  projectToEdit?: ProjectWithDetails | null
}) {
  const { data: goals } = useListGoals();
  const { data: cycles } = useListCycles();
  const { data: sprints } = useListSprints();
  const { data: user } = useGetMe();
  const isGuest = user?.role === "guest";
  const guestTeam = user?.team ?? null;
  
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      goalIds: []
    }
  });

  useEffect(() => {
    if (projectToEdit) {
      form.reset({
        title: projectToEdit.title,
        description: projectToEdit.description,
        sponsor: projectToEdit.sponsor,
        team: projectToEdit.team,
        stakeholder: projectToEdit.stakeholder || "",
        status: projectToEdit.status as "done" | "in_progress" | "up_next" | "backlog" | "blocked" | "new_request",
        confidence: projectToEdit.confidence as "high" | "medium" | "low" | "at_risk" | null,
        storyPoints: projectToEdit.storyPoints,
        startDate: projectToEdit.startDate?.split('T')[0] || "",
        endDate: projectToEdit.endDate?.split('T')[0] || "",
        impact: projectToEdit.impact,
        blockedReason: projectToEdit.blockedReason,
        cycleId: projectToEdit.cycleId,
        sprintId: projectToEdit.sprintId,
        goalIds: projectToEdit.goals?.map(g => g.id) || []
      });
    } else {
      form.reset({
        title: "",
        description: "",
        sponsor: "",
        team: isGuest && guestTeam ? guestTeam : "",
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
        goalIds: []
      });
    }
  }, [projectToEdit, form, isGuest, guestTeam]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const payload = {
      ...values,
      storyPoints: values.storyPoints ? Number(values.storyPoints) : null,
      cycleId: values.cycleId ? Number(values.cycleId) : null,
      sprintId: values.sprintId ? Number(values.sprintId) : null,
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
        }
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
        }
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
            
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {currentStatus === "blocked" && (
              <FormField
                control={form.control}
                name="blockedReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-destructive">Blocked Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="Why is this blocked?" {...field} value={field.value || ""} className="border-destructive/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            <div className="grid grid-cols-3 gap-4">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cycleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cycle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
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
              <FormField
                control={form.control}
                name="sprintId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sprint</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
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
            </div>

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
