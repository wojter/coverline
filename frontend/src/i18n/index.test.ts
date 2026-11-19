import { describe, expect, it } from 'vitest';
import en from './en.json';
import pl from './pl.json';
import { detectLanguage, formatDate, formatNumber, formatTemp, setLanguage, t } from './index';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string' ? [[prefix + key, value]] : Object.entries(leaves(value, `${prefix}${key}.`)),
    ),
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe('translation files', () => {
  const enLeaves = leaves(en);
  const plLeaves = leaves(pl);

  it('have the same keys in both directions', () => {
    expect(Object.keys(plLeaves).sort()).toEqual(Object.keys(enLeaves).sort());
  });

  it('have no empty values', () => {
    for (const [key, value] of [...Object.entries(enLeaves), ...Object.entries(plLeaves)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(enLeaves)) {
      expect(placeholders(plLeaves[key]), key).toEqual(placeholders(enLeaves[key]));
    }
  });
});

describe('t', () => {
  it('translates, interpolates and falls back to the key', () => {
    setLanguage('pl');
    expect(t('nav.today')).toBe('Dziś');
    expect(t('source.defaultName', { n: 2 })).toBe('Pomiar 2');
    expect(t('missing.key')).toBe('missing.key');
    setLanguage('en');
    expect(t('source.defaultName', { n: 1 })).toBe('Measurement 1');
  });
});

describe('detectLanguage', () => {
  it('picks Polish for pl and English otherwise', () => {
    expect(detectLanguage('pl-PL')).toBe('pl');
    expect(detectLanguage('en-US')).toBe('en');
    expect(detectLanguage('de-DE')).toBe('en');
  });
});

describe('formatting', () => {
  it('formats dates in the selected language', () => {
    setLanguage('pl');
    expect(formatDate('2026-11-19', 'long')).toBe('czwartek, 19 listopada');
    setLanguage('en');
    expect(formatDate('2026-11-19', 'short')).toBe('19 Nov');
  });

  it('uses a decimal comma in Polish only', () => {
    setLanguage('pl');
    expect(formatTemp(3645)).toBe('36,45');
    expect(formatNumber(28.5, 1)).toBe('28,5');
    setLanguage('en');
    expect(formatTemp(3645)).toBe('36.45');
  });
});
