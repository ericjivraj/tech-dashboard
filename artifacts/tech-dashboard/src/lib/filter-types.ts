export interface FilterState {
  search: string;
  status: string;
  team: string;
  functionName: string;
  goalId: string;
  cycleId: string;
  sprintId: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: "all",
  team: "all",
  functionName: "all",
  goalId: "all",
  cycleId: "all",
  sprintId: "all",
};
