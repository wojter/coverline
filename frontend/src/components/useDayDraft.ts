import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { TRACKS, assignMarkOps, markOf, removeMarkOps, type Track } from '../domain/marks';
import { cycles, data } from '../data/state';
import { save } from '../data/store';
import { SOURCE_IDS, emptyDayRow, type DayRow, type Op, type SourceId } from '../domain/types';
import { formatTemp } from '../i18n';
import { EMPTY, fieldOps, isEmpty, tempOps, withoutSent, type Draft, type TempDraft } from './draftOps';

// True while a form holds unsaved input. The update toast waits for it.
export const dirty = signal(false);

export type { TempDraft };

export type SaveStatus = 'saved' | 'invalid' | 'noReading' | 'rejected' | null;

export type DayDraft = ReturnType<typeof useDayDraft>;

// Only touched fields are sent (S4.1). Clearing a field sends null.
// Taps save at once; typed text saves on blur, on unmount and when the page is hidden (D24).
export function useDayDraft(date: string) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<SaveStatus>(null);
  const current = useRef<Draft>(EMPTY);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  const saved = data.value.days[date] ?? emptyDayRow();
  const day = { ...saved, ...draft.fields } as DayRow;
  const isDirty = !isEmpty(draft);

  useEffect(() => {
    dirty.value = isDirty;
  }, [isDirty]);
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void commit();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      alive.current = false;
      dirty.value = false;
      void commit();
    };
  }, []);

  function update(change: (draft: Draft) => Draft) {
    current.current = change(current.current);
    if (alive.current) setDraft(current.current);
  }

  function setField<K extends keyof DayRow>(field: K, value: DayRow[K]) {
    typeField(field, value);
    void commit();
  }

  function typeField<K extends keyof DayRow>(field: K, value: DayRow[K]) {
    setStatus(null);
    const cleaned = value === '' || (Array.isArray(value) && value.length === 0) ? null : value;
    update((draft) => ({ ...draft, fields: { ...draft.fields, [field]: cleaned } }));
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
    update((draft) => ({ ...draft, temps: { ...draft.temps, [source]: { ...draft.temps[source], ...change } } }));
    if (change.text === undefined) void commit();
  }

  function clearTemp(source: SourceId) {
    setTemp(source, { text: '', clear: true, excluded: false });
    void commit();
  }

  function markValue(track: Track): string | null {
    return track in draft.marks ? (draft.marks[track] ?? null) : markOf(data.value, track, date);
  }

  function setMark(track: Track, value: string | null) {
    setStatus(null);
    update((draft) => ({ ...draft, marks: { ...draft.marks, [track]: value } }));
    void commit();
  }

  // Saves run one after another, each on the draft as it is when its turn comes.
  function commit(): Promise<void> {
    queue.current = queue.current.then(run, run);
    return queue.current;
  }

  async function run(): Promise<void> {
    const snapshot = current.current;
    if (isEmpty(snapshot)) return;
    const sent: Draft = { fields: snapshot.fields, temps: {}, marks: {} };
    let result: SaveStatus = 'saved';
    const ops: Op[] = fieldOps(snapshot.fields, date);
    for (const source of SOURCE_IDS) {
      const change = snapshot.temps[source];
      if (!change) continue;
      const built = tempOps(change, data.value.temps[`${date}/${source}`], date, source);
      if (built.invalid) {
        result = 'invalid';
        continue;
      }
      ops.push(...built.ops);
      sent.temps[source] = change;
    }
    if (ops.length > 0 && (await save(ops)).length > 0) return report('rejected');

    const markOps: Op[] = [];
    for (const track of TRACKS) {
      if (!(track in snapshot.marks)) continue;
      const value = snapshot.marks[track] ?? null;
      const next = value === null ? removeMarkOps(track, date) : assignMarkOps(data.value, cycles.value, track, date, value);
      if ('error' in next) {
        result = 'noReading';
        continue;
      }
      markOps.push(...next);
      sent.marks[track] = value;
    }
    if (markOps.length > 0 && (await save(markOps)).length > 0) {
      update((draft) => withoutSent(draft, { ...sent, marks: {} }));
      return report('rejected');
    }
    update((draft) => withoutSent(draft, sent));
    report(result);
  }

  function report(result: SaveStatus) {
    if (alive.current) setStatus(result);
  }

  return {
    date,
    day,
    temp,
    setTemp,
    clearTemp,
    setField,
    typeField,
    markValue,
    setMark,
    commit,
    save: commit,
    status,
    dirty: isDirty,
  };
}
