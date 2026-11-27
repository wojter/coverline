import { useState } from 'preact/hooks';
import { CycleRing, type RingSegment } from '../components/CycleRing';
import { DayForm } from '../components/DayForm';
import { Day1Prompt } from '../components/Day1Prompt';
import { Heading } from '../components/Heading';
import { SaveBar } from '../components/SaveBar';
import { SourceMarker } from '../components/SourceMarker';
import { TokenBanner } from '../components/TokenBanner';
import { BLEED_STROKE } from '../components/tokens';
import { isCycleStart, requestDay1, type Day1Request } from '../components/day1';
import { useDayDraft } from '../components/useDayDraft';
import { cycles, data } from '../data/state';
import { type Cycle, cycleAt } from '../domain/cycles';
import { addDays, daysBetween, today } from '../domain/dates';
import { mucusQuality } from '../domain/derive';
import type { DayRow } from '../domain/types';
import { ringAverage } from '../domain/stats';
import { SOURCE_IDS, type Bleeding, type SourceId } from '../domain/types';
import { formatDate, formatTemp, t } from '../i18n';

export default function Today() {
  const date = today();
  const draft = useDayDraft(date);
  const [request, setRequest] = useState<Day1Request | null>(null);
  const hit = cycleAt(cycles.value, date);
  const current = hit?.cycle ?? null;
  const dayCount = hit ? hit.day : null;
  const segments = bleedingSegments(current);
  const fertile = current && current.row.fertile_start && current.row.fertile_end ? fertileSegment(current.row.fertile_start, current.row.fertile_end, current.start) : null;
  const todayRow = draft.day;
  const quality = todayQuality(todayRow);
  const hasEntry = Boolean(quality || todayRow.bleeding || SOURCE_IDS.some((source) => data.value.temps[`${date}/${source}`]));

  function toggleDay1() {
    const next = requestDay1(date);
    if (next) setRequest(next);
  }

  return (
    <div class="flex flex-col gap-3 pb-44 lg:pb-28">
      <Heading title={capitalise(formatDate(date, 'long'))} badge={false} compact />
      <TokenBanner />
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:grid-rows-[auto_auto_1fr] lg:items-start">
        <section class="card flex flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-4 lg:col-start-1">
          <CycleRing cycleDay={dayCount} average={ringAverage(cycles.value)} intention={current?.row.intention ?? null} segments={segments} fertile={fertile} />
        </section>
        <div class="grid grid-cols-2 gap-3 lg:col-start-1">
          <a href="/chart" class="card flex min-h-11 flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-2">
            <span class="text-xs uppercase tracking-wide opacity-70">{t('today.cycleNo')}</span>
            <span class="text-xl font-semibold tabular-nums">{current ? current.number : '–'}</span>
            {current?.row.intention && <span class="text-sm">{t(`codes.intention.${current.row.intention}`)}</span>}
          </a>
          <a href={`/entry/${date}`} class="card flex min-h-11 flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-2">
            <span class="text-xs uppercase tracking-wide opacity-70">{t('today.today')}</span>
            {SOURCE_IDS.map((source) => (
              <TodayTemp key={source} date={date} source={source} />
            ))}
            {quality && <span class="text-sm">{quality}</span>}
            {todayRow.bleeding && <span class="text-sm">{t(`codes.bleeding.${todayRow.bleeding}`)}</span>}
            {!hasEntry && <span class="text-sm opacity-60">{t('today.noEntry')}</span>}
            <span class="mt-auto text-xs opacity-70">{t('today.openEntry')} ›</span>
          </a>
        </div>
        <section class="flex flex-col gap-3 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <h2 class="sr-only">{t('today.quickForm')}</h2>
          <DayForm draft={draft} variant="quick" day1={{ checked: isCycleStart(date), onToggle: toggleDay1 }} />
        </section>
        <a href={`/entry/${date}`} class="btn btn-outline min-h-11 rounded-full self-start lg:col-start-1">
          {t('today.fullForm')}
        </a>
      </div>
      <SaveBar onSave={() => void draft.save()} status={draft.status} disabled={!draft.dirty} />
      {request && <Day1Prompt request={request} onDone={() => setRequest(null)} />}
    </div>
  );
}

function TodayTemp({ date, source }: { date: string; source: SourceId }) {
  const reading = data.value.temps[`${date}/${source}`];
  if (!reading) return null;
  const row = data.value.sources[source];
  return (
    <span class="flex items-center gap-2 text-lg font-semibold tabular-nums">
      <SourceMarker marker={row.marker} color={row.color} size={12} hollow={reading.excluded} />
      {formatTemp(reading.value)}
    </span>
  );
}

function todayQuality(day: DayRow): string {
  const quality = mucusQuality(day);
  return quality ? t(`codes.mucus_quality.${quality}`) : '';
}

function bleedingSegments(cycle: Cycle | null): RingSegment[] {
  if (!cycle) return [];
  const segments: RingSegment[] = [];
  for (let day = 0; day < 60; day++) {
    const date = addDays(cycle.start, day);
    if (cycle.end !== null && date > cycle.end) break;
    const bleeding = data.value.days[date]?.bleeding as Bleeding | null | undefined;
    if (bleeding) segments.push({ start: day, end: day + 1, className: BLEED_STROKE[bleeding] });
    if (date === today()) break;
  }
  return segments;
}

function fertileSegment(from: string, to: string, start: string): RingSegment {
  return { start: daysBetween(start, from), end: daysBetween(start, to) + 1, className: 'stroke-fertile' };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

