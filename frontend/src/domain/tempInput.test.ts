import { describe, expect, it } from 'vitest';
import { defaultRange, formatHundredths, isInRange, parseTempInput } from './tempInput';

describe('parseTempInput', () => {
  it.each([
    ['645', 3645],
    ['3645', 3645],
    ['36,45', 3645],
    ['36.45', 3645],
    ['36.4', 3640],
    ['36', 3600],
    ['', null],
    ['  ', null],
  ])('reads %j as %j', (text, expected) => {
    expect(parseTempInput(text)).toBe(expected);
  });

  it.each(['6', 'abc', '36.456', '3.645', '645,5'])('rejects %j', (text) => {
    expect(parseTempInput(text)).toBe('invalid');
  });
});

describe('ranges', () => {
  it('uses the site defaults', () => {
    expect(defaultRange('oral')).toEqual({ min: 3550, max: 3800 });
    expect(defaultRange('finger')).toEqual({ min: 3300, max: 3800 });
  });

  it('includes both bounds', () => {
    const source = { range_min: 3550, range_max: 3800 };
    expect(isInRange(source, 3550)).toBe(true);
    expect(isInRange(source, 3800)).toBe(true);
    expect(isInRange(source, 3549)).toBe(false);
  });
});

describe('formatHundredths', () => {
  it('pads to two decimals with the given separator', () => {
    expect(formatHundredths(3645)).toBe('36.45');
    expect(formatHundredths(3605, ',')).toBe('36,05');
  });
});
