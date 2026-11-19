// Spec 7 acceptance: every value in cycles3.ts is worked out by hand and must match.
import { describe, expect, it } from 'vitest';
import { buildCycles, cycleAt } from './cycles';
import { cycleTotals, cycleSummary, ringAverage, sourceEvaluations } from './stats';
import { dataset, expected, today } from './__fixtures__/cycles3';
import type { Dataset } from './types';

const data = dataset as unknown as Dataset;
const cycles = buildCycles(data);

describe('acceptance: cycles3', () => {
  it.each(expected.cycles.map((e) => [e.number, e] as const))('cycle %i', (_number, exp) => {
    const cycle = cycles.find((c) => c.id === exp.id);
    expect(cycle).toBeDefined();
    if (!cycle) return;
    const { id, number, start, end, completed, ...summaryFields } = exp;
    expect({ id: cycle.id, number: cycle.number, start: cycle.start, end: cycle.end, completed: cycle.completed }).toEqual({
      id,
      number,
      start,
      end,
      completed,
    });
    expect(cycleSummary(data, cycles, cycle, today)).toMatchObject(summaryFields);
  });

  it('totals and ring average over completed, non-excluded cycles', () => {
    expect(cycleTotals(cycles)).toEqual(expected.totals);
    expect(ringAverage(cycles)).toBe(expected.ringAverage);
  });

  it('places each date in its cycle, or in no cycle', () => {
    for (const [date, hit] of Object.entries(expected.cycleOf)) {
      const found = cycleAt(cycles, date);
      expect(found ? { id: found.cycle.id, day: found.day } : null, date).toEqual(hit);
    }
  });

  it('evaluates each source over completed, non-excluded cycles', () => {
    const evaluations = sourceEvaluations(data, cycles);
    expect(evaluations[1]).toMatchObject(expected.sources[1]);
    expect(evaluations[2]).toMatchObject(expected.sources[2]);
  });
});
