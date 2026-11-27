import { clearReadingOp, excludeReadingOp, type Track } from '../domain/marks';
import { parseTempInput } from '../domain/tempInput';
import type { DayRow, Op, SourceId, TempRow } from '../domain/types';

export interface TempDraft {
  text?: string;
  excluded?: boolean;
  clear?: boolean;
}

export interface Draft {
  fields: Partial<DayRow>;
  temps: Partial<Record<SourceId, TempDraft>>;
  marks: Partial<Record<Track, string | null>>;
}

export const EMPTY: Draft = { fields: {}, temps: {}, marks: {} };

export function isEmpty(draft: Draft): boolean {
  return Object.keys(draft.fields).length + Object.keys(draft.temps).length + Object.keys(draft.marks).length === 0;
}

export function fieldOps(fields: Partial<DayRow>, date: string): Op[] {
  const keys = Object.keys(fields) as (keyof DayRow)[];
  if (keys.length === 0) return [];
  const set = Object.fromEntries(keys.map((key) => [key, fields[key] ?? null]));
  return [{ entity: 'day', key: date, set }];
}

export function tempOps(change: TempDraft, reading: TempRow | undefined, date: string, source: SourceId): { ops: Op[]; invalid: boolean } {
  const key = `${date}/${source}`;
  if (change.clear) return { ops: [clearReadingOp(date, source)], invalid: false };
  const ops: Op[] = [];
  let touched = false;
  if (change.text !== undefined) {
    const parsed = parseTempInput(change.text);
    if (parsed === 'invalid') return { ops: [], invalid: true };
    if (parsed === null) {
      if (reading) return { ops: [clearReadingOp(date, source)], invalid: false };
    } else if (reading?.value !== parsed) {
      ops.push({ entity: 'temp', key, set: { value: parsed } });
      touched = true;
    }
  }
  if (change.excluded !== undefined && (reading || touched)) {
    ops.push(excludeReadingOp(date, source, change.excluded));
  }
  return { ops, invalid: false };
}

// Drops the entries that were saved, unless they changed again while the save ran.
export function withoutSent(current: Draft, sent: Draft): Draft {
  const drop = <T extends object>(now: T, done: T): T =>
    Object.fromEntries(Object.entries(now).filter(([key, value]) => !(key in done) || (done as Record<string, unknown>)[key] !== value)) as T;
  return { fields: drop(current.fields, sent.fields), temps: drop(current.temps, sent.temps), marks: drop(current.marks, sent.marks) };
}
