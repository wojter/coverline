import { describe, expect, it } from 'vitest';
import {
  buildCycles,
  cycleAt,
  cycleLength,
  datesOutsideCycle,
  day1Check,
  moveStartOps,
  removeStartOps,
  setEndDateOps,
  startCycleOps,
} from './cycles';
import { cycle, makeData } from './__fixtures__/builders';

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const C = 'c0000000-0000-4000-8000-000000000003';
const NEW = 'd0000000-0000-4000-8000-000000000004';

describe('buildCycles', () => {
  it('ends a cycle the day before the next start and numbers from the setting', () => {
    const data = makeData({
      settings: { cycle_number_start: 5 },
      cycles: { [B]: cycle('2026-07-01'), [A]: cycle('2026-06-01') },
    });
    const [first, second] = buildCycles(data);
    expect(first).toMatchObject({ id: A, number: 5, end: '2026-06-30', completed: true });
    expect(second).toMatchObject({ id: B, number: 6, end: null, completed: false });
  });

  it('takes the earlier of end_date and the day before the next start', () => {
    const data = makeData({
      cycles: { [A]: cycle('2026-06-01', { end_date: '2026-06-10' }), [B]: cycle('2026-06-20') },
    });
    expect(buildCycles(data)[0].end).toBe('2026-06-10');
    const later = makeData({
      cycles: { [A]: cycle('2026-06-01', { end_date: '2026-06-25' }), [B]: cycle('2026-06-20') },
    });
    expect(buildCycles(later)[0].end).toBe('2026-06-19');
  });
});

describe('cycleAt and cycleLength', () => {
  const data = makeData({
    cycles: { [A]: cycle('2026-06-01', { end_date: '2026-06-10' }), [B]: cycle('2026-06-20') },
  });
  const cycles = buildCycles(data);

  it('finds the cycle day and returns null in a break', () => {
    expect(cycleAt(cycles, '2026-06-01')).toMatchObject({ day: 1 });
    expect(cycleAt(cycles, '2026-06-10')).toMatchObject({ day: 10 });
    expect(cycleAt(cycles, '2026-06-15')).toBeNull();
    expect(cycleAt(cycles, '2026-06-20')).toMatchObject({ day: 1 });
  });

  it('gives the length of completed cycles and the current day for open ones', () => {
    expect(cycleLength(cycles[0], '2026-07-01')).toBe(10);
    expect(cycleLength(cycles[1], '2026-06-25')).toBe(6);
  });
});

describe('Cycle day 1', () => {
  const data = makeData({ cycles: { [A]: cycle('2026-06-01') } });

  it('does nothing on an existing start', () => {
    expect(day1Check(data, '2026-06-01')).toEqual({ kind: 'none' });
  });

  it('asks on days 2 to 7 of a cycle', () => {
    expect(day1Check(data, '2026-06-03')).toEqual({ kind: 'ask', cycleId: A });
    expect(day1Check(data, '2026-06-07')).toEqual({ kind: 'ask', cycleId: A });
  });

  it('starts a new cycle on day 8 or later', () => {
    expect(day1Check(data, '2026-06-08')).toEqual({ kind: 'new' });
  });

  it('gives a new cycle the end of the cycle it falls in', () => {
    const withEnd = makeData({
      settings: { default_intention: 'avoid' },
      cycles: { [A]: cycle('2026-06-01', { end_date: '2026-06-30' }) },
    });
    expect(startCycleOps(withEnd, '2026-06-15', NEW)).toEqual([
      {
        entity: 'cycle',
        key: NEW,
        set: { start_date: '2026-06-15', intention: 'avoid', end_date: '2026-06-30' },
      },
      { entity: 'cycle', key: A, set: { end_date: null } },
    ]);
  });

  it('starts a plain cycle without touching the one before', () => {
    expect(startCycleOps(data, '2026-06-15', NEW)).toEqual([
      { entity: 'cycle', key: NEW, set: { start_date: '2026-06-15', intention: null } },
    ]);
  });
});

describe('moving and removing starts', () => {
  const data = makeData({
    cycles: {
      [A]: cycle('2026-06-01', { end_date: '2026-06-05' }),
      [B]: cycle('2026-07-01'),
      [C]: cycle('2026-08-01', { end_date: '2026-08-20' }),
    },
  });

  it('moves a start within its neighbours and its own end', () => {
    expect(moveStartOps(data, B, '2026-06-06')).toEqual([
      { entity: 'cycle', key: B, set: { start_date: '2026-06-06' } },
    ]);
  });

  it('never moves a start onto or past a neighbour', () => {
    expect(moveStartOps(data, B, '2026-06-01')).toEqual({ error: 'neighbour' });
    expect(moveStartOps(data, B, '2026-08-01')).toEqual({ error: 'neighbour' });
  });

  it('never moves a start after its own end_date', () => {
    expect(moveStartOps(data, C, '2026-08-21')).toEqual({ error: 'after-end' });
  });

  it('removes a start and hands an end_date to the previous cycle', () => {
    expect(removeStartOps(data, C)).toEqual([
      { entity: 'cycle', key: C, delete: true },
      { entity: 'cycle', key: B, set: { end_date: '2026-08-20' } },
    ]);
  });

  it('removes a plain start with a single delete', () => {
    expect(removeStartOps(data, B)).toEqual([{ entity: 'cycle', key: B, delete: true }]);
  });

  it('sets the end date', () => {
    expect(setEndDateOps(B, '2026-07-20')).toEqual([
      { entity: 'cycle', key: B, set: { end_date: '2026-07-20' } },
    ]);
  });
});

describe('datesOutsideCycle', () => {
  it('flags 2.2 dates outside the cycle', () => {
    const data = makeData({
      cycles: {
        [A]: cycle('2026-06-10', {
          end_date: '2026-06-20',
          first_mucus_day: '2026-06-09',
          fertile_start: '2026-06-12',
          fertile_end: '2026-06-21',
        }),
      },
    });
    expect(datesOutsideCycle(buildCycles(data)[0])).toEqual(['first_mucus_day', 'fertile_end']);
  });
});
