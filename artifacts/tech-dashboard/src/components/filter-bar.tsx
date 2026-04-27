import { useState } from "react";
import { useListGoals, useListCycles, useListSprints } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Bookmark, BookmarkCheck, ChevronDown, Trash2 } from "lucide-react";
import type { FilterState } from "@/lib/filter-types";
import { useFilterPresets } from "@/lib/use-filter-presets";
import { STATUS_LABELS } from "@/lib/constants";
import type { ProjectStatus } from "@workspace/api-client-react";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  teams: string[];
  sponsors: string[];
  filteredCount?: number;
  totalCount?: number;
}

export default function FilterBar({ filters, onFiltersChange, teams, sponsors, filteredCount, totalCount }: FilterBarProps) {
  const { data: goals } = useListGoals();
  const { data: cycles } = useListCycles();
  const { data: sprints } = useListSprints();
  const { presets, savePreset, deletePreset } = useFilterPresets();

  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  function update(patch: Partial<FilterState>) {
    onFiltersChange({ ...filters, ...patch });
  }

  const activeFilters: { key: keyof FilterState; label: string }[] = [];
  if (filters.search) activeFilters.push({ key: "search", label: `"${filters.search}"` });
  if (filters.status !== "all") activeFilters.push({ key: "status", label: STATUS_LABELS[filters.status as ProjectStatus] ?? filters.status });
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
  if (filters.sprintId !== "all") {
    const sprint = sprints?.find((s) => s.id.toString() === filters.sprintId);
    activeFilters.push({ key: "sprintId", label: sprint?.name ?? "Sprint" });
  }
  if ((filters.size ?? "all") !== "all") activeFilters.push({ key: "size", label: filters.size });

  const hasActiveFilters = activeFilters.length > 0;

  function clearFilter(key: keyof FilterState) {
    const defaults: FilterState = { search: "", status: "all", team: "all", sponsor: "all", goalId: "all", cycleId: "all", sprintId: "all", size: "all" };
    update({ [key]: defaults[key] });
  }

  function clearAll() {
    onFiltersChange({ search: "", status: "all", team: "all", sponsor: "all", goalId: "all", cycleId: "all", sprintId: "all", size: "all" });
  }

  function handleSavePreset() {
    if (!presetName.trim()) return;
    savePreset(presetName, filters);
    setPresetName("");
    setSavePopoverOpen(false);
  }

  function handleApplyPreset(presetFilters: FilterState) {
    onFiltersChange(presetFilters);
  }

  const today = new Date().toISOString().split("T")[0];

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
          <SelectContent side="bottom" align="start">
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
            <SelectContent side="bottom" align="start">
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
            <SelectContent side="bottom" align="start">
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
            <SelectContent position="popper" side="bottom" align="start">
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

        {cycles && cycles.length > 0 && (() => {
          const activeCycleId = cycles.find((c) => c.startDate <= today && c.endDate >= today)?.id ?? null;
          const nextCycleId = cycles.find((c) => c.startDate > today)?.id ?? null;
          return (
            <Select value={filters.cycleId} onValueChange={(v) => update({ cycleId: v, sprintId: "all" })} data-testid="filter-cycle">
              <SelectTrigger className="h-8 w-[150px] text-sm">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Cycles</SelectItem>
                {cycles.map((c) => {
                  const isPast = c.endDate < today;
                  return (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      <span className="flex items-center gap-1.5">
                        {c.name}
                        {c.id === activeCycleId && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300 leading-none">Active</span>
                        )}
                        {c.id === nextCycleId && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300 leading-none">Next</span>
                        )}
                        {isPast && c.id !== activeCycleId && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 leading-none">Done</span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          );
        })()}


        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearAll} data-testid="filter-clear-all">
            Clear all
          </Button>
        )}

        {presets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" data-testid="presets-dropdown">
                <BookmarkCheck className="h-3.5 w-3.5" />
                Presets
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="w-56" data-testid="presets-menu">
              {presets.map((preset, index) => (
                <div key={preset.id}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="flex items-center justify-between gap-2 cursor-pointer pr-1"
                    onSelect={(e) => e.preventDefault()}
                    data-testid={`preset-item-${preset.id}`}
                  >
                    <button
                      className="flex-1 text-left text-sm truncate"
                      onClick={() => handleApplyPreset(preset.filters)}
                      data-testid={`preset-apply-${preset.id}`}
                    >
                      {preset.name}
                    </button>
                    <button
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePreset(preset.id);
                      }}
                      aria-label={`Delete preset ${preset.name}`}
                      data-testid={`preset-delete-${preset.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hasActiveFilters && (
          <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" data-testid="save-preset-button">
                <Bookmark className="h-3.5 w-3.5" />
                Save as preset
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="bottom" align="end" data-testid="save-preset-popover">
              <p className="text-sm font-medium mb-2">Save filter preset</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Preset name..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSavePreset();
                    if (e.key === "Escape") setSavePopoverOpen(false);
                  }}
                  className="h-8 text-sm"
                  autoFocus
                  data-testid="preset-name-input"
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  data-testid="preset-save-confirm"
                >
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {hasActiveFilters && filteredCount !== undefined && totalCount !== undefined && (
          <span className="text-xs text-muted-foreground ml-auto" data-testid="filter-result-count">
            Showing {filteredCount} of {totalCount} projects
          </span>
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
