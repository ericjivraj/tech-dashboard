import { useState } from "react";
import { useListGoals, useListSprints } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Bookmark, BookmarkCheck, ChevronDown, Trash2 } from "lucide-react";
import { DEFAULT_FILTERS, type FilterState } from "@/lib/filter-types";
import { useFilterPresets } from "@/lib/use-filter-presets";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import type { ProjectStatus } from "@workspace/api-client-react";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  squads: string[];
  filteredCount?: number;
  totalCount?: number;
  // Restrict the status multi-select dropdown to a subset (e.g. business view
  // hides backlog/new_request). Defaults to all statuses.
  availableStatuses?: ProjectStatus[];
}

export default function FilterBar({ filters, onFiltersChange, squads, filteredCount, totalCount, availableStatuses }: FilterBarProps) {
  const statusesToShow = availableStatuses ?? STATUS_ORDER;
  const { data: goals } = useListGoals();
  const { data: sprints } = useListSprints();
  const { presets, savePreset, deletePreset } = useFilterPresets();

  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  function update(patch: Partial<FilterState>) {
    onFiltersChange({ ...filters, ...patch });
  }

  // Each chip is independently removable. For multi-select status, we render
  // one chip per selected status with an `extra` payload identifying the
  // specific status to drop on click.
  const activeFilters: { key: keyof FilterState; label: string; extra?: ProjectStatus }[] = [];
  if (filters.search) activeFilters.push({ key: "search", label: `"${filters.search}"` });
  for (const s of filters.status) {
    activeFilters.push({ key: "status", label: STATUS_LABELS[s] ?? s, extra: s });
  }
  if (filters.team !== "all") activeFilters.push({ key: "team", label: filters.team });
  if (filters.goalId !== "all") {
    const goal = goals?.find((g) => g.id.toString() === filters.goalId);
    activeFilters.push({ key: "goalId", label: goal?.name ?? "Goal" });
  }
  if (filters.sprintId !== "all") {
    const sprint = sprints?.find((s) => s.id.toString() === filters.sprintId);
    activeFilters.push({ key: "sprintId", label: sprint?.name ?? "Sprint" });
  }

  const hasActiveFilters = activeFilters.length > 0;

  function clearFilter(key: keyof FilterState, extra?: ProjectStatus) {
    if (key === "status" && extra) {
      // Drop just one status from the multi-select.
      update({ status: filters.status.filter((s) => s !== extra) });
      return;
    }
    update({ [key]: DEFAULT_FILTERS[key] });
  }

  function clearAll() {
    onFiltersChange(DEFAULT_FILTERS);
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
            placeholder="Search anything..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="h-8 pl-8 text-sm"
            data-testid="filter-search"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-[160px] text-sm justify-between font-normal" data-testid="filter-status">
              <span className="truncate">
                {filters.status.length === 0
                  ? "All Statuses"
                  : filters.status.length === 1
                    ? STATUS_LABELS[filters.status[0]]
                    : `${filters.status.length} selected`}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start" className="w-[200px]">
            {statusesToShow.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filters.status.includes(s)}
                onCheckedChange={(checked) => {
                  update({
                    status: checked
                      ? [...filters.status, s]
                      : filters.status.filter((x) => x !== s),
                  });
                }}
                onSelect={(e) => e.preventDefault()}
                data-testid={`filter-status-option-${s}`}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuCheckboxItem>
            ))}
            {filters.status.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => update({ status: [] })} className="text-xs text-muted-foreground">
                  Clear status filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Squad filter hidden — re-enable once there's more than one squad worth filtering by. */}
        {false && squads.length > 0 && (
          <Select value={filters.team} onValueChange={(v) => update({ team: v })} data-testid="filter-team">
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue placeholder="Squad" />
            </SelectTrigger>
            <SelectContent side="bottom" align="start">
              <SelectItem value="all">All Squads</SelectItem>
              {squads.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {goals && goals.length > 0 && (
          <Select value={filters.goalId} onValueChange={(v) => update({ goalId: v })} data-testid="filter-goal">
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder="Business Goal" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" avoidCollisions={false} className="max-h-[60vh]">
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

        {sprints && sprints.length > 0 && (() => {
          const activeSprintId = sprints.find((s) => s.startDate <= today && s.endDate >= today)?.id ?? null;
          const nextSprintId = sprints.find((s) => s.startDate > today)?.id ?? null;
          return (
            <Select
              value={filters.sprintId}
              onValueChange={(v) => {
                // When focusing a sprint for the first time, default the status
                // multi-select to In Development so the timeline lands on the
                // most useful slice. Only auto-set when the user hasn't
                // already chosen any statuses, to avoid overwriting their
                // active selection.
                const patch: Partial<FilterState> = { sprintId: v };
                if (v !== "all" && filters.sprintId === "all" && filters.status.length === 0) {
                  patch.status = ["in_progress"];
                }
                update(patch);
              }}
              data-testid="filter-sprint"
            >
              <SelectTrigger className="h-8 w-[150px] text-sm">
                <SelectValue placeholder="Sprint" />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Sprints</SelectItem>
                {sprints.map((s) => {
                  const isPast = s.endDate < today;
                  return (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      <span className="flex items-center gap-1.5">
                        {s.name}
                        {s.id === activeSprintId && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300 leading-none">Active</span>
                        )}
                        {s.id === nextSprintId && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300 leading-none">Next</span>
                        )}
                        {isPast && s.id !== activeSprintId && (
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
          {activeFilters.map(({ key, label, extra }) => (
            <Badge
              key={extra ? `${key}-${extra}` : key}
              variant="secondary"
              className="gap-1 pr-1 text-xs font-normal cursor-pointer hover:bg-muted"
              data-testid={`active-filter-${key}${extra ? `-${extra}` : ""}`}
            >
              {label}
              <button
                onClick={() => clearFilter(key, extra)}
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
