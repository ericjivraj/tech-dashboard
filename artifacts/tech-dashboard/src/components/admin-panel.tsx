import { useState } from "react";
import {
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, getListGoalsQueryKey,
  useListSprints, useCreateSprint, useUpdateSprint, useDeleteSprint, getListSprintsQueryKey,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="goals" data-testid="admin-tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="sprints" data-testid="admin-tab-sprints">Sprints</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 min-h-[400px]">
            <TabsContent value="goals" className="m-0 border-0 p-0 h-full">
              <GoalsTab />
            </TabsContent>
            <TabsContent value="sprints" className="m-0 border-0 p-0 h-full">
              <SprintsTab />
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

function SprintsTab() {
  const { data: sprints } = useListSprints();
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const deleteSprint = useDeleteSprint();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [sprintNumber, setSprintNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSprintNumber, setEditSprintNumber] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const handleAdd = () => {
    if (!name || !sprintNumber || !startDate || !endDate) return;
    createSprint.mutate({ data: { name, sprintNumber: Number(sprintNumber), startDate, endDate } }, {
      onSuccess: () => {
        setName(""); setSprintNumber(""); setStartDate(""); setEndDate("");
        queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey() });
        toast({ title: "Sprint created" });
      }
    });
  };

  const startEdit = (id: number, n: string, num: number, s: string, e: string) => {
    setEditingId(id);
    setEditName(n);
    setEditSprintNumber(num.toString());
    setEditStart(s);
    setEditEnd(e);
  };

  const handleUpdate = (id: number) => {
    if (!editName || !editSprintNumber || !editStart || !editEnd) return;
    updateSprint.mutate({ id, data: { name: editName, sprintNumber: Number(editSprintNumber), startDate: editStart, endDate: editEnd } }, {
      onSuccess: () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey() });
        toast({ title: "Sprint updated" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this sprint? Any project allocations for this sprint will also be removed.")) return;
    deleteSprint.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey() });
        toast({ title: "Sprint deleted" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 p-4 border rounded-lg bg-muted/20">
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sprint 48" data-testid="input-sprint-name" />
        </div>
        <div className="space-y-1 w-24">
          <label className="text-xs font-medium">Sprint #</label>
          <Input type="number" value={sprintNumber} onChange={e => setSprintNumber(e.target.value)} />
        </div>
        <div className="space-y-1 w-40">
          <label className="text-xs font-medium">Start Date</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1 w-40">
          <label className="text-xs font-medium">End Date</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={!name || !sprintNumber || !startDate || !endDate || createSprint.isPending} data-testid="button-add-sprint">
          <Plus className="h-4 w-4 mr-2"/> Add Sprint
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Sprint #</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sprints?.map(s => (
            <TableRow key={s.id} data-testid={`sprint-row-${s.id}`}>
              <TableCell>
                {editingId === s.id ? (
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" />
                ) : <span className="font-medium">{s.name}</span>}
              </TableCell>
              <TableCell>
                {editingId === s.id ? (
                  <Input type="number" value={editSprintNumber} onChange={e => setEditSprintNumber(e.target.value)} className="h-8 text-sm w-20" />
                ) : s.sprintNumber}
              </TableCell>
              <TableCell>
                {editingId === s.id ? (
                  <Input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-8 text-sm w-36" />
                ) : format(parseISO(s.startDate), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                {editingId === s.id ? (
                  <Input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-8 text-sm w-36" />
                ) : format(parseISO(s.endDate), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editingId === s.id ? (
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
                      <Button variant="ghost" size="icon" onClick={() => startEdit(s.id, s.name, s.sprintNumber, s.startDate, s.endDate)} data-testid={`edit-sprint-${s.id}`}>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

