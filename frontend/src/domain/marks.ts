import { daysBetween } from './dates';
import { type Cycle, cycleAt, recordedDatesIn } from './cycles';
import { MUCUS_MARK, type Dataset, type MucusMark, type Op, type SourceId, TEMP_MARK } from './types';

export type Track = 'mucus' | SourceId;
export const TRACKS: readonly Track[] = ['mucus', '1', '2'];

export interface MarkWarning {
  track: Track;
  kind: 'duplicate' | 'order';
  value?: string;
}

export function tempKey(date: string, source: SourceId): string {
  return `${date}/${source}`;
}

function markOrder(track: Track): readonly string[] {
  return track === 'mucus' ? MUCUS_MARK : TEMP_MARK;
}

export function markOf(data: Dataset, track: Track, date: string): string | null {
  if (track === 'mucus') return data.days[date]?.mark_mucus ?? null;
  return data.temps[tempKey(date, track)]?.mark ?? null;
}

function markedDates(data: Dataset, cycle: Cycle, track: Track, value: string): string[] {
  return recordedDatesIn(data, cycle).filter((date) => markOf(data, track, date) === value);
}

function setMarkOp(track: Track, date: string, value: string | null): Op {
  if (track === 'mucus') {
    return { entity: 'day', key: date, set: { mark_mucus: value } };
  }
  return { entity: 'temp', key: tempKey(date, track), set: { mark: value } };
}

export function assignMarkOps(
  data: Dataset,
  cycles: Cycle[],
  track: Track,
  date: string,
  value: string,
): Op[] | { error: 'no-reading' } {
  if (track !== 'mucus') {
    const reading = data.temps[tempKey(date, track)];
    if (!reading || reading.excluded) return { error: 'no-reading' };
  }
  const hit = cycleAt(cycles, date);
  const others = hit
    ? markedDates(data, hit.cycle, track, value).filter((other) => other !== date)
    : [];
  return [...others.map((other) => setMarkOp(track, other, null)), setMarkOp(track, date, value)];
}

export function removeMarkOps(track: Track, date: string): Op[] {
  return [setMarkOp(track, date, null)];
}

export function excludeReadingOp(date: string, source: SourceId, excluded: boolean): Op {
  const set = excluded ? { excluded: true, mark: null } : { excluded: false };
  return { entity: 'temp', key: tempKey(date, source), set };
}

export function clearReadingOp(date: string, source: SourceId): Op {
  return { entity: 'temp', key: tempKey(date, source), delete: true };
}

export function markWarnings(data: Dataset, cycle: Cycle): MarkWarning[] {
  const warnings: MarkWarning[] = [];
  for (const track of TRACKS) {
    const marked = recordedDatesIn(data, cycle)
      .map((date) => markOf(data, track, date))
      .filter((value): value is string => value !== null);
    const order = markOrder(track);
    for (const value of new Set(marked)) {
      if (marked.filter((m) => m === value).length > 1) {
        warnings.push({ track, kind: 'duplicate', value });
      }
    }
    const ranks = marked.map((value) => order.indexOf(value));
    if (ranks.some((rank, i) => i > 0 && rank < ranks[i - 1])) {
      warnings.push({ track, kind: 'order' });
    }
  }
  return warnings;
}

export function mucusPeak(data: Dataset, cycle: Cycle): string | null {
  return markedDates(data, cycle, 'mucus', 'P')[0] ?? null;
}

export function thirdHighDay(data: Dataset, cycle: Cycle, source: SourceId): string | null {
  return markedDates(data, cycle, source, '3')[0] ?? null;
}

export function lutealLength(data: Dataset, cycle: Cycle, source: SourceId): number | null {
  const first = markedDates(data, cycle, source, '1')[0];
  if (!cycle.completed || first === undefined || cycle.end === null) return null;
  return daysBetween(first, cycle.end) + 1;
}
