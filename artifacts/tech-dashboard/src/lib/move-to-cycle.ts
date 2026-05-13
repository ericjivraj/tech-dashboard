// Plan a "move project to cycle X" action for the gantt-row kebab menu.
//
// Behavior:
//   • Project HAS allocations → shift every allocation forward/backward by the
//     same cycle-index delta. Allocations that would land before the first or
//     after the last known cycle are silently dropped. Start/end dates shift
//     by the same number of days as anchor → target.
//   • Project has NO allocations but HAS story points → derive a single
//     allocation in the target cycle (story_points / 324 × 100 %). Set dates
//     to the target cycle's range so the bar is meaningful.
//   • Project has NO allocations and NO story points → just snap dates to the
//     target cycle, no allocation row created.

import { AVG_CYCLE_CAPACITY } from "./constants";

export interface PlanInputCycle {
  id: number;
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string;
}

export interface PlanInputProject {
  storyPoints?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  cycleAllocations?: { cycleId: number; percent: number }[];
}

export interface MovePlan {
  cycleAllocations: { cycleId: number; percent: number }[];
  startDate: string | null;
  endDate: string | null;
  // What the caller can show in a confirmation toast.
  summary: {
    droppedAllocations: number;
    shiftedDays: number;
    createdAllocation: boolean;
  };
}

const MS_PER_DAY = 86_400_000;

function parseISODateToMs(d: string): number {
  // Treat date strings as midnight UTC so day arithmetic doesn't drift across
  // timezones — the gantt itself uses date-fns parseISO for display, but for
  // shift math we just want integer day deltas.
  return new Date(`${d}T00:00:00Z`).getTime();
}

function formatMsToISODate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function planMoveToCycle(
  project: PlanInputProject,
  targetCycle: PlanInputCycle,
  cyclesSortedByStart: PlanInputCycle[],
): MovePlan {
  const allocs = project.cycleAllocations ?? [];

  if (allocs.length > 0) {
    const cycleById = new Map(cyclesSortedByStart.map((c) => [c.id, c]));
    const knownAllocs = allocs.flatMap((a) => {
      const cycle = cycleById.get(a.cycleId);
      return cycle ? [{ alloc: a, cycle }] : [];
    });
    if (knownAllocs.length === 0) {
      // All allocations point to cycles we don't know about — fall through
      // to the no-allocations branch below to do a fresh placement.
    } else {
      knownAllocs.sort((a, b) => a.cycle.startDate.localeCompare(b.cycle.startDate));
      const anchor = knownAllocs[0];
      const anchorIdx = cyclesSortedByStart.findIndex((c) => c.id === anchor.cycle.id);
      const targetIdx = cyclesSortedByStart.findIndex((c) => c.id === targetCycle.id);
      const cycleDelta = targetIdx - anchorIdx;

      const dateDeltaDays = Math.round(
        (parseISODateToMs(targetCycle.startDate) - parseISODateToMs(anchor.cycle.startDate)) / MS_PER_DAY,
      );

      const newAllocs: { cycleId: number; percent: number }[] = [];
      let dropped = 0;
      for (const a of allocs) {
        const oldCycle = cycleById.get(a.cycleId);
        if (!oldCycle) {
          dropped++;
          continue;
        }
        const oldIdx = cyclesSortedByStart.findIndex((c) => c.id === oldCycle.id);
        const newIdx = oldIdx + cycleDelta;
        if (newIdx < 0 || newIdx >= cyclesSortedByStart.length) {
          dropped++;
          continue;
        }
        newAllocs.push({ cycleId: cyclesSortedByStart[newIdx].id, percent: a.percent });
      }

      const shiftDate = (d: string | null | undefined): string | null => {
        if (!d) return null;
        return formatMsToISODate(parseISODateToMs(d) + dateDeltaDays * MS_PER_DAY);
      };

      return {
        cycleAllocations: newAllocs,
        startDate: shiftDate(project.startDate),
        endDate: shiftDate(project.endDate),
        summary: {
          droppedAllocations: dropped,
          shiftedDays: dateDeltaDays,
          createdAllocation: false,
        },
      };
    }
  }

  // No (known) allocations — do a fresh placement in the target cycle.
  const sp = project.storyPoints ?? null;
  const derivedPercent = sp != null && sp > 0
    ? Math.round((sp / AVG_CYCLE_CAPACITY) * 100 * 100) / 100
    : 0;
  return {
    cycleAllocations: derivedPercent > 0 ? [{ cycleId: targetCycle.id, percent: derivedPercent }] : [],
    startDate: targetCycle.startDate,
    endDate: targetCycle.endDate,
    summary: {
      droppedAllocations: 0,
      shiftedDays: 0,
      createdAllocation: derivedPercent > 0,
    },
  };
}
