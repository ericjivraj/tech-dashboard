import { useState } from "react";
import { 
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, getListGoalsQueryKey,
  useListCycles, useCreateCycle, useUpdateCycle, useDeleteCycle, getListCyclesQueryKey,
  useListSprints, useCreateSprint, useUpdateSprint, useDeleteSprint, getListSprintsQueryKey,
  useListUsers, useCreateUser, useDeleteUser, getListUsersQueryKey,
  useListAuditLog, getListAuditLogQueryKey,
  useGetSprintCapacity, useUpsertSprintCapacity, getGetSprintCapacityQueryKey,
  useGetCapacitySummary,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Plus, Pencil, Check, X, Mail, Send, Loader2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { TEAMS } from "@/lib/constants";

export default function AdminPanel({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Administration</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="goals" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="goals" data-testid="admin-tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="cycles" data-testid="admin-tab-cycles">Cycles</TabsTrigger>
            <TabsTrigger value="sprints" data-testid="admin-tab-sprints">Sprints</TabsTrigger>
            <TabsTrigger value="capacity" data-testid="admin-tab-capacity">Capacity</TabsTrigger>
            <TabsTrigger value="email-reports" data-testid="admin-tab-email-reports">Email</TabsTrigger>
            <TabsTrigger value="users" data-testid="admin-tab-users">Users</TabsTrigger>
            <TabsTrigger value="audit-log" data-testid="admin-tab-audit-log">Audit Log</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto mt-4 min-h-[400px]">
            <TabsContent value="goals" className="m-0 border-0 p-0 h-full">
              <GoalsTab />
            </TabsContent>
            <TabsContent value="cycles" className="m-0 border-0 p-0 h-full">
              <CyclesTab />
            </TabsContent>
            <TabsContent value="sprints" className="m-0 border-0 p-0 h-full">
              <SprintsTab />
            </TabsContent>
            <TabsContent value="capacity" className="m-0 border-0 p-0 h-full">
              <SprintCapacityTab />
            </TabsContent>
            <TabsContent value="email-reports" className="m-0 border-0 p-0 h-full">
              <EmailReportsTab />
            </TabsContent>
            <TabsContent value="users" className="m-0 border-0 p-0 h-full">
              <UsersTab />
            </TabsContent>
            <TabsContent value="audit-log" className="m-0 border-0 p-0 h-full">
              <AuditLogTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type EmailSchedule = {
  id: number;
  enabled: boolean;
  dayOfWeek: number;
  hour: number;
  recipients: string;
  lastSentAt: string | null;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function fetchEmailSchedule(): Promise<EmailSchedule> {
  const res = await fetch("/api/email-schedule", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch email schedule");
  return res.json();
}

async function updateEmailSchedule(data: Partial<Omit<EmailSchedule, "id" | "lastSentAt">>): Promise<EmailSchedule> {
  const res = await fetch("/api/email-schedule", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to update email schedule");
  }
  return res.json();
}

async function sendReportNow(): Promise<void> {
  const res = await fetch("/api/email-schedule/send-now", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to send report");
  }
}

async function fetchEmailPreview(): Promise<string> {
  const res = await fetch("/api/email-schedule/preview", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch email preview");
  return res.text();
}

function EmailReportsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["email-schedule"],
    queryFn: fetchEmailSchedule,
  });

  const { data: previewHtml, isFetching: previewLoading, isError: previewError } = useQuery({
    queryKey: ["email-preview"],
    queryFn: fetchEmailPreview,
    enabled: previewOpen,
    staleTime: 0,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: updateEmailSchedule,
    onSuccess: (updated) => {
      queryClient.setQueryData(["email-schedule"], updated);
      toast({ title: "Email schedule saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: sendReportNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-schedule"] });
      toast({ title: "Report sent successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send report", description: err.message, variant: "destructive" });
    },
  });

  const [localRecipients, setLocalRecipients] = useState<string | null>(null);

  if (isLoading || !schedule) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  const recipients = localRecipients !== null ? localRecipients : schedule.recipients;

  const handleSaveRecipients = () => {
    if (localRecipients === null) return;
    updateMutation.mutate({ recipients: localRecipients });
    setLocalRecipients(null);
  };

  const handleToggle = (enabled: boolean) => {
    updateMutation.mutate({ enabled });
  };

  const handleDayChange = (dayOfWeek: number) => {
    updateMutation.mutate({ dayOfWeek });
  };

  const handleHourChange = (hour: number) => {
    updateMutation.mutate({ hour });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/20">
        <Mail className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium">Weekly Portfolio Reports</p>
          <p className="text-xs text-muted-foreground mt-1">
            Automatically send a portfolio summary email with a CSV attachment every week.
            Configure the day, time, and recipient list below.
          </p>
          {!import.meta.env.VITE_RESEND_CONFIGURED && (
            <p className="text-xs text-amber-600 mt-2">
              To enable sending, a <code className="bg-muted px-1 rounded">RESEND_API_KEY</code> environment variable must be set on the API server.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable weekly reports</p>
            <p className="text-xs text-muted-foreground">Send a report email on the configured schedule</p>
          </div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={handleToggle}
            disabled={updateMutation.isPending}
            data-testid="email-reports-enabled-toggle"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Send on</label>
            <select
              className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={schedule.dayOfWeek}
              onChange={e => handleDayChange(Number(e.target.value))}
              disabled={updateMutation.isPending}
              data-testid="email-reports-day-select"
            >
              {DAY_NAMES.map((day, i) => (
                <option key={i} value={i}>{day}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">At (hour, UTC)</label>
            <select
              className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={schedule.hour}
              onChange={e => handleHourChange(Number(e.target.value))}
              disabled={updateMutation.isPending}
              data-testid="email-reports-hour-select"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00 UTC
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Recipients</label>
          <p className="text-xs text-muted-foreground">Enter email addresses separated by commas</p>
          <div className="flex gap-2">
            <Input
              value={recipients}
              onChange={e => setLocalRecipients(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              className="flex-1 font-mono text-sm"
              data-testid="email-reports-recipients-input"
            />
            {localRecipients !== null && (
              <Button
                onClick={handleSaveRecipients}
                disabled={updateMutation.isPending}
                size="sm"
                data-testid="email-reports-save-recipients"
              >
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
            )}
          </div>
        </div>

        {schedule.lastSentAt && (
          <p className="text-xs text-muted-foreground">
            Last sent: {format(new Date(schedule.lastSentAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        )}
      </div>

      <div className="p-4 border rounded-lg space-y-2">
        <p className="text-sm font-medium">Preview &amp; send</p>
        <p className="text-xs text-muted-foreground">
          Preview the email report or send it immediately to all configured recipients.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => {
              queryClient.removeQueries({ queryKey: ["email-preview"] });
              setPreviewOpen(true);
            }}
            variant="outline"
            data-testid="email-reports-preview"
          >
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button
            onClick={() => sendNowMutation.mutate()}
            disabled={sendNowMutation.isPending || !schedule.recipients.trim()}
            variant="outline"
            data-testid="email-reports-send-now"
          >
            {sendNowMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Send Now</>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Report Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden rounded border bg-white">
            {previewLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating preview...
              </div>
            ) : previewError ? (
              <div className="flex items-center justify-center h-64 text-destructive text-sm">
                Failed to load preview. Please try again.
              </div>
            ) : previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[60vh] border-0"
                title="Email report preview"
                sandbox="allow-same-origin"
                data-testid="email-preview-iframe"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalsTab() {
  const { data: goals } = useListGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleAdd = () => {
    if (!name) return;
    createGoal.mutate({ data: { name, color } }, {
      onSuccess: () => {
        setName("");
        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        toast({ title: "Goal created" });
      }
    });
  };

  const startEdit = (id: number, currentName: string, currentColor: string) => {
    setEditingId(id);
    setEditName(currentName);
    setEditColor(currentColor);
  };

  const handleUpdate = (id: number) => {
    if (!editName) return;
    updateGoal.mutate({ id, data: { name: editName, color: editColor } }, {
      onSuccess: () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        toast({ title: "Goal updated" });
      }
    });
  };
  
  const handleDelete = (id: number) => {
    if (!confirm("Delete this goal? It will be removed from all projects.")) return;
    deleteGoal.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        toast({ title: "Goal deleted" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 p-4 border rounded-lg bg-muted/20">
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 Revenue" data-testid="input-goal-name" />
        </div>
        <div className="space-y-1 w-24">
          <label className="text-xs font-medium">Color</label>
          <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="p-1 h-9" />
        </div>
        <Button onClick={handleAdd} disabled={!name || createGoal.isPending} data-testid="button-add-goal">
          <Plus className="h-4 w-4 mr-2"/> Add Goal
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Color</TableHead>
            <TableHead className="w-full">Name</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {goals?.map(g => (
            <TableRow key={g.id} data-testid={`goal-row-${g.id}`}>
              <TableCell>
                {editingId === g.id ? (
                  <Input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="p-1 h-7 w-10" />
                ) : (
                  <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: g.color }} />
                )}
              </TableCell>
              <TableCell className="font-medium">
                {editingId === g.id ? (
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" data-testid={`edit-goal-name-${g.id}`} />
                ) : g.name}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editingId === g.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => handleUpdate(g.id)} disabled={updateGoal.isPending} data-testid={`save-goal-${g.id}`}>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(g.id, g.name, g.color)} data-testid={`edit-goal-${g.id}`}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)} disabled={deleteGoal.isPending} data-testid={`delete-goal-${g.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {goals?.length === 0 && (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No goals found</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CyclesTab() {
  const { data: cycles } = useListCycles();
  const createCycle = useCreateCycle();
  const updateCycle = useUpdateCycle();
  const deleteCycle = useDeleteCycle();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const handleAdd = () => {
    if (!name || !startDate || !endDate) return;
    createCycle.mutate({ data: { name, startDate, endDate } }, {
      onSuccess: () => {
        setName(""); setStartDate(""); setEndDate("");
        queryClient.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        toast({ title: "Cycle created" });
      }
    });
  };

  const startEdit = (id: number, n: string, s: string, e: string) => {
    setEditingId(id);
    setEditName(n);
    setEditStart(s);
    setEditEnd(e);
  };

  const handleUpdate = (id: number) => {
    if (!editName || !editStart || !editEnd) return;
    updateCycle.mutate({ id, data: { name: editName, startDate: editStart, endDate: editEnd } }, {
      onSuccess: () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        toast({ title: "Cycle updated" });
      }
    });
  };
  
  const handleDelete = (id: number) => {
    if (!confirm("Delete this cycle? All sprints in this cycle will also be deleted.")) return;
    deleteCycle.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        toast({ title: "Cycle deleted" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 p-4 border rounded-lg bg-muted/20">
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cycle 5 - Q3 2026" data-testid="input-cycle-name" />
        </div>
        <div className="space-y-1 w-40">
          <label className="text-xs font-medium">Start Date</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1 w-40">
          <label className="text-xs font-medium">End Date</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={!name || !startDate || !endDate || createCycle.isPending} data-testid="button-add-cycle">
          <Plus className="h-4 w-4 mr-2"/> Add Cycle
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cycles?.map(c => (
            <TableRow key={c.id} data-testid={`cycle-row-${c.id}`}>
              <TableCell>
                {editingId === c.id ? (
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" />
                ) : <span className="font-medium">{c.name}</span>}
              </TableCell>
              <TableCell>
                {editingId === c.id ? (
                  <Input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-8 text-sm w-36" />
                ) : format(parseISO(c.startDate), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                {editingId === c.id ? (
                  <Input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-8 text-sm w-36" />
                ) : format(parseISO(c.endDate), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editingId === c.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => handleUpdate(c.id)} disabled={updateCycle.isPending}>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(c.id, c.name, c.startDate, c.endDate)} data-testid={`edit-cycle-${c.id}`}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} disabled={deleteCycle.isPending} data-testid={`delete-cycle-${c.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SprintsTab() {
  const { data: sprints } = useListSprints();
  const { data: cycles } = useListCycles();
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const deleteSprint = useDeleteSprint();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [sprintNumber, setSprintNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCycleId, setEditCycleId] = useState("");
  const [editSprintNumber, setEditSprintNumber] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const handleAdd = () => {
    if (!name || !cycleId || !sprintNumber || !startDate || !endDate) return;
    createSprint.mutate({ data: { name, cycleId: parseInt(cycleId), sprintNumber: parseInt(sprintNumber), startDate, endDate } }, {
      onSuccess: () => {
        setName(""); setSprintNumber(""); setStartDate(""); setEndDate("");
        queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey() });
        toast({ title: "Sprint created" });
      }
    });
  };

  const startEdit = (s: typeof sprints extends (infer T)[] | undefined ? T : never) => {
    if (!s) return;
    setEditingId(s.id);
    setEditName(s.name);
    setEditCycleId(s.cycleId.toString());
    setEditSprintNumber(s.sprintNumber.toString());
    setEditStart(s.startDate);
    setEditEnd(s.endDate);
  };

  const handleUpdate = (id: number) => {
    if (!editName || !editStart || !editEnd) return;
    updateSprint.mutate({ id, data: { name: editName, cycleId: parseInt(editCycleId), sprintNumber: parseInt(editSprintNumber), startDate: editStart, endDate: editEnd } }, {
      onSuccess: () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey() });
        toast({ title: "Sprint updated" });
      }
    });
  };
  
  const handleDelete = (id: number) => {
    if (!confirm("Delete this sprint?")) return;
    deleteSprint.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey() });
        toast({ title: "Sprint deleted" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 p-4 border rounded-lg bg-muted/20">
        <div className="space-y-1 min-w-[120px] flex-1">
          <label className="text-xs font-medium">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Sprint name" data-testid="input-sprint-name" />
        </div>
        <div className="space-y-1 w-32">
          <label className="text-xs font-medium">Cycle</label>
          <select 
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={cycleId} onChange={e => setCycleId(e.target.value)}
          >
            <option value="">Select cycle</option>
            {cycles?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1 w-20">
          <label className="text-xs font-medium">Number</label>
          <Input type="number" value={sprintNumber} onChange={e => setSprintNumber(e.target.value)} />
        </div>
        <div className="space-y-1 w-36">
          <label className="text-xs font-medium">Start Date</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1 w-36">
          <label className="text-xs font-medium">End Date</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={!name || !cycleId || !startDate || !endDate || createSprint.isPending} className="w-full sm:w-auto" data-testid="button-add-sprint">
          <Plus className="h-4 w-4 mr-2"/> Add Sprint
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sprint</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sprints?.map(s => {
            const cycle = cycles?.find(c => c.id === s.cycleId);
            const isEditing = editingId === s.id;
            return (
              <TableRow key={s.id} data-testid={`sprint-row-${s.id}`}>
                <TableCell>
                  {isEditing ? (
                    <div className="flex gap-1 items-center">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm w-28" />
                      <Input type="number" value={editSprintNumber} onChange={e => setEditSprintNumber(e.target.value)} className="h-8 text-sm w-14" />
                    </div>
                  ) : (
                    <span className="font-medium">{s.name} <span className="text-muted-foreground text-xs ml-1">#{s.sprintNumber}</span></span>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <select
                      className="flex h-8 w-full items-center rounded-md border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={editCycleId} onChange={e => setEditCycleId(e.target.value)}
                    >
                      {cycles?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : cycle?.name}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-8 text-sm w-36" />
                  ) : format(parseISO(s.startDate), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-8 text-sm w-36" />
                  ) : format(parseISO(s.endDate), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleUpdate(s.id)} disabled={updateSprint.isPending}>
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(s)} data-testid={`edit-sprint-${s.id}`}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} disabled={deleteSprint.isPending} data-testid={`delete-sprint-${s.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function UsersTab() {
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "guest">("guest");
  const [team, setTeam] = useState("__none__");

  const handleAdd = () => {
    if (!email) return;
    createUser.mutate(
      { data: { email, role, team: team === "__none__" ? null : team } },
      {
        onSuccess: () => {
          setEmail(""); setRole("guest"); setTeam("__none__");
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "User added" });
        },
        onError: (err: Error) => {
          toast({ title: "Failed to add user", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number, userEmail: string) => {
    if (!confirm(`Remove user ${userEmail}?`)) return;
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User removed" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to remove user", description: err.message, variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
        <p className="text-sm font-medium">Add User</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-medium">Email</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" data-testid="input-user-email" />
            <p className="text-xs text-muted-foreground">Their Clerk account will be linked automatically on first login.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "guest")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Team (for guests)</label>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleAdd} disabled={!email || createUser.isPending} size="sm" data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="w-16">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map(u => (
            <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
              <TableCell className="font-mono text-sm">{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">
                  {u.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{u.team || "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{format(new Date(u.createdAt), 'MMM d, yyyy')}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(u.id, u.email)}
                  disabled={deleteUser.isPending}
                  data-testid={`delete-user-${u.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {users?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No users yet. Add a user above.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type SprintCapacityValues = {
  a3: number | null;
  backend: number | null;
  frontend: number | null;
};

function SprintCapacityRow({ sprintId, sprintName }: { sprintId: number; sprintName: string }) {
  const { data } = useGetSprintCapacity(sprintId);
  const upsert = useUpsertSprintCapacity();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<SprintCapacityValues | null>(null);

  const current: SprintCapacityValues = local ?? {
    a3: data?.a3 ?? null,
    backend: data?.backend ?? null,
    frontend: data?.frontend ?? null,
  };

  const isDirty = local !== null;

  const handleSave = () => {
    if (!local) return;
    upsert.mutate({ id: sprintId, data: { a3: local.a3, backend: local.backend, frontend: local.frontend } }, {
      onSuccess: () => {
        setLocal(null);
        queryClient.invalidateQueries({ queryKey: getGetSprintCapacityQueryKey(sprintId) });
        queryClient.invalidateQueries({ queryKey: ["/api/capacity/summary"] });
        toast({ title: `Capacity saved for ${sprintName}` });
      },
      onError: () => {
        toast({ title: "Failed to save capacity", variant: "destructive" });
      },
    });
  };

  const handleChange = (field: keyof SprintCapacityValues, raw: string) => {
    const val = raw === "" ? null : parseInt(raw, 10);
    setLocal(prev => ({ ...((prev ?? current) as SprintCapacityValues), [field]: isNaN(val as number) ? null : val }));
  };

  return (
    <div className="grid grid-cols-5 gap-2 items-center py-1.5 border-b last:border-b-0">
      <div className="col-span-2 text-sm font-medium truncate" title={sprintName}>{sprintName}</div>
      {(["a3", "backend", "frontend"] as const).map(field => (
        <Input
          key={field}
          type="number"
          min={0}
          className="h-7 text-xs"
          value={current[field] ?? ""}
          placeholder="—"
          onChange={e => handleChange(field, e.target.value)}
        />
      ))}
      {isDirty && (
        <Button size="sm" variant="ghost" className="h-7 px-2 col-span-5 justify-end" onClick={handleSave} disabled={upsert.isPending}>
          Save
        </Button>
      )}
    </div>
  );
}

function SprintCapacityTab() {
  const { data: cycles } = useListCycles();
  const { data: sprints } = useListSprints();
  const { data: capacitySummary } = useGetCapacitySummary({});
  const cycleTotalsById = new Map((capacitySummary?.rows ?? []).map(r => [r.id, r]));

  const cyclesSorted = [...(cycles ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/20">
        <div>
          <p className="text-sm font-medium">Sprint Capacity Budgets</p>
          <p className="text-xs text-muted-foreground mt-1">
            Set the story point budget for A3, Backend, and Frontend for each sprint.
            The cycle total is derived automatically (sprint budget × number of sprints).
          </p>
        </div>
      </div>

      {cyclesSorted.map(cycle => {
        const cycleSprints = (sprints ?? []).filter(s => s.cycleId === cycle.id).sort((a, b) => a.sprintNumber - b.sprintNumber);
        return (
          <div key={cycle.id} className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 border-b">
              <span className="text-sm font-semibold">{cycle.name}</span>
            </div>
            <div className="p-4 space-y-1">
              <div className="grid grid-cols-5 gap-2 pb-1 border-b">
                <div className="col-span-2 text-xs font-medium text-muted-foreground">Sprint</div>
                <div className="text-xs font-medium text-muted-foreground text-center">A3 (pts)</div>
                <div className="text-xs font-medium text-muted-foreground text-center">Backend (pts)</div>
                <div className="text-xs font-medium text-muted-foreground text-center">Frontend (pts)</div>
              </div>
              {cycleSprints.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No sprints in this cycle</p>
              ) : (
                cycleSprints.map(sprint => (
                  <SprintCapacityRow key={sprint.id} sprintId={sprint.id} sprintName={sprint.name} />
                ))
              )}
              {(() => {
                const totals = cycleTotalsById.get(cycle.id);
                if (!totals) return null;
                return (
                  <div className="grid grid-cols-5 gap-2 items-center pt-2 mt-1 border-t">
                    <div className="col-span-2 text-xs font-semibold text-muted-foreground">Cycle total</div>
                    <div className="text-xs text-center font-medium">{totals.a3Budget ?? "—"}</div>
                    <div className="text-xs text-center font-medium">{totals.backendBudget ?? "—"}</div>
                    <div className="text-xs text-center font-medium">{totals.frontendBudget ?? "—"}</div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}

      {cyclesSorted.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">
          No cycles found. Create cycles and sprints first.
        </div>
      )}
    </div>
  );
}

function AuditLogTab() {
  const { data: entries, isLoading } = useListAuditLog();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading audit log...
      </div>
    );
  }

  const ACTION_COLORS: Record<string, string> = {
    create: "bg-emerald-100 text-emerald-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Changes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries?.map(entry => {
            const diff = entry.diff as Record<string, unknown> | null;
            let diffSummary = "";
            if (entry.action === "update" && diff?.before && diff?.after) {
              const before = diff.before as Record<string, unknown>;
              const after = diff.after as Record<string, unknown>;
              const changed = Object.entries(after)
                .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k]) && k !== "updatedAt")
                .map(([k]) => k);
              diffSummary = changed.length > 0 ? `Updated: ${changed.join(", ")}` : "No field changes";
            } else if (entry.action === "create") {
              diffSummary = "Created";
            } else if (entry.action === "delete") {
              diffSummary = "Deleted";
            }

            return (
              <TableRow key={entry.id} data-testid={`audit-row-${entry.id}`}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                </TableCell>
                <TableCell className="text-sm font-mono">{entry.userEmail || "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ACTION_COLORS[entry.action] ?? ""}`}>
                    {entry.action}
                  </span>
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {entry.entityType} #{entry.entityId}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={diffSummary}>
                  {diffSummary}
                </TableCell>
              </TableRow>
            );
          })}
          {entries?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No audit log entries yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
