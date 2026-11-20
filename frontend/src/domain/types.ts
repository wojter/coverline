// Wire types mirror architecture 5.1 and spec 2.4.

export const BLEEDING = ['bleeding', 'staining', 'spotting'] as const;
export const SENSATION = ['dry', 'moist', 'wet'] as const;
export const MUCUS_FEATURE = ['cloudy', 'sticky', 'clear', 'stretchy'] as const;
export const MUCUS_QUALITY = ['none', 'less_fertile', 'highly_fertile'] as const;
export const SYMPTOM = ['ovulation_pain', 'breast_tension'] as const;
export const DISTURBANCE = [
  'alcohol',
  'short_sleep',
  'late_measurement',
  'illness',
  'stress',
  'travel',
] as const;
export const INTERCOURSE = ['morning', 'evening'] as const;
export const INTENTION = ['avoid', 'conceive'] as const;
export const SITE = ['oral', 'vaginal', 'rectal', 'finger', 'wrist', 'other'] as const;
export const MARKER = ['circle', 'square', 'triangle', 'diamond'] as const;
export const MUCUS_MARK = ['P', '1', '2', '3'] as const;
export const TEMP_MARK = ['1', '2', '3', '4'] as const;

export type Bleeding = (typeof BLEEDING)[number];
export type Sensation = (typeof SENSATION)[number];
export type MucusFeature = (typeof MUCUS_FEATURE)[number];
export type MucusQuality = (typeof MUCUS_QUALITY)[number];
export type Symptom = (typeof SYMPTOM)[number];
export type Disturbance = (typeof DISTURBANCE)[number];
export type Intercourse = (typeof INTERCOURSE)[number];
export type Intention = (typeof INTENTION)[number];
export type Site = (typeof SITE)[number];
export type Marker = (typeof MARKER)[number];
export type MucusMark = (typeof MUCUS_MARK)[number];
export type TempMark = (typeof TEMP_MARK)[number];

export type SourceId = '1' | '2';
export const SOURCE_IDS: readonly SourceId[] = ['1', '2'];

export interface SourceRow {
  name: string;
  site: Site;
  color: string;
  marker: Marker;
  range_min: number;
  range_max: number;
}

export interface CycleRow {
  start_date: string;
  end_date: string | null;
  excluded_from_stats: boolean;
  intention: Intention | null;
  first_mucus_day: string | null;
  first_hf_mucus_day: string | null;
  coverline_1: number | null;
  coverline_2: number | null;
  fertile_start: string | null;
  fertile_end: string | null;
  prev_cycle_rise: boolean | null;
  notes: string | null;
}

export interface DayRow {
  bleeding: Bleeding | null;
  mucus_sensation: Sensation | null;
  mucus_features: MucusFeature[] | null;
  mucus_atypical: boolean | null;
  mucus_quality_override: MucusQuality | null;
  symptoms: Symptom[] | null;
  intercourse: Intercourse[] | null;
  disturbances: Disturbance[] | null;
  chart_note: string | null;
  mark_mucus: MucusMark | null;
  notes: string | null;
}

export interface TempRow {
  value: number;
  excluded: boolean;
  mark: TempMark | null;
}

export interface Settings {
  default_intention: Intention | null;
  cycle_number_start: number;
  stats_n: number;
}

export interface Dataset {
  version: string;
  sources: Record<SourceId, SourceRow>;
  cycles: Record<string, CycleRow>;
  days: Record<string, DayRow>;
  temps: Record<string, TempRow>;
  settings: Settings;
}

export type Entity = 'day' | 'temp' | 'cycle' | 'source' | 'setting';

export interface SetOp {
  entity: Entity;
  key: string;
  set: Record<string, unknown>;
}

export interface DeleteOp {
  entity: Entity;
  key: string;
  delete: true;
}

export type Op = SetOp | DeleteOp;

export function emptyDayRow(): DayRow {
  return {
    bleeding: null,
    mucus_sensation: null,
    mucus_features: null,
    mucus_atypical: null,
    mucus_quality_override: null,
    symptoms: null,
    intercourse: null,
    disturbances: null,
    chart_note: null,
    mark_mucus: null,
    notes: null,
  };
}

export function seedDataset(): Dataset {
  return {
    version: '',
    sources: {
      '1': { name: '', site: 'oral', color: '#2563eb', marker: 'circle', range_min: 3550, range_max: 3800 },
      '2': { name: '', site: 'oral', color: '#d97706', marker: 'square', range_min: 3550, range_max: 3800 },
    },
    cycles: {},
    days: {},
    temps: {},
    settings: { default_intention: null, cycle_number_start: 1, stats_n: 12 },
  };
}
