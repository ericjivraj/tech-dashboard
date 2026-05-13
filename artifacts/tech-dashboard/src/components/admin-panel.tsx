import { useState } from "react";
import {
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, getListGoalsQueryKey,
  useListCycles, useCreateCycle, useUpdateCycle, useDeleteCycle, getListCyclesQueryKey,
  useListAuditLog,
} from "@workspace/api-client-react";
import ChangeSitePasscodeDialog from "./change-site-passcode-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Pencil, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

export default function AdminPanel({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Administration</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="goals" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="goals" data-testid="admin-tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="cycles" data-testid="admin-tab-cycles">Cycles</TabsTrigger>
            <TabsTrigger value="audit-log" data-testid="admin-tab-audit-log">Audit Log</TabsTrigger>
            <TabsTrigger value="security" data-testid="admin-tab-security">Security</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 min-h-[400px]">
            <TabsContent value="goals" className="m-0 border-0 p-0 h-full">
              <GoalsTab />
            </TabsContent>
            <TabsContent value="cycles" className="m-0 border-0 p-0 h-full">
              <CyclesTab />
            </TabsContent>
            <TabsContent value="audit-log" className="m-0 border-0 p-0 h-full">
              <AuditLogTab />
            </TabsContent>
            <TabsContent value="security" className="m-0 border-0 p-0 h-full">
              <SecurityTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
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
            <TableHead>Project</TableHead>
            <TableHead>Changes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries?.map(entry => {
            const diff = entry.diff as Record<string, unknown> | null;
            const before = (diff?.before ?? null) as Record<string, unknown> | null;
            const after = (diff?.after ?? null) as Record<string, unknown> | null;
            const entityName =
              (after?.title as string | undefined) ??
              (before?.title as string | undefined) ??
              (after?.name as string | undefined) ??
              (before?.name as string | undefined) ??
              null;

            let diffSummary = "";
            if (entry.action === "update" && before && after) {
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
                <TableCell className="text-sm font-mono">{entry.userEmail || ""}</TableCell>
                <TableCell>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ACTION_COLORS[entry.action] ?? ""}`}>
                    {entry.action}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {entityName ?? <span className="capitalize text-muted-foreground">{entry.entityType} #{entry.entityId}</span>}
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


function SecurityTab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-1">Site passcode</h3>
        <p className="text-xs text-muted-foreground mb-3">
          The passcode visitors enter to access the dashboard. Stored as a bcrypt hash in Postgres — the value never appears in the JS bundle.
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="admin-change-site-passcode">
          Change site passcode
        </Button>
      </div>
      <ChangeSitePasscodeDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
