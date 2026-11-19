// The only place besides i18n that converts between hundredths and degrees (architecture rule 5).

import type { Site } from './types';

export function parseTempInput(text: string): number | null | 'invalid' {
  const input = text.trim().replace(',', '.');
  if (input === '') return null;
  if (/^\d{3}$/.test(input)) return 3000 + Number(input);
  if (/^\d{4}$/.test(input)) return Number(input);
  const match = /^(\d{2})(?:\.(\d{0,2}))?$/.exec(input);
  if (!match) return 'invalid';
  const [, whole, fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function defaultRange(site: Site): { min: number; max: number } {
  if (site === 'finger' || site === 'wrist' || site === 'other') {
    return { min: 3300, max: 3800 };
  }
  return { min: 3550, max: 3800 };
}

export function isInRange(source: { range_min: number; range_max: number }, value: number): boolean {
  return value >= source.range_min && value <= source.range_max;
}

export function formatHundredths(hundredths: number, separator = '.'): string {
  const whole = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, '0');
  return `${whole}${separator}${fraction}`;
}
