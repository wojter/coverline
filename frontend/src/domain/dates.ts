// Dates are YYYY-MM-DD strings. Arithmetic runs in UTC, so no DST shifts.

const DAY_MS = 86_400_000;

export function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  return toIso(parse(text)) === text;
}

export function addDays(date: string, days: number): string {
  return toIso(parse(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export function today(): string {
  const now = new Date();
  return toIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function daysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) days.push(date);
  return days;
}

export function weekday(date: string): number {
  return (new Date(parse(date)).getUTCDay() + 6) % 7;
}

// Weeks run Monday to Sunday. Cells outside the month are included so every row is full.
export function monthGrid(year: number, month: number): string[][] {
  const first = toIso(Date.UTC(year, month - 1, 1));
  const nextMonth = toIso(Date.UTC(year, month, 1));
  const weeks: string[][] = [];
  for (let start = addDays(first, -weekday(first)); start < nextMonth; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

function parse(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}
