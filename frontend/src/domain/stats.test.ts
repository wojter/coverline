import { describe, expect, it } from 'vitest';
import { buildCycles } from './cycles';
import { cycleTotals, sourceEvaluation } from './stats';
import { cycle, makeData, reading } from './__fixtures__/builders';

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';

describe('cycleTotals', () => {
  it('has no totals without completed cycles', () => {
    const data = makeData({ cycles: { [A]: cycle('2026-06-01') } });
    expect(cycleTotals(buildCycles(data))).toEqual({ count: 0, average: null, min: null, max: null });
  });

  it('averages the last N cycles when asked', () => {
    const data = makeData({
      cycles: {
        [A]: cycle('2026-06-01', { end_date: '2026-06-28' }),
        [B]: cycle('2026-06-29', { end_date: '2026-07-30' }),
      },
    });
    expect(cycleTotals(buildCycles(data), 1)).toEqual({ count: 1, average: 32, min: 32, max: 32 });
  });
});

describe('sourceEvaluation', () => {
  it('counts an excluded reading as a day with a reading', () => {
    const data = makeData({
      cycles: { [A]: cycle('2026-06-01', { end_date: '2026-06-04' }) },
      temps: {
        '2026-06-01/1': reading(3650),
        '2026-06-02/1': reading(3650, { excluded: true }),
      },
    });
    expect(sourceEvaluation(data, buildCycles(data), '1')).toMatchObject({
      daysWithReading: 2,
      excludedReadings: 1,
      missingDays: 2,
      completedCycles: 1,
    });
  });
});
