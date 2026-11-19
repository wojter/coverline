import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, daysInRange, isDate, monthGrid, weekday } from './dates';

describe('dates', () => {
  it('accepts only real calendar dates', () => {
    expect(isDate('2028-02-29')).toBe(true);
    expect(isDate('2026-02-29')).toBe(false);
    expect(isDate('2026-5-10')).toBe(false);
    expect(isDate('2026-13-01')).toBe(false);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-06-03', '2026-06-30')).toBe(27);
    expect(daysBetween('2026-06-30', '2026-06-03')).toBe(-27);
  });

  it('lists inclusive ranges', () => {
    expect(daysInRange('2026-06-30', '2026-07-02')).toEqual(['2026-06-30', '2026-07-01', '2026-07-02']);
  });

  it('starts weeks on Monday', () => {
    expect(weekday('2026-11-16')).toBe(0);
    expect(weekday('2026-11-22')).toBe(6);
  });

  it('builds full Monday-first weeks for a month', () => {
    const weeks = monthGrid(2026, 11);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toBe('2026-10-26');
    expect(weeks[weeks.length - 1][6]).toBe('2026-12-06');
    expect(weeks.flat()).toContain('2026-11-30');
  });

  it('adds only the weeks that touch the month', () => {
    expect(monthGrid(2026, 11).length).toBe(6);
    expect(monthGrid(2027, 2).length).toBe(4);
  });
});
