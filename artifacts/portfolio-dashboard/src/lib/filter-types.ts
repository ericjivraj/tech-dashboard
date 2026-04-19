export interface FilterState {
  search: string;
  status: string;
  team: string;
  sponsor: string;
  goalId: string;
  cycleId: string;
  sprintId: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: "all",
  team: "all",
  sponsor: "all",
  goalId: "all",
  cycleId: "all",
  sprintId: "all",
};
