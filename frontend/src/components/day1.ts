// Cycle day 1 (spec 2.5). Decides what a tap on the day-1 toggle does.
import { cycles, data } from '../data/state';
import { save } from '../data/store';
import { day1Check, startCycleOps } from '../domain/cycles';

export type Day1Request = { kind: 'ask'; date: string; cycleId: string } | { kind: 'uncheck'; date: string; cycleId: string };

// Returns the dialog to show, or null when the start was created directly.
export function requestDay1(date: string): Day1Request | null {
  const start = cycles.value.find((cycle) => cycle.start === date);
  if (start) return { kind: 'uncheck', date, cycleId: start.id };
  const check = day1Check(data.value, date);
  if (check.kind === 'ask') return { kind: 'ask', date, cycleId: check.cycleId };
  void save(startCycleOps(data.value, date, crypto.randomUUID()));
  return null;
}

export function isCycleStart(date: string): boolean {
  return cycles.value.some((cycle) => cycle.start === date);
}
