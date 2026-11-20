import { useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight } from 'lucide-preact';
import { Day1Prompt } from '../components/Day1Prompt';
import { Heading } from '../components/Heading';
import { SourceMarker } from '../components/SourceMarker';
import { requestDay1, isCycleStart, type Day1Request } from '../components/day1';
import { BLEED_BG } from '../components/tokens';
import { cycles, data } from '../data/state';
import { isFertileDay, cycleAt } from '../domain/cycles';
import { monthGrid, today } from '../domain/dates';
import { markOf, tempKey } from '../domain/marks';
import { mucusQuality } from '../domain/derive';
import { SOURCE_IDS } from '../domain/types';
import { formatDate, t } from '../i18n';

export default function Calendar() {
  const now = today();
  const [year, setYear] = useState(Number(now.slice(0, 4)));
  const [month, setMonth] = useState(Number(now.slice(5, 7)));
  const [marking, setMarking] = useState(false);
  const [request, setRequest] = useState<Day1Request | null>(null);
  const weeks = monthGrid(year, month);
  const monthTitle = formatDate(`${year}-${String(month).padStart(2, '0')}-01`, 'monthYear');

  function shift(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
  }

  function onCellTap(date: string) {
    if (!marking) return;
    const next = requestDay1(date);
    if (next) setRequest(next);
  }

  return (
    <div class="flex flex-col gap-4">
      <Heading title={t('nav.calendar')} />
      {marking && <p role="status" class="alert alert-primary rounded-box text-sm">{t('calendar.markingBanner')}</p>}
      <section class="card flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3">
        <header class="flex items-center justify-between">
          <button type="button" class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('calendar.previousMonth')} onClick={() => shift(-1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2 class="font-semibold capitalize">{monthTitle}</h2>
          <button type="button" class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('calendar.nextMonth')} onClick={() => shift(1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </header>
        <div class="grid grid-cols-7 gap-1 text-center text-xs opacity-70">
          {weekdayHeaders().map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div class="grid grid-cols-7 gap-1">
          {weeks.flat().map((date) => (
            <DayCell key={date} date={date} inMonth={date.slice(5, 7) === String(month).padStart(2, '0')} now={now} marking={marking} onTap={() => onCellTap(date)} />
          ))}
        </div>
      </section>
      <button type="button" aria-pressed={marking} class={`btn min-h-11 rounded-full self-start ${marking ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMarking(!marking)}>
        {t('calendar.markStarts')}
      </button>
      <Legend />
      {request && <Day1Prompt request={request} onDone={() => setRequest(null)} />}
    </div>
  );
}

function weekdayHeaders(): string[] {
  const monday = Date.UTC(2026, 0, 5);
  return Array.from({ length: 7 }, (_, i) =>
    formatDate(new Date(monday + i * 86_400_000).toISOString().slice(0, 10), 'weekdayShort'),
  );
}

function DayCell({ date, inMonth, now, marking, onTap }: { date: string; inMonth: boolean; now: string; marking: boolean; onTap: () => void }) {
  const day = data.value.days[date];
  const hit = cycleAt(cycles.value, date);
  const bleeding = day?.bleeding ?? null;
  const quality = mucusQuality(day);
  const fill = bleeding ? BLEED_BG[bleeding] : quality === 'highly_fertile' ? 'bg-mucus-hf' : quality === 'less_fertile' ? 'bg-mucus-lf' : 'bg-base-100';
  const start = isCycleStart(date);
  const peak = markOf(data.value, 'mucus', date) === 'P';
  const fertile = hit ? isFertileDay(hit.cycle, date) : false;
  const readings = SOURCE_IDS.filter((s) => data.value.temps[tempKey(date, s)]);
  const outside = !hit;
  const cell = (
    <>
      <span class="flex items-start justify-between">
        <span class="text-sm font-semibold tabular-nums">{Number(date.slice(8))}</span>
        {hit && <span class="text-[10px] tabular-nums opacity-80">{hit.day}</span>}
      </span>
      <span class="flex flex-wrap gap-0.5">
        {start && <span class="badge badge-xs bg-cycle-start border-0 text-white">1</span>}
        {peak && <span class="badge badge-xs bg-base-content border-0 text-base-100">P</span>}
        {readings.map((s) => (
          <SourceMarker key={s} marker={data.value.sources[s].marker} color={data.value.sources[s].color} size={9} hollow={data.value.temps[tempKey(date, s)]?.excluded} />
        ))}
      </span>
      {fertile && <span class="absolute inset-x-0 bottom-0 h-1 bg-fertile" aria-hidden="true" />}
    </>
  );
  const classes = `relative flex aspect-square min-h-11 flex-col justify-between overflow-hidden rounded-lg border p-1 text-left ${fill} ${
    date === now ? 'border-primary border-2' : 'border-base-300'
  } ${!inMonth || outside ? 'opacity-50' : ''}`;
  if (marking) {
    return (
      <button type="button" class={classes} onClick={onTap} aria-label={formatDate(date, 'long')}>
        {cell}
      </button>
    );
  }
  return (
    <a href={`/entry/${date}`} class={classes} aria-label={formatDate(date, 'long')}>
      {cell}
    </a>
  );
}

function Legend() {
  return (
    <section class="card flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-4 text-sm">
      <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('calendar.legend')}</h2>
      <p class="flex items-center gap-2"><span class="badge badge-xs bg-cycle-start border-0" />{t('calendar.legendStart')}</p>
      <p class="flex items-center gap-2"><span class="badge badge-xs bg-base-content border-0" />{t('calendar.legendPeak')}</p>
      <p class="flex items-center gap-2"><span class="h-3 w-6 rounded bg-mucus-hf" />{t('calendar.legendHighlyFertile')}</p>
      <p class="flex items-center gap-2"><span class="h-3 w-6 rounded bg-mucus-lf" />{t('calendar.legendLessFertile')}</p>
      <p class="flex items-center gap-2"><span class="h-1 w-6 bg-fertile" />{t('calendar.legendFertile')}</p>
      <p class="flex items-center gap-2"><SourceMarker marker="circle" color="#334155" size={12} />{t('calendar.legendReading')}</p>
    </section>
  );
}
