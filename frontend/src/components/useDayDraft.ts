import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { TRACKS, assignMarkOps, clearReadingOp, excludeReadingOp, markOf, removeMarkOps, type Track } from '../domain/marks';
import { parseTempInput } from '../domain/tempInput';
import { cycles, data } from '../data/state';
import { save } from '../data/store';
import { SOURCE_IDS, emptyDayRow, type DayRow, type Op, type SourceId } from '../domain/types';
import { formatTemp } from '../i18n';

// True while a form holds unsaved input. The update toast waits for it.
export const dirty = signal(false);


export interface TempDraft {
  text?: string;
  excluded?: boolean;
  clear?: boolean;
}

interface Draft {
  fields: Partial<DayRow>;
  temps: Partial<Record<SourceId, TempDraft>>;
  marks: Partial<Record<Track, string | null>>;
}

const EMPTY: Draft = { fields: {}, temps: {}, marks: {} };

export type SaveStatus = 'saved' | 'invalid' | 'noReading' | 'rejected' | null;

export type DayDraft = ReturnType<typeof useDayDraft>;

// Only touched fields are sent (S4.1). Clearing a field sends null.
export function useDayDraft(date: string) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<SaveStatus>(null);
  const saved = data.value.days[date] ?? emptyDayRow();
  const day = { ...saved, ...draft.fields } as DayRow;
  const isDirty = Object.keys(draft.fields).length + Object.keys(draft.temps).length + Object.keys(draft.marks).length > 0;

  useEffect(() => {
    dirty.value = isDirty;
  }, [isDirty]);
  useEffect(() => () => {
    dirty.value = false;
  }, []);

  function setField<K extends keyof DayRow>(field: K, value: DayRow[K]) {
    setStatus(null);
    const cleaned = value === '' || (Array.isArray(value) && value.length === 0) ? null : value;
    setDraft((current) => ({ ...current, fields: { ...current.fields, [field]: cleaned } }));
  }

  function temp(source: SourceId) {
    const reading = data.value.temps[`${date}/${source}`];
    const change = draft.temps[source] ?? {};
    return {
      hasReading: reading !== undefined,
      text: change.text ?? (reading ? formatTemp(reading.value) : ''),
      excluded: change.excluded ?? reading?.excluded ?? false,
    };
  }

  function setTemp(source: SourceId, change: TempDraft) {
    setStatus(null);
    setDraft((current) => ({
      ...current,
      temps: { ...current.temps, [source]: { ...current.temps[source], ...change } },
    }));
  }

  function clearTemp(source: SourceId) {
    setTemp(source, { text: '', clear: true, excluded: false });
  }

  function markValue(track: Track): string | null {
    return track in draft.marks ? (draft.marks[track] ?? null) : markOf(data.value, track, date);
  }

  function setMark(track: Track, value: string | null) {
    setStatus(null);
    setDraft((current) => ({ ...current, marks: { ...current.marks, [track]: value } }));
  }

  function fieldOps(): Op[] {
    const keys = Object.keys(draft.fields) as (keyof DayRow)[];
    if (keys.length === 0) return [];
    const set = Object.fromEntries(keys.map((key) => [key, draft.fields[key] ?? null]));
    return [{ entity: 'day', key: date, set }];
  }

  function tempOps(source: SourceId): { ops: Op[]; invalid: boolean } {
    const change = draft.temps[source];
    if (!change) return { ops: [], invalid: false };
    const key = `${date}/${source}`;
    const reading = data.value.temps[key];
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

  async function saveDraft(): Promise<void> {
    const ops: Op[] = [...fieldOps()];
    let invalid = false;
    for (const source of SOURCE_IDS) {
      const result = tempOps(source);
      invalid ||= result.invalid;
      ops.push(...result.ops);
    }
    if (invalid) return setStatus('invalid');
    if (ops.length > 0 && (await save(ops)).length > 0) return setStatus('rejected');

    const markOps: Op[] = [];
    for (const track of TRACKS) {
      if (!(track in draft.marks)) continue;
      const value = draft.marks[track] ?? null;
      if (value === null) {
        markOps.push(...removeMarkOps(track, date));
        continue;
      }
      const result = assignMarkOps(data.value, cycles.value, track, date, value);
      if ('error' in result) return setStatus('noReading');
      markOps.push(...result);
    }
    if (markOps.length > 0 && (await save(markOps)).length > 0) return setStatus('rejected');
    setDraft(EMPTY);
    setStatus('saved');
  }

  return {
    date,
    day,
    temp,
    setTemp,
    clearTemp,
    setField,
    markValue,
    setMark,
    save: saveDraft,
    status,
    dirty: isDirty,
  };
}
