import { addDays } from './dates';
import { type Cycle, isInCycle } from './cycles';
import { thirdHighDay } from './marks';
import type { Bleeding, DayRow, Dataset, MucusQuality } from './types';

const LIGHT_OR_HEAVIER: readonly Bleeding[] = ['light', 'medium', 'heavy'];

export function derivedMucusQuality(day: DayRow | undefined): MucusQuality | null {
  if (!day) return null;
  const features = day.mucus_features ?? [];
  if (day.mucus_sensation === 'wet' || features.includes('clear') || features.includes('stretchy')) {
    return 'highly_fertile';
  }
  if (day.mucus_sensation === 'moist' || features.includes('cloudy') || features.includes('sticky')) {
    return 'less_fertile';
  }
  if (day.mucus_sensation === 'dry') return 'none';
  return null;
}

export function mucusQuality(day: DayRow | undefined): MucusQuality | null {
  return day?.mucus_quality_override ?? derivedMucusQuality(day);
}

// The run of light or heavier bleeding from day 1. It ends at the first day without it, or at the cycle end.
export function lastMenstruationDay(data: Dataset, cycle: Cycle): string | null {
  let last: string | null = null;
  for (let date = cycle.start; isInCycle(cycle, date); date = addDays(date, 1)) {
    const bleeding = data.days[date]?.bleeding;
    if (!bleeding || !LIGHT_OR_HEAVIER.includes(bleeding)) break;
    last = date;
  }
  return last;
}

function firstDayWhere(
  data: Dataset,
  cycle: Cycle,
  matches: (quality: MucusQuality | null) => boolean,
): string | null {
  const days = Object.keys(data.days).filter((date) => isInCycle(cycle, date)).sort();
  return days.find((date) => matches(mucusQuality(data.days[date]))) ?? null;
}

export function suggestFirstMucusDay(data: Dataset, cycle: Cycle): string | null {
  return firstDayWhere(data, cycle, (q) => q === 'less_fertile' || q === 'highly_fertile');
}

export function suggestFirstHfMucusDay(data: Dataset, cycle: Cycle): string | null {
  return firstDayWhere(data, cycle, (q) => q === 'highly_fertile');
}

// Looks at the previous cycle, whether excluded or not. Null when there is none.
export function computedPrevCycleRise(data: Dataset, cycles: Cycle[], cycle: Cycle): boolean | null {
  const index = cycles.findIndex((c) => c.id === cycle.id);
  const previous = cycles[index - 1];
  if (index <= 0 || previous === undefined) return null;
  return thirdHighDay(data, previous, '1') !== null || thirdHighDay(data, previous, '2') !== null;
}
