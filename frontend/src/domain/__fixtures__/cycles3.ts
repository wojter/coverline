// Acceptance data for spec 7: three completed cycles plus the current one, with values worked out by hand.
//
// C1 2026-06-03 .. 2026-06-30 (end_date, then a break: 07-01..07-04 belong to no cycle)  28 days
// C2 2026-07-05 .. 2026-08-05 excluded from stats (illness)                               32 days
// C3 2026-08-06 .. 2026-09-04                                                             30 days
// C4 2026-09-05 .. open, viewed on 2026-09-20                                         day 16

const C1 = '1a8e5c2d-3b4f-4a6e-8c7d-9e0f1a2b3c4d';
const C2 = '2b9f6d3e-4c5a-4b7f-9d8e-0f1a2b3c4d5e';
const C3 = '3ca07e4f-5d6b-4c8a-ae9f-1a2b3c4d5e6f';
const C4 = '4db18f5a-6e7c-4d9b-bfa0-2b3c4d5e6f7a';

export const cycleIds = { C1, C2, C3, C4 };

export const today = '2026-09-20';

const noCycleFields = {
  end_date: null,
  excluded_from_stats: false,
  intention: 'avoid',
  first_mucus_day: null,
  first_hf_mucus_day: null,
  coverline_1: null,
  coverline_2: null,
  fertile_start: null,
  fertile_end: null,
  prev_cycle_rise: null,
  notes: null,
} as const;

const emptyDay = {
  bleeding: null,
  mucus_sensation: null,
  mucus_features: null,
  mucus_atypical: null,
  mucus_quality_override: null,
  symptoms: null,
  intercourse: null,
  disturbances: null,
  chart_note: null,
  mark_mucus: null,
  notes: null,
} as const;

const reading = (value: number, mark: string | null = null, excluded = false) => ({ value, excluded, mark });

export const dataset = {
  version: 'acceptance',
  sources: {
    '1': { name: '', site: 'oral', color: '#2563eb', marker: 'circle', range_min: 3550, range_max: 3800 },
    '2': { name: '', site: 'oral', color: '#d97706', marker: 'square', range_min: 3550, range_max: 3800 },
  },
  cycles: {
    [C1]: { ...noCycleFields, start_date: '2026-06-03', end_date: '2026-06-30' },
    [C2]: { ...noCycleFields, start_date: '2026-07-05', excluded_from_stats: true, notes: 'choroba' },
    [C3]: { ...noCycleFields, start_date: '2026-08-06' },
    [C4]: { ...noCycleFields, start_date: '2026-09-05' },
  },
  days: {
    '2026-06-03': { ...emptyDay, bleeding: 'heavy' },
    '2026-06-04': { ...emptyDay, bleeding: 'medium' },
    '2026-06-05': { ...emptyDay, bleeding: 'light' },
    '2026-06-06': { ...emptyDay, bleeding: 'spotting' },
    '2026-06-16': { ...emptyDay, mucus_sensation: 'wet', mark_mucus: 'P' },
    '2026-07-02': { ...emptyDay, notes: 'przerwa w obserwacji' },
    '2026-07-05': { ...emptyDay, bleeding: 'spotting' },
    '2026-07-06': { ...emptyDay, bleeding: 'heavy' },
    '2026-07-07': { ...emptyDay, bleeding: 'medium' },
    '2026-07-20': { ...emptyDay, mucus_sensation: 'wet', mark_mucus: 'P', disturbances: ['illness'] },
    '2026-08-06': { ...emptyDay, bleeding: 'medium' },
    '2026-08-07': { ...emptyDay, bleeding: 'light' },
    '2026-08-09': { ...emptyDay, bleeding: 'light' },
    '2026-08-20': { ...emptyDay, mucus_sensation: 'wet', mark_mucus: 'P' },
    '2026-09-05': { ...emptyDay, bleeding: 'heavy' },
  },
  temps: {
    '2026-06-14/1': reading(3630),
    '2026-06-15/1': reading(3625),
    '2026-06-16/1': reading(3620),
    '2026-06-17/1': reading(3665, '1'),
    '2026-06-18/1': reading(3670, '2'),
    '2026-06-19/1': reading(3675, '3'),
    '2026-06-20/1': reading(3672),
    '2026-06-21/1': reading(3680),
    '2026-06-15/2': reading(3640),
    '2026-06-16/2': reading(3635),
    '2026-06-17/2': reading(3650),
    '2026-06-18/2': reading(3680, '1'),
    '2026-06-19/2': reading(3685, '2'),
    '2026-06-20/2': reading(3700, null, true),
    '2026-06-21/2': reading(3690, '3'),
    '2026-07-02/1': reading(3640),
    '2026-07-21/1': reading(3630),
    '2026-07-22/1': reading(3668, '1'),
    '2026-07-23/1': reading(3660, '2'),
    '2026-07-24/1': reading(3672, '3'),
    '2026-08-18/1': reading(3625),
    '2026-08-19/1': reading(3630),
    '2026-08-20/1': reading(3620),
    '2026-08-21/1': reading(3665, '1'),
    '2026-08-22/1': reading(3670, '2'),
    '2026-08-23/1': reading(3675, '3'),
    '2026-08-24/1': reading(3678),
  },
  settings: { default_intention: 'avoid', cycle_number_start: 1, stats_n: 12 },
};

// Per cycle. "Shortest / longest" use the completed, non-excluded cycles that ended before the cycle starts.
// Luteal length: from the day marked 1 to the last cycle day, inclusive, completed cycles only.
// Previous cycle rise: null when there is no previous cycle.
export const expected = {
  cycles: [
    {
      id: C1, number: 1, start: '2026-06-03', end: '2026-06-30', completed: true, length: 28,
      lastMenstruationDay: '2026-06-05',
      mucusPeak: '2026-06-16', mucusPeakCycleDay: 14, mucusPeakPlus3: '2026-06-19',
      thirdHighDay: { 1: '2026-06-19', 2: '2026-06-21' },
      lutealLength: { 1: 14, 2: 13 },
      peakToThirdHigh: { 1: 3, 2: 5 },
      shortest: null, longest: null, cyclesUsed: 0, shortestMinus21: null, shortestMinus20: null,
      prevCycleRise: null,
    },
    {
      // Day 1 is spotting, so there is no run of light or heavier bleeding that starts on day 1.
      id: C2, number: 2, start: '2026-07-05', end: '2026-08-05', completed: true, length: 32,
      lastMenstruationDay: null,
      mucusPeak: '2026-07-20', mucusPeakCycleDay: 16, mucusPeakPlus3: '2026-07-23',
      thirdHighDay: { 1: '2026-07-24', 2: null },
      lutealLength: { 1: 15, 2: null },
      peakToThirdHigh: { 1: 4, 2: null },
      shortest: 28, longest: 28, cyclesUsed: 1, shortestMinus21: 7, shortestMinus20: 8,
      prevCycleRise: true,
    },
    {
      // 08-08 has no bleeding recorded, so the run ends on 08-07.
      id: C3, number: 3, start: '2026-08-06', end: '2026-09-04', completed: true, length: 30,
      lastMenstruationDay: '2026-08-07',
      mucusPeak: '2026-08-20', mucusPeakCycleDay: 15, mucusPeakPlus3: '2026-08-23',
      thirdHighDay: { 1: '2026-08-23', 2: null },
      lutealLength: { 1: 15, 2: null },
      peakToThirdHigh: { 1: 3, 2: null },
      shortest: 28, longest: 28, cyclesUsed: 1, shortestMinus21: 7, shortestMinus20: 8,
      prevCycleRise: true,
    },
    {
      // Open cycle: the length shown is the current cycle day.
      id: C4, number: 4, start: '2026-09-05', end: null, completed: false, length: 16,
      lastMenstruationDay: '2026-09-05',
      mucusPeak: null, mucusPeakCycleDay: null, mucusPeakPlus3: null,
      thirdHighDay: { 1: null, 2: null },
      lutealLength: { 1: null, 2: null },
      peakToThirdHigh: { 1: null, 2: null },
      shortest: 28, longest: 30, cyclesUsed: 2, shortestMinus21: 7, shortestMinus20: 8,
      prevCycleRise: true,
    },
  ],
  // Completed, non-excluded cycles: C1 (28) and C3 (30).
  totals: { count: 2, average: 29, min: 28, max: 30 },
  ringAverage: 29,
  cycleOf: {
    '2026-05-31': null,
    '2026-06-03': { id: C1, day: 1 },
    '2026-06-30': { id: C1, day: 28 },
    '2026-07-02': null,
    '2026-07-05': { id: C2, day: 1 },
    '2026-09-04': { id: C3, day: 30 },
    '2026-09-20': { id: C4, day: 16 },
  },
  // Source evaluation over C1 and C3 (58 cycle days). The reading on 07-02 (no cycle) and C2 (excluded) do not count.
  // An excluded reading is still a day with a reading, so daysWithReading + missingDays = 58.
  sources: {
    1: { daysWithReading: 15, excludedReadings: 0, missingDays: 43, cyclesWithRise: 2, completedCycles: 2 },
    2: { daysWithReading: 7, excludedReadings: 1, missingDays: 51, cyclesWithRise: 1, completedCycles: 2 },
  },
};
