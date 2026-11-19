import { addDays, daysBetween, daysInRange } from './dates';
import {
  type Cycle,
  type CycleDateField,
  completedLength,
  cycleLength,
  datesOutsideCycle,
} from './cycles';
import { computedPrevCycleRise, lastMenstruationDay } from './derive';
import { type MarkWarning, lutealLength, markWarnings, mucusPeak, thirdHighDay, tempKey } from './marks';
import type { Dataset, SourceId } from './types';

// Only completed, non-excluded cycles count for totals and source evaluation.
function counts(cycle: Cycle): boolean {
  return cycle.completed && !cycle.excluded;
}

function perSource<T>(make: (source: SourceId) => T): Record<SourceId, T> {
  return { '1': make('1'), '2': make('2') };
}

export interface CycleSummary {
  length: number;
  lastMenstruationDay: string | null;
  mucusPeak: string | null;
  mucusPeakCycleDay: number | null;
  mucusPeakPlus3: string | null;
  thirdHighDay: Record<SourceId, string | null>;
  lutealLength: Record<SourceId, number | null>;
  peakToThirdHigh: Record<SourceId, number | null>;
  shortest: number | null;
  longest: number | null;
  cyclesUsed: number;
  shortestMinus21: number | null;
  shortestMinus20: number | null;
  prevCycleRise: boolean | null;
  outsideDates: CycleDateField[];
  warnings: MarkWarning[];
}

// The N most recent completed, non-excluded cycles that ended before this one started.
function previousCyclesForStats(data: Dataset, cycles: Cycle[], cycle: Cycle): Cycle[] {
  return cycles
    .filter((c) => counts(c) && c.end !== null && c.end < cycle.start)
    .slice(-data.settings.stats_n);
}

export function cycleSummary(data: Dataset, cycles: Cycle[], cycle: Cycle, today: string): CycleSummary {
  const peak = mucusPeak(data, cycle);
  const thirdHigh = perSource((s) => thirdHighDay(data, cycle, s));
  const lengths = previousCyclesForStats(data, cycles, cycle).map(completedLength);
  const shortest = lengths.length > 0 ? Math.min(...lengths) : null;
  return {
    length: cycleLength(cycle, today),
    lastMenstruationDay: lastMenstruationDay(data, cycle),
    mucusPeak: peak,
    mucusPeakCycleDay: peak === null ? null : daysBetween(cycle.start, peak) + 1,
    mucusPeakPlus3: peak === null ? null : addDays(peak, 3),
    thirdHighDay: thirdHigh,
    lutealLength: perSource((s) => lutealLength(data, cycle, s)),
    peakToThirdHigh: perSource((s) => peakToThird(peak, thirdHigh[s])),
    shortest,
    longest: lengths.length > 0 ? Math.max(...lengths) : null,
    cyclesUsed: lengths.length,
    shortestMinus21: shortest === null ? null : shortest - 21,
    shortestMinus20: shortest === null ? null : shortest - 20,
    prevCycleRise: cycle.row.prev_cycle_rise ?? computedPrevCycleRise(data, cycles, cycle),
    outsideDates: datesOutsideCycle(cycle),
    warnings: markWarnings(data, cycle),
  };
}

function peakToThird(peak: string | null, third: string | null): number | null {
  return peak === null || third === null ? null : daysBetween(peak, third);
}

export interface Totals {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
}

export function cycleTotals(cycles: Cycle[], lastN?: number): Totals {
  const counted = cycles.filter(counts);
  const lengths = (lastN === undefined ? counted : counted.slice(-lastN)).map(completedLength);
  if (lengths.length === 0) return { count: 0, average: null, min: null, max: null };
  const sum = lengths.reduce((total, length) => total + length, 0);
  return {
    count: lengths.length,
    average: sum / lengths.length,
    min: Math.min(...lengths),
    max: Math.max(...lengths),
  };
}

export function ringAverage(cycles: Cycle[]): number | null {
  return cycleTotals(cycles).average;
}

export interface SourceEvaluation {
  daysWithReading: number;
  excludedReadings: number;
  missingDays: number;
  cyclesWithRise: number;
  completedCycles: number;
  peakToThirdHigh: { start: string; days: number | null }[];
}

// An excluded reading still counts as a day with a reading.
export function sourceEvaluation(data: Dataset, cycles: Cycle[], source: SourceId): SourceEvaluation {
  const evaluated = cycles.filter(counts);
  let cycleDays = 0;
  let daysWithReading = 0;
  let excludedReadings = 0;
  let cyclesWithRise = 0;
  const peakToThirdHigh = evaluated.map((cycle) => {
    const days = daysInRange(cycle.start, cycle.end ?? cycle.start);
    cycleDays += days.length;
    for (const date of days) {
      const reading = data.temps[tempKey(date, source)];
      if (reading) {
        daysWithReading += 1;
        if (reading.excluded) excludedReadings += 1;
      }
    }
    const third = thirdHighDay(data, cycle, source);
    if (third !== null) cyclesWithRise += 1;
    const peak = mucusPeak(data, cycle);
    return { start: cycle.start, days: peakToThird(peak, third) };
  });
  return {
    daysWithReading,
    excludedReadings,
    missingDays: cycleDays - daysWithReading,
    cyclesWithRise,
    completedCycles: evaluated.length,
    peakToThirdHigh,
  };
}

export function sourceEvaluations(data: Dataset, cycles: Cycle[]): Record<SourceId, SourceEvaluation> {
  return perSource((s) => sourceEvaluation(data, cycles, s));
}
