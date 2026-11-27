import { describe, expect, it } from 'vitest';
import { arcPath } from './CycleRing';

describe('arcPath', () => {
  it('draws a partial arc as one segment', () => {
    expect(arcPath(0, 0.25).match(/A /g)).toHaveLength(1);
  });

  it('draws a full ring as two half arcs so SVG renders it', () => {
    const d = arcPath(0, 1);
    expect(d.match(/A /g)).toHaveLength(2);
    expect(d).toContain('M 100 14');
  });
});
