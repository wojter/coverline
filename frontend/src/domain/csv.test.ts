import { describe, expect, it } from 'vitest';
import { buildCycles } from './cycles';
import { buildCsv } from './csv';
import { cycle, day, makeData, reading } from './__fixtures__/builders';

const A = 'a0000000-0000-4000-8000-000000000001';

const data = makeData({
  cycles: { [A]: cycle('2026-06-01') },
  days: {
    '2026-06-01': day({ bleeding: 'heavy', mucus_features: ['cloudy', 'clear'], notes: 'morning' }),
  },
  temps: {
    '2026-06-02/1': reading(3645, { mark: '1' }),
    '2026-06-02/2': reading(3610, { excluded: true }),
  },
});

const labels: Record<string, string> = {
  'csv.date': 'Data',
  'csv.temperature': 'Temperatura',
  'csv.excluded': 'Pominięty',
  'csv.mark': 'Oznaczenie',
  'csv.cycleNumber': 'Cykl nr',
  'csv.cycleDay': 'Dzień cyklu',
  'csv.bleeding': 'Krwawienie',
  'codes.mucus_feature.cloudy': 'Mętny',
  'codes.mucus_feature.clear': 'Przejrzysty',
  'codes.bleeding.heavy': 'Obfite',
};
const label = (key: string) => labels[key] ?? key;
const sourceName = (s: '1' | '2') => (s === '1' ? 'Usta X' : 'Pomiar 2');

function rows(csv: string, separator: string): string[][] {
  return csv
    .slice(1)
    .trimEnd()
    .split('\r\n')
    .slice(1)
    .map((line) => line.split(separator));
}

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM, ends with CRLF and uses Polish separators and decimals in PL', () => {
    const csv = buildCsv(data, buildCycles(data), 'pl', label, sourceName);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).toContain('36,45');
    expect(rows(csv, ';')[0].slice(0, 3)).toEqual(['2026-06-01', '1', '1']);
  });

  it('uses comma separators and decimal points in EN', () => {
    const csv = buildCsv(data, buildCycles(data), 'en', label, sourceName);
    expect(csv).toContain('36.45');
    expect(rows(csv, ',')[1].slice(0, 3)).toEqual(['2026-06-02', '1', '2']);
  });

  it('puts the source name in the temperature headers', () => {
    const csv = buildCsv(data, buildCycles(data), 'en', label, sourceName);
    const header = csv.slice(1).split('\r\n')[0].split(',');
    expect(header[3]).toBe('Temperatura Usta X');
    expect(header[6]).toBe('Temperatura Pomiar 2');
  });

  it('splits multi-select values into 0/1 columns and leaves days without a row blank', () => {
    const csv = buildCsv(data, buildCycles(data), 'en', label, sourceName);
    const header = csv.slice(1).split('\r\n')[0].split(',');
    const [first, second] = rows(csv, ',');
    const cloudy = header.indexOf('Mętny');
    const clear = header.indexOf('Przejrzysty');
    expect(first[cloudy]).toBe('1');
    expect(first[clear]).toBe('1');
    expect(second[cloudy]).toBe('');
  });

  it('labels bleeding with its translation and writes excluded readings as 1', () => {
    const csv = buildCsv(data, buildCycles(data), 'en', label, sourceName);
    const header = csv.slice(1).split('\r\n')[0].split(',');
    const [first, second] = rows(csv, ',');
    expect(first[header.indexOf('Krwawienie')]).toBe('Obfite');
    expect(second[header.indexOf('Pominięty Pomiar 2')]).toBe('1');
  });

  it('quotes fields that contain the separator, quotes or line breaks', () => {
    const quoted = makeData({
      cycles: { [A]: cycle('2026-06-01') },
      days: { '2026-06-01': day({ notes: 'say "hi", next\nline' }) },
    });
    const csv = buildCsv(quoted, buildCycles(quoted), 'en', label, sourceName);
    expect(csv).toContain('"say ""hi"", next\nline"');
  });
});
