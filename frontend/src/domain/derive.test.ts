import { describe, expect, it } from 'vitest';
import { buildCycles } from './cycles';
import {
  computedPrevCycleRise,
  derivedMucusQuality,
  lastMenstruationDay,
  mucusQuality,
  suggestFirstHfMucusDay,
  suggestFirstMucusDay,
} from './derive';
import { cycle, day, makeData, reading } from './__fixtures__/builders';
import type { DayRow, MucusQuality } from './types';

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';

describe('derivedMucusQuality (S4.2)', () => {
  it.each<[Partial<DayRow>, MucusQuality | null]>([
    [{ mucus_sensation: 'wet' }, 'highly_fertile'],
    [{ mucus_sensation: 'dry', mucus_features: ['clear'] }, 'highly_fertile'],
    [{ mucus_sensation: 'moist' }, 'less_fertile'],
    [{ mucus_features: ['sticky'] }, 'less_fertile'],
    [{ mucus_sensation: 'dry' }, 'none'],
    [{ mucus_features: [] }, null],
    [{}, null],
  ])('%j gives %j', (fields, expected) => {
    expect(derivedMucusQuality(day(fields))).toBe(expected);
  });

  it('is null when nothing is recorded, and the override wins', () => {
    expect(derivedMucusQuality(undefined)).toBeNull();
    expect(mucusQuality(day({ mucus_sensation: 'dry', mucus_quality_override: 'highly_fertile' }))).toBe(
      'highly_fertile',
    );
  });
});

describe('lastMenstruationDay (S2.3)', () => {
  it('ends the run at the first day that is not bleeding', () => {
    const data = makeData({
      cycles: { [A]: cycle('2026-06-03') },
      days: {
        '2026-06-03': day({ bleeding: 'bleeding' }),
        '2026-06-04': day({ bleeding: 'bleeding' }),
        '2026-06-05': day({ bleeding: 'bleeding' }),
        '2026-06-06': day({ bleeding: 'staining' }),
        '2026-06-07': day({ bleeding: 'bleeding' }),
      },
    });
    expect(lastMenstruationDay(data, buildCycles(data)[0])).toBe('2026-06-05');
  });

  it('is null when day 1 is only spotting or staining', () => {
    const data = makeData({
      cycles: { [A]: cycle('2026-07-05') },
      days: { '2026-07-05': day({ bleeding: 'spotting' }), '2026-07-06': day({ bleeding: 'bleeding' }) },
    });
    expect(lastMenstruationDay(data, buildCycles(data)[0])).toBeNull();
  });
});

describe('suggestions', () => {
  const data = makeData({
    cycles: { [A]: cycle('2026-06-01') },
    days: {
      '2026-06-03': day({ mucus_sensation: 'moist' }),
      '2026-06-10': day({ mucus_sensation: 'wet' }),
      '2026-06-12': day({ mucus_sensation: 'dry' }),
    },
  });
  const cur = buildCycles(data)[0];

  it('suggests the first mucus day and the first highly fertile day', () => {
    expect(suggestFirstMucusDay(data, cur)).toBe('2026-06-03');
    expect(suggestFirstHfMucusDay(data, cur)).toBe('2026-06-10');
  });
});

describe('computedPrevCycleRise', () => {
  it('is null without a previous cycle', () => {
    const data = makeData({ cycles: { [A]: cycle('2026-06-01') } });
    expect(computedPrevCycleRise(data, buildCycles(data), buildCycles(data)[0])).toBeNull();
  });

  it('looks at a third high day in the previous cycle, excluded or not', () => {
    const data = makeData({
      cycles: {
        [A]: cycle('2026-06-01', { excluded_from_stats: true }),
        [B]: cycle('2026-07-01'),
      },
      temps: { '2026-06-20/2': reading(3650, { mark: '3' }) },
    });
    const cycles = buildCycles(data);
    expect(computedPrevCycleRise(data, cycles, cycles[1])).toBe(true);
    expect(computedPrevCycleRise(data, cycles, cycles[0])).toBeNull();
  });
});
