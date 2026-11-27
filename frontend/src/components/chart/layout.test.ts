import { describe, expect, it } from 'vitest';
import {
  CHART,
  chartDays,
  chartZoom,
  columnCenter,
  curveSegments,
  mucusRowMatch,
  noteCharLimit,
  ROW_KEYS,
  rowLayout,
  rowTint,
  tempBands,
  tempY,
  temperatureScale,
  truncateNote,
  valueAtY,
} from './layout';
import { emptyDayRow } from '../../domain/types';

describe('chartDays', () => {
  it('gives at least 40 columns for a short cycle', () => {
    const days = chartDays('2026-07-30', '2026-08-26', '2026-11-19');
    expect(days).toHaveLength(CHART.minColumns);
    expect(days[0]).toBe('2026-07-30');
  });

  it('extends to the end of a longer cycle', () => {
    const days = chartDays('2026-01-01', '2026-03-31', '2026-11-19');
    expect(days.at(-1)).toBe('2026-03-31');
    expect(days).toHaveLength(90);
  });

  it('runs to today for an open cycle', () => {
    const days = chartDays('2026-10-24', null, '2026-11-19');
    expect(days.at(-1)).toBe('2026-12-02');
  });
});

describe('rowTint', () => {
  it('shades peak and fertile darker, highly fertile mucus rows lighter, and keeps cycleDay and bleeding white', () => {
    const shaded = ROW_KEYS.filter((key) => rowTint(key) !== null);
    expect(shaded).toEqual(['peak', 'wet', 'stretchy', 'clear', 'fertile']);
    expect(rowTint('peak')?.opacity).toBeGreaterThan(rowTint('wet')?.opacity ?? 0);
    expect(rowTint('fertile')?.opacity).toBe(rowTint('peak')?.opacity);
    expect(rowTint('cycleDay')).toBeNull();
    expect(rowTint('bleeding')).toBeNull();
  });
});

describe('tempBands', () => {
  it('shades every x.00 row from max down to min', () => {
    const scale = { min: 3580, max: 3720 };
    const bands = tempBands(scale);
    expect(bands).toHaveLength(15);
    expect(bands[0]).toEqual({ y: 0, height: CHART.tempStep });
    expect(bands.at(-1)).toEqual({ y: 28 * CHART.tempStep, height: CHART.tempStep });
  });
});

describe('temperatureScale', () => {
  it('keeps the 35.80–37.20 default scale when every reading is at least 0.10 away from the edges', () => {
    expect(temperatureScale([])).toEqual({ min: 3580, max: 3720 });
    expect(temperatureScale([3590, 3710])).toEqual({ min: 3580, max: 3720 });
  });

  it('widens in 0.05 steps when a reading is closer than 0.10 to the edge or outside', () => {
    expect(temperatureScale([3585, 3715])).toEqual({ min: 3575, max: 3725 });
    expect(temperatureScale([3548, 3762])).toEqual({ min: 3535, max: 3775 });
  });
});

describe('row layout', () => {
  it('stacks rows in card order and sizes the temperature row from the scale', () => {
    const scale = { min: 3580, max: 3720 };
    const rows = rowLayout(scale);
    expect(rows.map((r) => r.key).slice(0, 3)).toEqual(['date', 'temp', 'cycleDay']);
    const temp = rows.find((r) => r.key === 'temp');
    expect(temp?.height).toBe((140 / 5 + 1) * CHART.tempStep);
    expect(rows.at(-1)?.key).toBe('disturbances');
    rows.slice(1).forEach((row, i) => expect(row.y).toBe(rows[i].y + rows[i].height));
  });

  it('maps temperatures to the center of their 0.05 row and back', () => {
    const scale = { min: 3580, max: 3720 };
    expect(tempY(scale, 3720)).toBe(CHART.tempStep / 2);
    expect(tempY(scale, 3650)).toBeGreaterThan(tempY(scale, 3700));
    expect(valueAtY(scale, tempY(scale, 3645))).toBe(3645);
    expect(valueAtY(scale, -100)).toBe(3720);
  });
});

describe('curveSegments', () => {
  const yOf = (value: number) => value;
  const reading = (value: number, excluded = false) => ({ value, excluded });

  it('breaks the line on a day with no reading', () => {
    const segments = curveSegments([reading(1), reading(2), undefined, reading(3)], yOf);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(2);
    expect(segments[1][0].x).toBe(columnCenter(3));
  });

  it('skips an excluded reading and joins its neighbours', () => {
    const segments = curveSegments([reading(1), reading(9, true), reading(2)], yOf);
    expect(segments).toHaveLength(1);
    expect(segments[0].map((p) => p.y)).toEqual([1, 2]);
  });
});

describe('mucus rows', () => {
  it('matches sensation and features to their rows', () => {
    const day = { ...emptyDayRow(), mucus_sensation: 'wet' as const, mucus_features: ['clear' as const] };
    expect(mucusRowMatch('wet', day)).toBe(true);
    expect(mucusRowMatch('clear', day)).toBe(true);
    expect(mucusRowMatch('dry', day)).toBe(false);
  });
});

describe('notes', () => {
  it('cuts long text with an ellipsis and keeps short text', () => {
    expect(truncateNote('ból gardła', 20)).toBe('ból gardła');
    expect(truncateNote('abcdefghij', 5)).toBe('abcd…');
  });

  it('allows more characters on a taller grid', () => {
    expect(noteCharLimit(300)).toBeGreaterThan(noteCharLimit(100));
  });
});

describe('chartZoom', () => {
  const natural = { width: 1188, height: 625 };

  it('keeps natural size when the chart has to scroll', () => {
    expect(chartZoom({ width: 400, height: 2000 }, natural)).toBe(1);
    expect(chartZoom({ width: 0, height: 0 }, natural)).toBe(1);
  });

  it('scales up to fill the available width, capped at maxZoom', () => {
    expect(chartZoom({ width: 1188 * 1.25, height: 2000 }, natural)).toBeCloseTo(1.25);
    expect(chartZoom({ width: 5000, height: 5000 }, natural)).toBe(CHART.maxZoom);
  });

  it('never grows taller than the window', () => {
    expect(chartZoom({ width: 1188 * 1.5, height: 625 * 1.1 }, natural)).toBeCloseTo(1.1);
    expect(chartZoom({ width: 1188 * 1.5, height: 500 }, natural)).toBe(1);
  });
});
