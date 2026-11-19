import { describe, expect, it } from 'vitest';
import { buildCycles } from './cycles';
import { cycle, day, makeData, reading } from './__fixtures__/builders';
import {
  assignMarkOps,
  clearReadingOp,
  excludeReadingOp,
  lutealLength,
  markWarnings,
  mucusPeak,
  removeMarkOps,
  thirdHighDay,
} from './marks';

const A = 'a0000000-0000-4000-8000-000000000001';

const data = makeData({
  cycles: { [A]: cycle('2026-06-01') },
  days: {
    '2026-06-10': day({ mark_mucus: 'P' }),
    '2026-06-12': day({ mark_mucus: '1' }),
    '2026-06-14': day({ mark_mucus: '1' }),
  },
  temps: {
    '2026-06-02/1': reading(3600, { mark: '1' }),
    '2026-06-05/1': reading(3650, { mark: '3' }),
    '2026-06-06/1': reading(3640, { mark: '2' }),
    '2026-06-07/1': reading(3700, { excluded: true }),
    '2026-06-08/1': reading(3640, { mark: '1' }),
  },
});
const cycles = buildCycles(data);
const cur = cycles[0];

describe('assignMarkOps', () => {
  it('moves a mucus mark from its previous day in the cycle', () => {
    expect(assignMarkOps(data, cycles, 'mucus', '2026-06-20', 'P')).toEqual([
      { entity: 'day', key: '2026-06-10', set: { mark_mucus: null } },
      { entity: 'day', key: '2026-06-20', set: { mark_mucus: 'P' } },
    ]);
  });

  it('needs a non-excluded reading for a temperature track', () => {
    expect(assignMarkOps(data, cycles, '1', '2026-06-09', '1')).toEqual({ error: 'no-reading' });
    expect(assignMarkOps(data, cycles, '1', '2026-06-07', '1')).toEqual({ error: 'no-reading' });
  });

  it('moves a temperature mark within the source track only', () => {
    expect(assignMarkOps(data, cycles, '1', '2026-06-08', '3')).toEqual([
      { entity: 'temp', key: '2026-06-05/1', set: { mark: null } },
      { entity: 'temp', key: '2026-06-08/1', set: { mark: '3' } },
    ]);
  });

  it('removes a mark with a null set', () => {
    expect(removeMarkOps('2', '2026-06-06')).toEqual([
      { entity: 'temp', key: '2026-06-06/2', set: { mark: null } },
    ]);
  });
});

describe('reading operations', () => {
  it('clears the mark when excluding', () => {
    expect(excludeReadingOp('2026-06-05', '1', true)).toEqual({
      entity: 'temp',
      key: '2026-06-05/1',
      set: { excluded: true, mark: null },
    });
    expect(excludeReadingOp('2026-06-05', '1', false)).toEqual({
      entity: 'temp',
      key: '2026-06-05/1',
      set: { excluded: false },
    });
  });

  it('deletes the row when clearing (D8)', () => {
    expect(clearReadingOp('2026-06-05', '1')).toEqual({
      entity: 'temp',
      key: '2026-06-05/1',
      delete: true,
    });
  });
});

describe('derived marks', () => {
  it('finds the peak, the third high day and the luteal length', () => {
    expect(mucusPeak(data, cur)).toBe('2026-06-10');
    expect(thirdHighDay(data, cur, '1')).toBe('2026-06-05');
    expect(thirdHighDay(data, cur, '2')).toBeNull();
    expect(lutealLength(data, cur, '1')).toBeNull();
  });

  it('uses the earliest day when a mark is duplicated', () => {
    const duplicated = makeData({
      cycles: { [A]: cycle('2026-06-01', { end_date: '2026-06-30' }) },
      temps: {
        '2026-06-20/1': reading(3650, { mark: '3' }),
        '2026-06-22/1': reading(3650, { mark: '3' }),
        '2026-06-18/1': reading(3650, { mark: '1' }),
      },
    });
    const [done] = buildCycles(duplicated);
    expect(thirdHighDay(duplicated, done, '1')).toBe('2026-06-20');
    expect(lutealLength(duplicated, done, '1')).toBe(13);
  });
});

describe('markWarnings', () => {
  it('warns about duplicates and marks out of date order', () => {
    const messy = makeData({
      cycles: { [A]: cycle('2026-06-01') },
      days: {
        '2026-06-10': day({ mark_mucus: '1' }),
        '2026-06-11': day({ mark_mucus: 'P' }),
        '2026-06-12': day({ mark_mucus: '1' }),
      },
    });
    const warnings = markWarnings(messy, buildCycles(messy)[0]);
    expect(warnings).toEqual([
      { track: 'mucus', kind: 'duplicate', value: '1' },
      { track: 'mucus', kind: 'order' },
    ]);
  });

  it('is quiet for a clean track', () => {
    const clean = makeData({
      cycles: { [A]: cycle('2026-06-01') },
      days: {
        '2026-06-10': day({ mark_mucus: 'P' }),
        '2026-06-12': day({ mark_mucus: '1' }),
        '2026-06-14': day({ mark_mucus: '2' }),
      },
    });
    expect(markWarnings(clean, buildCycles(clean)[0])).toEqual([]);
  });
});
