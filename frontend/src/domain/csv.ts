import { type Cycle, cycleAt } from './cycles';
import { mucusQuality } from './derive';
import { formatHundredths } from './tempInput';
import {
  DISTURBANCE,
  INTERCOURSE,
  MUCUS_FEATURE,
  SOURCE_IDS,
  SYMPTOM,
  type DayRow,
  type Dataset,
  type SourceId,
  type TempRow,
} from './types';

export type CsvLang = 'pl' | 'en';

interface RowContext {
  date: string;
  day: DayRow | undefined;
  temps: Partial<Record<SourceId, TempRow>>;
  cycle: { cycle: Cycle; day: number } | null;
}

interface Column {
  title: string;
  value: (row: RowContext) => string;
}

export function buildCsv(
  data: Dataset,
  cycles: Cycle[],
  lang: CsvLang,
  label: (key: string) => string,
  sourceName: (source: SourceId) => string,
): string {
  const separator = lang === 'pl' ? ';' : ',';
  const decimal = lang === 'pl' ? ',' : '.';
  const columns = buildColumns(label, sourceName, decimal);
  const lines = [
    columns.map((column) => column.title),
    ...recordedDates(data).map((date) =>
      columns.map((column) => column.value(rowContext(data, cycles, date))),
    ),
  ];
  const body = lines.map((cells) => cells.map((cell) => quote(cell, separator)).join(separator));
  return `\uFEFF${body.join('\r\n')}\r\n`;
}

function recordedDates(data: Dataset): string[] {
  const dates = new Set([
    ...Object.keys(data.days),
    ...Object.keys(data.temps).map((key) => key.slice(0, 10)),
  ]);
  return [...dates].sort();
}

function rowContext(data: Dataset, cycles: Cycle[], date: string): RowContext {
  return {
    date,
    day: data.days[date],
    temps: {
      '1': data.temps[`${date}/1`],
      '2': data.temps[`${date}/2`],
    },
    cycle: cycleAt(cycles, date),
  };
}

function buildColumns(
  label: (key: string) => string,
  sourceName: (source: SourceId) => string,
  decimal: string,
): Column[] {
  return [
    { title: label('csv.date'), value: (r) => r.date },
    { title: label('csv.cycleNumber'), value: (r) => (r.cycle ? String(r.cycle.cycle.number) : '') },
    { title: label('csv.cycleDay'), value: (r) => (r.cycle ? String(r.cycle.day) : '') },
    ...SOURCE_IDS.flatMap((source) => sourceColumns(source, label, sourceName, decimal)),
    { title: label('csv.bleeding'), value: (r) => enumText(r.day?.bleeding, label, 'bleeding') },
    {
      title: label('csv.sensation'),
      value: (r) => enumText(r.day?.mucus_sensation, label, 'sensation'),
    },
    ...MUCUS_FEATURE.map((feature) =>
      flagColumn(label(`codes.mucus_feature.${feature}`), (day) =>
        (day.mucus_features ?? []).includes(feature),
      ),
    ),
    {
      title: label('csv.atypical'),
      value: (r) => boolText(r.day?.mucus_atypical),
    },
    {
      title: label('csv.mucusQuality'),
      value: (r) => enumText(mucusQuality(r.day), label, 'mucus_quality'),
    },
    ...SYMPTOM.map((symptom) =>
      flagColumn(label(`codes.symptom.${symptom}`), (day) =>
        (day.symptoms ?? []).includes(symptom),
      ),
    ),
    ...INTERCOURSE.map((moment) =>
      flagColumn(label(`codes.intercourse.${moment}`), (day) =>
        (day.intercourse ?? []).includes(moment),
      ),
    ),
    ...DISTURBANCE.map((disturbance) =>
      flagColumn(label(`codes.disturbance.${disturbance}`), (day) =>
        (day.disturbances ?? []).includes(disturbance),
      ),
    ),
    { title: label('csv.mucusMark'), value: (r) => r.day?.mark_mucus ?? '' },
    { title: label('csv.chartNote'), value: (r) => r.day?.chart_note ?? '' },
    { title: label('csv.notes'), value: (r) => r.day?.notes ?? '' },
  ];
}

function sourceColumns(
  source: SourceId,
  label: (key: string) => string,
  sourceName: (source: SourceId) => string,
  decimal: string,
): Column[] {
  const name = sourceName(source);
  return [
    {
      title: `${label('csv.temperature')} ${name}`,
      value: (r) => {
        const reading = r.temps[source];
        return reading ? formatHundredths(reading.value, decimal) : '';
      },
    },
    {
      title: `${label('csv.excluded')} ${name}`,
      value: (r) => {
        const reading = r.temps[source];
        return reading ? (reading.excluded ? '1' : '0') : '';
      },
    },
    {
      title: `${label('csv.mark')} ${name}`,
      value: (r) => r.temps[source]?.mark ?? '',
    },
  ];
}

function enumText(
  value: string | null | undefined,
  label: (key: string) => string,
  group: string,
): string {
  return value ? label(`codes.${group}.${value}`) : '';
}

function boolText(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value ? '1' : '0';
}

function flagText(day: DayRow | undefined, read: (day: DayRow) => boolean): string {
  return day ? boolText(read(day)) : '';
}

// A blank cell means no day row. A 0 means the day was recorded without this value.
function flagColumn(title: string, has: (day: DayRow) => boolean): Column {
  return { title, value: (r) => flagText(r.day, has) };
}

function quote(cell: string, separator: string): string {
  if (cell.includes(separator) || /["\r\n]/.test(cell)) {
    return `"${cell.replaceAll('"', '""')}"`;
  }
  return cell;
}
