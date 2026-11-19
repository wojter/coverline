import { signal } from '@preact/signals';
import { formatHundredths } from '../domain/tempInput';
import en from './en.json';
import pl from './pl.json';

export type Lang = 'en' | 'pl';
export type DateStyle = 'long' | 'short' | 'monthYear' | 'weekdayShort';

interface Tree {
  [key: string]: string | Tree;
}

const messages: Record<Lang, Tree> = { en, pl };
const locales: Record<Lang, string> = { en: 'en-GB', pl: 'pl-PL' };
const dateOptions: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  short: { day: 'numeric', month: 'short' },
  monthYear: { month: 'long', year: 'numeric' },
  weekdayShort: { weekday: 'short' },
};

export const lang = signal<Lang>('en');

export function setLanguage(next: Lang): void {
  lang.value = next;
}

export function detectLanguage(browserLanguage: string): Lang {
  return browserLanguage.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const text = lookup(messages[lang.value], key) ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match));
}

function lookup(tree: Tree, key: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

// Dates are YYYY-MM-DD and are formatted in UTC so the device time zone never shifts them.
export function formatDate(date: string, style: DateStyle): string {
  const [year, month, day] = date.split('-').map(Number);
  const formatter = new Intl.DateTimeFormat(locales[lang.value], {
    ...dateOptions[style],
    timeZone: 'UTC',
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locales[lang.value], { maximumFractionDigits }).format(value);
}

export function formatTemp(hundredths: number): string {
  return formatHundredths(hundredths, lang.value === 'pl' ? ',' : '.');
}
