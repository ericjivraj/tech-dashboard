import { useState } from "react";
import { 
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, getListGoalsQueryKey,
  useListCycles, useCreateCycle, useUpdateCycle, useDeleteCycle, getListCyclesQueryKey,
  useListSprints, useCreateSprint, useUpdateSprint, useDeleteSprint, getListSprintsQueryKey
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
            <TabsTrigger value="sprints">Sprints</TabsTrigger>
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
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function GoalsTab() {
  const { data: goals, isLoading } = useListGoals();
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  
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
  
  const handleDelete = (id: number) => {
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
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 Revenue" />
        </div>
        <div className="space-y-1 w-24">
          <label className="text-xs font-medium">Color</label>
          <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="p-1 h-9" />
        </div>
        <Button onClick={handleAdd} disabled={!name || createGoal.isPending}><Plus className="h-4 w-4 mr-2"/> Add Goal</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Color</TableHead>
            <TableHead className="w-full">Name</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {goals?.map(g => (
            <TableRow key={g.id}>
              <TableCell>
                <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: g.color }} />
              </TableCell>
              <TableCell className="font-medium">{g.name}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)} disabled={deleteGoal.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
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
  const deleteCycle = useDeleteCycle();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
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
  
  const handleDelete = (id: number) => {
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
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 2024 H1" />
        </div>
        <div className="space-y-1 w-40">
          <label className="text-xs font-medium">Start Date</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1 w-40">
          <label className="text-xs font-medium">End Date</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={!name || !startDate || !endDate || createCycle.isPending}><Plus className="h-4 w-4 mr-2"/> Add Cycle</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-full">Name</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cycles?.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{format(parseISO(c.startDate), 'MMM d, yyyy')}</TableCell>
              <TableCell>{format(parseISO(c.endDate), 'MMM d, yyyy')}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} disabled={deleteCycle.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
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
  const deleteSprint = useDeleteSprint();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [sprintNumber, setSprintNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
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
  
  const handleDelete = (id: number) => {
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
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Sprint name" />
        </div>
        <div className="space-y-1 w-32">
          <label className="text-xs font-medium">Cycle</label>
          <select 
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
        <Button onClick={handleAdd} disabled={!name || !cycleId || !startDate || !endDate || createSprint.isPending} className="w-full sm:w-auto">
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
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sprints?.map(s => {
            const cycle = cycles?.find(c => c.id === s.cycleId);
            return (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name} <span className="text-muted-foreground text-xs ml-2">#{s.sprintNumber}</span></TableCell>
                <TableCell>{cycle?.name}</TableCell>
                <TableCell>{format(parseISO(s.startDate), 'MMM d, yyyy')}</TableCell>
                <TableCell>{format(parseISO(s.endDate), 'MMM d, yyyy')}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} disabled={deleteSprint.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
