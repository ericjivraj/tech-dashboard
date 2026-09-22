// Plan a "move project to sprint X" action for the gantt-row kebab menu.
//
// Behavior:
//   • Project HAS allocations → shift every allocation forward/backward by the
//     same sprint-index delta. Allocations that would land before the first or
//     after the last known sprint are silently dropped. Start/end dates shift
//     by the same number of days as anchor → target.
//   • Project has NO allocations but HAS story points → derive a single
//     allocation in the target sprint (story_points / 216 × 100 %). Set dates
//     to the target sprint's range so the bar is meaningful.
//   • Project has NO allocations and NO story points → just snap dates to the
//     target sprint, no allocation row created.

// Average story-point capacity of a single sprint. Used to derive a % of
// sprint capacity from a project's story points when it has no existing
// allocations to anchor from. Scaled down from the old per-cycle figure
// (324, for ~6-week cycles) by the ~4-week sprint duration: 324 * 4/6 ≈ 216.
// Adjust if real sprint velocity data suggests a different baseline.
const AVG_SPRINT_CAPACITY = 216;

export interface PlanInputSprint {
  id: number;
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string;
}

export interface PlanInputProject {
  storyPoints?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  sprintAllocations?: { sprintId: number; percent: number }[];
}

export interface MovePlan {
  sprintAllocations: { sprintId: number; percent: number }[];
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

export function planMoveToSprint(
  project: PlanInputProject,
  targetSprint: PlanInputSprint,
  sprintsSortedByStart: PlanInputSprint[],
): MovePlan {
  const allocs = project.sprintAllocations ?? [];

  if (allocs.length > 0) {
    const sprintById = new Map(sprintsSortedByStart.map((s) => [s.id, s]));
    const knownAllocs = allocs.flatMap((a) => {
      const sprint = sprintById.get(a.sprintId);
      return sprint ? [{ alloc: a, sprint }] : [];
    });
    if (knownAllocs.length === 0) {
      // All allocations point to sprints we don't know about — fall through
      // to the no-allocations branch below to do a fresh placement.
    } else {
      knownAllocs.sort((a, b) => a.sprint.startDate.localeCompare(b.sprint.startDate));
      const anchor = knownAllocs[0];
      const anchorIdx = sprintsSortedByStart.findIndex((s) => s.id === anchor.sprint.id);
      const targetIdx = sprintsSortedByStart.findIndex((s) => s.id === targetSprint.id);
      const sprintDelta = targetIdx - anchorIdx;

      const dateDeltaDays = Math.round(
        (parseISODateToMs(targetSprint.startDate) - parseISODateToMs(anchor.sprint.startDate)) / MS_PER_DAY,
      );

      const newAllocs: { sprintId: number; percent: number }[] = [];
      let dropped = 0;
      for (const a of allocs) {
        const oldSprint = sprintById.get(a.sprintId);
        if (!oldSprint) {
          dropped++;
          continue;
        }
        const oldIdx = sprintsSortedByStart.findIndex((s) => s.id === oldSprint.id);
        const newIdx = oldIdx + sprintDelta;
        if (newIdx < 0 || newIdx >= sprintsSortedByStart.length) {
          dropped++;
          continue;
        }
        newAllocs.push({ sprintId: sprintsSortedByStart[newIdx].id, percent: a.percent });
      }

      const shiftDate = (d: string | null | undefined): string | null => {
        if (!d) return null;
        return formatMsToISODate(parseISODateToMs(d) + dateDeltaDays * MS_PER_DAY);
      };

      return {
        sprintAllocations: newAllocs,
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

  // No (known) allocations — do a fresh placement in the target sprint.
  const sp = project.storyPoints ?? null;
  const derivedPercent = sp != null && sp > 0
    ? Math.round((sp / AVG_SPRINT_CAPACITY) * 100 * 100) / 100
    : 0;
  return {
    sprintAllocations: derivedPercent > 0 ? [{ sprintId: targetSprint.id, percent: derivedPercent }] : [],
    startDate: targetSprint.startDate,
    endDate: targetSprint.endDate,
    summary: {
      droppedAllocations: 0,
      shiftedDays: 0,
      createdAllocation: derivedPercent > 0,
    },
  };
}
