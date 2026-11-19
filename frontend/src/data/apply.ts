// Client twin of backend/app/models.py and sync.py. Same rules, so local and server results agree.
// Architecture 5.1 defines the rules. The ops fixture in fixtures/ops.cases.json tests them.

import { isDate } from '../domain/dates';
import { isInRange } from '../domain/tempInput';
import {
  BLEEDING,
  DISTURBANCE,
  INTENTION,
  INTERCOURSE,
  MARKER,
  MUCUS_FEATURE,
  MUCUS_MARK,
  MUCUS_QUALITY,
  SENSATION,
  SITE,
  SOURCE_IDS,
  SYMPTOM,
  TEMP_MARK,
  emptyDayRow,
  type CycleRow,
  type Dataset,
  type DayRow,
  type Entity,
  type SourceId,
  type SourceRow,
  type TempRow,
} from '../domain/types';

export interface ApplyResult {
  data: Dataset;
  rejected?: string;
}

type Row = Record<string, unknown>;
type Check = (value: unknown) => boolean;

const ENTITIES: readonly Entity[] = ['day', 'temp', 'cycle', 'source', 'setting'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COLOR = /^#[0-9a-f]{6}$/;
const CHART_NOTE_MAX = 30;

const isInt: Check = (v) => typeof v === 'number' && Number.isInteger(v);
const isBool: Check = (v) => typeof v === 'boolean';
const isText: Check = (v) => typeof v === 'string';
const isDateText: Check = (v) => typeof v === 'string' && isDate(v);
const isColor: Check = (v) => typeof v === 'string' && COLOR.test(v);
const isChartNote: Check = (v) => typeof v === 'string' && [...v].length <= CHART_NOTE_MAX;
const atLeastOne: Check = (v) => isInt(v) && (v as number) >= 1;

const optional =
  (check: Check): Check =>
  (v) =>
    v === null || check(v);

const oneOf =
  (codes: readonly string[]): Check =>
  (v) =>
    typeof v === 'string' && codes.includes(v);

// Code arrays: non-empty, in spec 2.4 order, no repeats.
const inOrder =
  (codes: readonly string[]): Check =>
  (v) => {
    if (!Array.isArray(v) || v.length === 0) return false;
    const positions = v.map((item) => codes.indexOf(item as string));
    return positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]));
  };

const DAY_RULES: Record<string, Check> = {
  bleeding: optional(oneOf(BLEEDING)),
  mucus_sensation: optional(oneOf(SENSATION)),
  mucus_features: optional(inOrder(MUCUS_FEATURE)),
  mucus_atypical: optional(isBool),
  mucus_quality_override: optional(oneOf(MUCUS_QUALITY)),
  symptoms: optional(inOrder(SYMPTOM)),
  intercourse: optional(inOrder(INTERCOURSE)),
  disturbances: optional(inOrder(DISTURBANCE)),
  chart_note: optional(isChartNote),
  mark_mucus: optional(oneOf(MUCUS_MARK)),
  notes: optional(isText),
};

const TEMP_RULES: Record<string, Check> = {
  value: isInt,
  excluded: isBool,
  mark: optional(oneOf(TEMP_MARK)),
};

const CYCLE_RULES: Record<string, Check> = {
  start_date: isDateText,
  end_date: optional(isDateText),
  excluded_from_stats: isBool,
  intention: optional(oneOf(INTENTION)),
  first_mucus_day: optional(isDateText),
  first_hf_mucus_day: optional(isDateText),
  coverline_1: optional(isInt),
  coverline_2: optional(isInt),
  fertile_start: optional(isDateText),
  fertile_end: optional(isDateText),
  prev_cycle_rise: optional(isBool),
  notes: optional(isText),
};

const SOURCE_RULES: Record<string, Check> = {
  name: isText,
  site: oneOf(SITE),
  color: isColor,
  marker: oneOf(MARKER),
  range_min: isInt,
  range_max: isInt,
};

const SETTING_RULES: Record<string, Check> = {
  default_intention: optional(oneOf(INTENTION)),
  cycle_number_start: atLeastOne,
  stats_n: atLeastOne,
};

const BLANK_CYCLE: Row = {
  start_date: null,
  end_date: null,
  excluded_from_stats: false,
  intention: null,
  first_mucus_day: null,
  first_hf_mucus_day: null,
  coverline_1: null,
  coverline_2: null,
  fertile_start: null,
  fertile_end: null,
  prev_cycle_rise: null,
  notes: null,
};

const BLANK_TEMP: Row = { value: null, excluded: false, mark: null };

interface ParsedOp {
  entity: Entity;
  key: string;
  set: Row | null;
}

export function applyOp(data: Dataset, op: unknown): ApplyResult {
  const parsed = parseOp(op);
  if (typeof parsed === 'string') return reject(data, parsed);
  const keyProblem = keyError(parsed.entity, parsed.key);
  if (keyProblem) return reject(data, keyProblem);
  if (parsed.set === null) return deleteRow(data, parsed.entity, parsed.key);
  return setRow(data, parsed.entity, parsed.key, parsed.set);
}

function reject(data: Dataset, error: string): ApplyResult {
  return { data, rejected: error };
}

function parseOp(op: unknown): ParsedOp | string {
  if (typeof op !== 'object' || op === null || Array.isArray(op)) return 'op: must be an object';
  const { entity, key, set, delete: remove, ...extra } = op as Row;
  if (Object.keys(extra).length > 0) return 'op: unknown property';
  if (!ENTITIES.includes(entity as Entity)) return 'entity: unknown';
  if (typeof key !== 'string') return 'key: must be a string';
  const hasSet = set !== undefined;
  const hasDelete = remove !== undefined;
  if (hasSet === hasDelete) return 'op: needs either set or delete: true';
  if (hasDelete) {
    if (remove !== true) return 'delete: must be true';
    if (entity === 'source' || entity === 'setting') return `${entity}: cannot be deleted`;
    return { entity: entity as Entity, key, set: null };
  }
  if (typeof set !== 'object' || set === null || Array.isArray(set) || Object.keys(set).length === 0) {
    return 'set: must be a non-empty object';
  }
  return { entity: entity as Entity, key, set: set as Row };
}

function keyError(entity: Entity, key: string): string | null {
  switch (entity) {
    case 'day':
      return isDate(key) ? null : 'key: must be a YYYY-MM-DD date';
    case 'temp': {
      const [date, source, ...rest] = key.split('/');
      const valid = isDate(date) && (source === '1' || source === '2') && rest.length === 0;
      return valid ? null : 'key: must be <date>/1 or <date>/2';
    }
    case 'cycle':
      return UUID.test(key) ? null : 'key: must be a lowercase UUID';
    case 'source':
      return key === '1' || key === '2' ? null : 'key: must be 1 or 2';
    case 'setting':
      return Object.hasOwn(SETTING_RULES, key) ? null : 'key: unknown setting';
  }
}

function deleteRow(data: Dataset, entity: Entity, key: string): ApplyResult {
  if (entity === 'day') return { data: { ...data, days: without(data.days, key) } };
  if (entity === 'cycle') return { data: { ...data, cycles: without(data.cycles, key) } };
  return { data: { ...data, temps: without(data.temps, key) } };
}

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...map };
  delete copy[key];
  return copy;
}

function setRow(data: Dataset, entity: Entity, key: string, set: Row): ApplyResult {
  if (entity === 'setting') return setSetting(data, key, set);
  if (entity === 'day') return setDay(data, key, set);
  if (entity === 'temp') return setTemp(data, key, set);
  if (entity === 'cycle') return setCycle(data, key, set);
  return setSource(data, key, set);
}

function merge(blank: object, current: object | undefined, set: Row): Row {
  return { ...blank, ...current, ...set };
}

function rowError(row: Row, rules: Record<string, Check>, crossCheck: () => string | null): string | null {
  return unknownField(row, rules) ?? fieldError(row, rules) ?? crossCheck();
}

function unknownField(row: Row, rules: Record<string, Check>): string | null {
  const field = Object.keys(row).find((name) => !Object.hasOwn(rules, name));
  return field ? `${field}: unknown field` : null;
}

function fieldError(row: Row, rules: Record<string, Check>): string | null {
  const field = Object.keys(rules).find((name) => !rules[name](row[name]));
  return field ? `${field}: invalid` : null;
}

const noCross = (): string | null => null;

function setDay(data: Dataset, key: string, set: Row): ApplyResult {
  const row = merge(emptyDayRow(), data.days[key], set);
  const error = rowError(row, DAY_RULES, noCross);
  if (error) return reject(data, error);
  return { data: { ...data, days: { ...data.days, [key]: row as unknown as DayRow } } };
}

function setTemp(data: Dataset, key: string, set: Row): ApplyResult {
  const row = merge(BLANK_TEMP, data.temps[key], set);
  const [, source] = key.split('/') as [string, SourceId];
  const error = rowError(row, TEMP_RULES, () => {
    if (row.excluded === true && row.mark !== null) {
      return 'mark: not allowed on an excluded reading';
    }
    return isInRange(data.sources[source], row.value as number)
      ? null
      : `value: outside the range of source ${source}`;
  });
  if (error) return reject(data, error);
  return { data: { ...data, temps: { ...data.temps, [key]: row as unknown as TempRow } } };
}

function setCycle(data: Dataset, key: string, set: Row): ApplyResult {
  const row = merge(BLANK_CYCLE, data.cycles[key], set);
  const error = rowError(row, CYCLE_RULES, () => cycleCrossError(data, key, row));
  if (error) return reject(data, error);
  return { data: { ...data, cycles: { ...data.cycles, [key]: row as unknown as CycleRow } } };
}

function cycleCrossError(data: Dataset, key: string, row: Row): string | null {
  const start = row.start_date as string;
  const end = row.end_date as string | null;
  const fertileStart = row.fertile_start as string | null;
  const fertileEnd = row.fertile_end as string | null;
  if (end !== null && end < start) return 'end_date: before start_date';
  if (fertileStart !== null && fertileEnd !== null && fertileEnd < fertileStart) {
    return 'fertile_end: before fertile_start';
  }
  const taken = Object.entries(data.cycles).some(
    ([other, cycle]) => other !== key && cycle.start_date === start,
  );
  if (taken) return 'start_date: already used by another cycle';
  for (const source of SOURCE_IDS) {
    const value = row[`coverline_${source}`] as number | null;
    if (value !== null && !isInRange(data.sources[source], value)) {
      return `coverline_${source}: outside the range of source ${source}`;
    }
  }
  return null;
}

function setSetting(data: Dataset, key: string, set: Row): ApplyResult {
  const fields = Object.keys(set);
  if (fields.length !== 1 || fields[0] !== 'value') return reject(data, 'setting: set only value');
  if (!SETTING_RULES[key](set.value)) return reject(data, 'value: invalid');
  return { data: { ...data, settings: { ...data.settings, [key]: set.value } } };
}

function setSource(data: Dataset, key: string, set: Row): ApplyResult {
  const row = merge({}, data.sources[key as SourceId], set);
  const error = rowError(row, SOURCE_RULES, () =>
    (row.range_min as number) < (row.range_max as number) ? null : 'range_min: must be below range_max',
  );
  if (error) return reject(data, error);
  return { data: { ...data, sources: { ...data.sources, [key]: row as unknown as SourceRow } } };
}
