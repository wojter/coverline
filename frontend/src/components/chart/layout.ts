// Pure chart geometry. Sizes are provisional until spike S3 (decision D21).
import { daysInRange, today as todayDate } from '../../domain/dates';
import type { DayRow } from '../../domain/types';

export const CHART = {
  columnWidth: 26,
  labelWidth: 132,
  tempStep: 9,
  tempStepValue: 5,
  symbolRow: 18,
  minColumns: 40,
  defaultMin: 3600,
  defaultMax: 3730,
  noteFontSize: 12,
} as const;

export interface Reading {
  value: number;
  excluded: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface TempScale {
  min: number;
  max: number;
}

export interface RowBox {
  key: RowKey;
  y: number;
  height: number;
}

// Card order from spec F3.
export const ROW_KEYS = [
  'date',
  'temp',
  'cycleDay',
  'bleeding',
  'peak',
  'wet',
  'stretchy',
  'clear',
  'moist',
  'sticky',
  'cloudy',
  'dry',
  'atypical',
  'ovulationPain',
  'breastTension',
  'fertile',
  'morning',
  'evening',
  'disturbances',
] as const;
export type RowKey = (typeof ROW_KEYS)[number];

// Mucus rows in card order. Each matches one sensation or feature code.
export function mucusRowMatch(key: RowKey, day: DayRow): boolean {
  const features = day.mucus_features ?? [];
  switch (key) {
    case 'wet':
    case 'moist':
    case 'dry':
      return day.mucus_sensation === key;
    case 'stretchy':
    case 'clear':
    case 'sticky':
    case 'cloudy':
      return features.includes(key);
    default:
      return false;
  }
}

// Columns run from the cycle start to its end, or to today when open. At least minColumns.
export function chartDays(start: string, end: string | null, today: string): string[] {
  const last = [end ?? today, addDaysSafe(start, CHART.minColumns - 1)].sort().at(-1) ?? start;
  return daysInRange(start, last);
}

function addDaysSafe(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

// The default scale covers 36.00 to 37.30. It widens, in 0.05 steps, to fit every reading.
export function temperatureScale(values: number[]): TempScale {
  if (values.length === 0) return { min: CHART.defaultMin, max: CHART.defaultMax };
  const low = Math.min(...values);
  const high = Math.max(...values);
  return {
    min: Math.min(CHART.defaultMin, floorToStep(low)),
    max: Math.max(CHART.defaultMax, ceilToStep(high)),
  };
}

function floorToStep(value: number): number {
  return Math.floor(value / CHART.tempStepValue) * CHART.tempStepValue;
}

function ceilToStep(value: number): number {
  return Math.ceil(value / CHART.tempStepValue) * CHART.tempStepValue;
}

export function tempHeight(scale: TempScale): number {
  return ((scale.max - scale.min) / CHART.tempStepValue) * CHART.tempStep;
}

export function rowLayout(scale: TempScale): RowBox[] {
  let y = 0;
  return ROW_KEYS.map((key) => {
    const height = key === 'temp' ? tempHeight(scale) : CHART.symbolRow;
    const box = { key, y, height };
    y += height;
    return box;
  });
}

export function chartHeight(scale: TempScale): number {
  const rows = rowLayout(scale);
  const last = rows[rows.length - 1];
  return last.y + last.height;
}

// y of a temperature, measured from the top of the temperature row.
export function tempY(scale: TempScale, value: number): number {
  return ((scale.max - value) / CHART.tempStepValue) * CHART.tempStep;
}

// Inverse of tempY, rounded to the nearest 0.05 step, clamped to the scale.
export function valueAtY(scale: TempScale, y: number): number {
  const steps = Math.round(y / CHART.tempStep);
  const value = scale.max - steps * CHART.tempStepValue;
  return Math.min(scale.max, Math.max(scale.min, value));
}

// Tick lines at every 0.05 step. Labelled at every 0.10.
export function tempTicks(scale: TempScale): { value: number; labelled: boolean }[] {
  const ticks: { value: number; labelled: boolean }[] = [];
  for (let value = scale.max; value >= scale.min; value -= CHART.tempStepValue) {
    ticks.push({ value, labelled: value % 10 === 0 });
  }
  return ticks;
}

// Alternating shaded bands, like the paper card: the band from x.00 up to x.05 is shaded, x.05 up to x.10 is not.
// y is measured from the top of the temperature row.
export function tempBands(scale: TempScale): { y: number; height: number }[] {
  const bands: { y: number; height: number }[] = [];
  for (let low = scale.min; low < scale.max; low += CHART.tempStepValue) {
    if (low % 10 === 0) bands.push({ y: tempY(scale, low + CHART.tempStepValue), height: CHART.tempStep });
  }
  return bands;
}

export function columnCenter(index: number): number {
  return index * CHART.columnWidth + CHART.columnWidth / 2;
}

// Lines break on a day with no reading. Excluded readings are skipped, so the line joins their neighbours.
export function curveSegments(
  readings: (Reading | undefined)[],
  yOf: (value: number) => number,
): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] = [];
  readings.forEach((reading, index) => {
    if (!reading) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else if (!reading.excluded) {
      current.push({ x: columnCenter(index), y: yOf(reading.value) });
    }
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

// Shortens a comment to fit the grid height, with an ellipsis.
export function truncateNote(text: string, maxChars: number): string {
  const characters = [...text];
  if (characters.length <= maxChars) return text;
  return `${characters.slice(0, Math.max(0, maxChars - 1)).join('')}…`;
}

export function noteCharLimit(gridHeight: number): number {
  return Math.floor((gridHeight - 8) / (CHART.noteFontSize * 0.6));
}

export function todayColumn(columns: string[], today: string = todayDate()): number {
  return columns.indexOf(today);
}
