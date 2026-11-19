import { describe, expect, it } from 'vitest';
import fixtures from '../../../fixtures/ops.cases.json';
import { seedDataset, type Dataset } from '../domain/types';
import { applyOp } from './apply';

type Maps = Omit<Dataset, 'version'>;

function datasetFrom(maps: Partial<Maps>): Dataset {
  return { ...seedDataset(), ...maps } as Dataset;
}

describe('applyOp matches the backend on every ops case', () => {
  it('starts from the same seed as the server', () => {
    expect(seedDataset()).toEqual({ version: '', ...fixtures.seed });
  });

  it.each(fixtures.cases.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const start = datasetFrom({ ...(fixtures.seed as Maps), ...(testCase.before as Partial<Maps>) });
    const rejected: number[] = [];
    let data = start;
    testCase.ops.forEach((op, index) => {
      const result = applyOp(data, op);
      if (result.rejected) rejected.push(index);
      data = result.data;
    });
    expect(rejected).toEqual(testCase.rejected);
    expect(data).toEqual(datasetFrom({ ...(fixtures.seed as Maps), ...(testCase.before as Partial<Maps>), ...(testCase.after as Partial<Maps>) }));
  });
});

describe('applyOp', () => {
  const data = datasetFrom({});

  it('never mutates the input', () => {
    const before = JSON.stringify(data);
    applyOp(data, { entity: 'day', key: '2026-11-18', set: { notes: 'a' } });
    expect(JSON.stringify(data)).toBe(before);
  });

  it('names the failing field without echoing the value', () => {
    const result = applyOp(data, { entity: 'day', key: '2026-11-18', set: { bleeding: 'heavy_flow' } });
    expect(result.rejected).toBe('bleeding: invalid');
  });

  it('reads the source range at apply time', () => {
    const narrowed = applyOp(data, { entity: 'source', key: '1', set: { range_min: 3600 } }).data;
    const result = applyOp(narrowed, { entity: 'temp', key: '2026-11-18/1', set: { value: 3560 } });
    expect(result.rejected).toBe('value: outside the range of source 1');
  });
});
