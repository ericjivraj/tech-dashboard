import { useListGoals, useListCycles } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { FilterState } from "@/lib/filter-types";

const STATUS_LABELS: Record<string, string> = {
  new_request: "New Request",
  backlog: "Backlog",
  up_next: "Up Next",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  teams: string[];
  sponsors: string[];
}

export default function FilterBar({ filters, onFiltersChange, teams, sponsors }: FilterBarProps) {
  const { data: goals } = useListGoals();
  const { data: cycles } = useListCycles();

  function update(patch: Partial<FilterState>) {
    onFiltersChange({ ...filters, ...patch });
  }

  const activeFilters: { key: keyof FilterState; label: string }[] = [];
  if (filters.search) activeFilters.push({ key: "search", label: `"${filters.search}"` });
  if (filters.status !== "all") activeFilters.push({ key: "status", label: STATUS_LABELS[filters.status] ?? filters.status });
  if (filters.team !== "all") activeFilters.push({ key: "team", label: filters.team });
  if (filters.sponsor !== "all") activeFilters.push({ key: "sponsor", label: filters.sponsor });
  if (filters.goalId !== "all") {
    const goal = goals?.find((g) => g.id.toString() === filters.goalId);
    activeFilters.push({ key: "goalId", label: goal?.name ?? "Goal" });
  }
  if (filters.cycleId !== "all") {
    const cycle = cycles?.find((c) => c.id.toString() === filters.cycleId);
    activeFilters.push({ key: "cycleId", label: cycle?.name ?? "Cycle" });
  }

  const hasActiveFilters = activeFilters.length > 0;

  function clearFilter(key: keyof FilterState) {
    const defaults: FilterState = { search: "", status: "all", team: "all", sponsor: "all", goalId: "all", cycleId: "all" };
    update({ [key]: defaults[key] });
  }

  function clearAll() {
    onFiltersChange({ search: "", status: "all", team: "all", sponsor: "all", goalId: "all", cycleId: "all" });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="filter-bar">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search projects..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="h-8 pl-8 text-sm"
            data-testid="filter-search"
          />
        </div>

        <Select value={filters.status} onValueChange={(v) => update({ status: v })} data-testid="filter-status">
          <SelectTrigger className="h-8 w-[140px] text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {teams.length > 0 && (
          <Select value={filters.team} onValueChange={(v) => update({ team: v })} data-testid="filter-team">
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {sponsors.length > 0 && (
          <Select value={filters.sponsor} onValueChange={(v) => update({ sponsor: v })} data-testid="filter-sponsor">
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue placeholder="Sponsor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sponsors</SelectItem>
              {sponsors.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {goals && goals.length > 0 && (
          <Select value={filters.goalId} onValueChange={(v) => update({ goalId: v })} data-testid="filter-goal">
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder="Business Goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Goals</SelectItem>
              {goals.map((g) => (
                <SelectItem key={g.id} value={g.id.toString()}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                    {g.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {cycles && cycles.length > 0 && (
          <Select value={filters.cycleId} onValueChange={(v) => update({ cycleId: v })} data-testid="filter-cycle">
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cycles</SelectItem>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearAll} data-testid="filter-clear-all">
            Clear all
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="active-filters">
          <span className="text-xs text-muted-foreground font-medium">Active:</span>
          {activeFilters.map(({ key, label }) => (
            <Badge
              key={key}
              variant="secondary"
              className="gap-1 pr-1 text-xs font-normal cursor-pointer hover:bg-muted"
              data-testid={`active-filter-${key}`}
            >
              {label}
              <button
                onClick={() => clearFilter(key)}
                className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
                aria-label={`Remove ${label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
