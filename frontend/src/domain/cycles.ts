import { addDays, daysBetween } from './dates';
import type { CycleRow, Dataset, Op } from './types';

export interface Cycle {
  id: string;
  row: CycleRow;
  number: number;
  start: string;
  // Effective last day: the earlier of end_date and the day before the next start. Null when open.
  end: string | null;
  completed: boolean;
  excluded: boolean;
}

export type CycleDateField = 'first_mucus_day' | 'first_hf_mucus_day' | 'fertile_start' | 'fertile_end';
export const CYCLE_DATE_FIELDS: readonly CycleDateField[] = [
  'first_mucus_day',
  'first_hf_mucus_day',
  'fertile_start',
  'fertile_end',
];

export type Day1Check = { kind: 'none' } | { kind: 'ask'; cycleId: string } | { kind: 'new' };
export type MoveError = 'neighbour' | 'after-end';

export function buildCycles(data: Dataset): Cycle[] {
  const entries = Object.entries(data.cycles).sort(([, a], [, b]) =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0,
  );
  return entries.map(([id, row], index) => {
    const next = entries[index + 1]?.[1].start_date;
    const end = effectiveEnd(row.end_date, next === undefined ? null : addDays(next, -1));
    return {
      id,
      row,
      number: data.settings.cycle_number_start + index,
      start: row.start_date,
      end,
      completed: end !== null,
      excluded: row.excluded_from_stats,
    };
  });
}

function effectiveEnd(endDate: string | null, dayBeforeNext: string | null): string | null {
  if (endDate === null) return dayBeforeNext;
  if (dayBeforeNext === null) return endDate;
  return endDate < dayBeforeNext ? endDate : dayBeforeNext;
}

export function isInCycle(cycle: Cycle, date: string): boolean {
  return date >= cycle.start && (cycle.end === null || date <= cycle.end);
}

export function cycleAt(cycles: Cycle[], date: string): { cycle: Cycle; day: number } | null {
  const cycle = cycles.find((c) => isInCycle(c, date));
  return cycle ? { cycle, day: daysBetween(cycle.start, date) + 1 } : null;
}

// Length of a completed cycle, or the current cycle day for an open one.
export function cycleLength(cycle: Cycle, today: string): number {
  return daysBetween(cycle.start, cycle.end ?? today) + 1;
}

export function isFertileDay(cycle: Cycle, date: string): boolean {
  const { fertile_start: start, fertile_end: end } = cycle.row;
  return start !== null && end !== null && date >= start && date <= end;
}

export function completedLength(cycle: Cycle): number {
  return daysBetween(cycle.start, cycle.end ?? cycle.start) + 1;
}

// Recorded dates (days or readings) that fall inside the cycle, sorted.
export function recordedDatesIn(data: Dataset, cycle: Cycle): string[] {
  const dates = new Set([
    ...Object.keys(data.days),
    ...Object.keys(data.temps).map((key) => key.slice(0, 10)),
  ]);
  return [...dates].filter((date) => isInCycle(cycle, date)).sort();
}

export function day1Check(data: Dataset, date: string): Day1Check {
  const cycles = buildCycles(data);
  if (cycles.some((c) => c.start === date)) return { kind: 'none' };
  const hit = cycleAt(cycles, date);
  if (hit && hit.day >= 2 && hit.day <= 7) return { kind: 'ask', cycleId: hit.cycle.id };
  return { kind: 'new' };
}

export function startCycleOps(data: Dataset, date: string, newId: string): Op[] {
  const hit = cycleAt(buildCycles(data), date);
  const start = { start_date: date, intention: data.settings.default_intention };
  if (hit && hit.cycle.row.end_date !== null) {
    return [
      { entity: 'cycle', key: newId, set: { ...start, end_date: hit.cycle.row.end_date } },
      { entity: 'cycle', key: hit.cycle.id, set: { end_date: null } },
    ];
  }
  return [{ entity: 'cycle', key: newId, set: start }];
}

export function moveStartOps(data: Dataset, cycleId: string, date: string): Op[] | { error: MoveError } {
  const cycles = buildCycles(data);
  const index = cycles.findIndex((c) => c.id === cycleId);
  const previous = cycles[index - 1];
  const next = cycles[index + 1];
  if (previous && date <= previous.start) return { error: 'neighbour' };
  if (next && date >= next.start) return { error: 'neighbour' };
  const ownEnd = cycles[index].row.end_date;
  if (ownEnd !== null && date > ownEnd) return { error: 'after-end' };
  return [{ entity: 'cycle', key: cycleId, set: { start_date: date } }];
}

export function removeStartOps(data: Dataset, cycleId: string): Op[] {
  const cycles = buildCycles(data);
  const index = cycles.findIndex((c) => c.id === cycleId);
  const cycle = cycles[index];
  const previous = cycles[index - 1];
  const ops: Op[] = [{ entity: 'cycle', key: cycleId, delete: true }];
  if (cycle.row.end_date !== null && previous && previous.row.end_date === null) {
    ops.push({ entity: 'cycle', key: previous.id, set: { end_date: cycle.row.end_date } });
  }
  return ops;
}

export function setEndDateOps(cycleId: string, date: string | null): Op[] {
  return [{ entity: 'cycle', key: cycleId, set: { end_date: date } }];
}

export function datesOutsideCycle(cycle: Cycle): CycleDateField[] {
  return CYCLE_DATE_FIELDS.filter((field) => {
    const date = cycle.row[field];
    return date !== null && !isInCycle(cycle, date);
  });
}
