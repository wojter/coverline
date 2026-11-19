import { type CycleRow, type Dataset, type DayRow, type TempRow, emptyDayRow, seedDataset } from '../types';

type PartialDataset = Partial<Omit<Dataset, 'settings'>> & { settings?: Partial<Dataset['settings']> };

export function makeData(partial: PartialDataset = {}): Dataset {
  const seed = seedDataset();
  return {
    ...seed,
    ...partial,
    settings: { ...seed.settings, ...partial.settings },
  };
}

export function day(fields: Partial<DayRow> = {}): DayRow {
  return { ...emptyDayRow(), ...fields };
}

export function reading(value: number, fields: Partial<TempRow> = {}): TempRow {
  return { value, excluded: false, mark: null, ...fields };
}

export function cycle(start: string, fields: Partial<CycleRow> = {}): CycleRow {
  return {
    start_date: start,
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
    ...fields,
  };
}
