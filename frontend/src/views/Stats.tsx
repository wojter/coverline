import { SourceMarker } from '../components/SourceMarker';
import { Heading } from '../components/Heading';
import { cycles, data } from '../data/state';
import { cycleSummary, cycleTotals, sourceEvaluations } from '../domain/stats';
import { SOURCE_IDS, type SourceId } from '../domain/types';
import { today } from '../domain/dates';
import { formatDate, formatNumber, t } from '../i18n';

export default function Stats() {
  const now = today();
  const list = cycles.value;
  const overall = cycleTotals(list);
  const lastN = cycleTotals(list, data.value.settings.stats_n);
  const evaluations = sourceEvaluations(data.value, list);
  const rows = list.map((cycle) => ({ cycle, summary: cycleSummary(data.value, list, cycle, now) }));
  return (
    <div class="flex flex-col gap-4">
      <Heading title={t('nav.stats')} />
      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('stats.totals')}</h2>
        <div class="grid gap-2 lg:grid-cols-2 lg:gap-4">
          <Tiles label={t('stats.overall')} totals={overall} />
          <Tiles label={t('stats.lastN', { n: data.value.settings.stats_n })} totals={lastN} />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('stats.cycles')}</h2>
        <div class="flex flex-col gap-2 md:hidden">
          {rows.map(({ cycle, summary }) => (
            <a key={cycle.id} href={`/chart/${cycle.start}`} class={`card flex flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-3 text-sm ${cycle.excluded ? 'opacity-70' : ''}`}>
              <span class="flex items-center justify-between font-semibold">
                <span>{t('chart.cycleNo', { n: cycle.number })} · {formatDate(cycle.start, 'short')}</span>
                <span class="tabular-nums">{summary.length}</span>
              </span>
              {cycle.excluded && <span class="badge badge-outline badge-sm self-start">{t('stats.excluded')}</span>}
              <span class="opacity-80">{t('computed.lastMenstruation')}: {summary.lastMenstruationDay ? formatDate(summary.lastMenstruationDay, 'short') : '–'}</span>
              <span class="opacity-80">{t('computed.mucusPeak')}: {summary.mucusPeakCycleDay ?? '–'}</span>
              <span class="opacity-80">{t('field.fertileDays')}: {cycle.row.fertile_start && cycle.row.fertile_end ? `${formatDate(cycle.row.fertile_start, 'short')} – ${formatDate(cycle.row.fertile_end, 'short')}` : '–'}</span>
              {SOURCE_IDS.map((s) => (
                <span key={s} class="opacity-80">{sourceLabel(s)}: {t('computed.thirdHighDay')} {summary.thirdHighDay[s] ? formatDate(summary.thirdHighDay[s] as string, 'short') : '–'} · {t('computed.lutealLength')} {summary.lutealLength[s] ?? '–'}</span>
              ))}
            </a>
          ))}
        </div>
        <div class="card hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 md:block">
          <table class="table table-sm [&_th]:align-bottom [&_th]:whitespace-normal">
            <thead>
              <tr>
                <th rowSpan={2}>{t('stats.cycleNo')}</th>
                <th rowSpan={2}>{t('field.cycleStart')}</th>
                <th rowSpan={2}>{t('computed.cycleLength')}</th>
                <th rowSpan={2}>{t('computed.lastMenstruation')}</th>
                <th rowSpan={2}>{t('computed.mucusPeak')}</th>
                <th rowSpan={2}>{t('field.fertileDays')}</th>
                {SOURCE_IDS.map((s) => (
                  <th key={`s-${s}`} colSpan={2} class="border-l border-base-300">
                    <span class="flex items-center gap-2">
                      <SourceMarker marker={data.value.sources[s].marker} color={data.value.sources[s].color} size={10} />
                      {sourceLabel(s)}
                    </span>
                  </th>
                ))}
              </tr>
              <tr>
                {SOURCE_IDS.map((s) => [
                  <th key={`h-${s}`} class="border-l border-base-300">{t('computed.thirdHighDay')}</th>,
                  <th key={`l-${s}`}>{t('computed.lutealLength')}</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cycle, summary }) => (
                <tr key={cycle.id} class={`hover ${cycle.excluded ? 'opacity-70' : ''}`}>
                  <td><a href={`/chart/${cycle.start}`} class="link">{cycle.number}</a>{cycle.excluded && <span class="badge badge-outline badge-xs ml-1">{t('stats.excluded')}</span>}</td>
                  <td class="whitespace-nowrap tabular-nums">{formatDate(cycle.start, 'short')}</td>
                  <td class="tabular-nums">{summary.length}</td>
                  <td class="tabular-nums">{summary.lastMenstruationDay ? formatDate(summary.lastMenstruationDay, 'short') : '–'}</td>
                  <td class="tabular-nums">{summary.mucusPeakCycleDay ?? '–'}</td>
                  <td class="whitespace-nowrap tabular-nums">{cycle.row.fertile_start && cycle.row.fertile_end ? `${formatDate(cycle.row.fertile_start, 'short')} – ${formatDate(cycle.row.fertile_end, 'short')}` : '–'}</td>
                  {SOURCE_IDS.map((s) => [
                    <td key={`t-${s}`} class="border-l border-base-300 tabular-nums">{summary.thirdHighDay[s] ? formatDate(summary.thirdHighDay[s] as string, 'short') : '–'}</td>,
                    <td key={`b-${s}`} class="tabular-nums">{summary.lutealLength[s] ?? '–'}</td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('stats.sourceEvaluation')}</h2>
        <div class="grid grid-cols-2 gap-3">
          {SOURCE_IDS.map((s) => {
            const ev = evaluations[s];
            return (
              <div key={s} class="card flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-3 text-sm">
                <div class="flex items-center gap-2 font-semibold">
                  <SourceMarker marker={data.value.sources[s].marker} color={data.value.sources[s].color} />
                  <span class="truncate">{sourceLabel(s)}</span>
                </div>
                <Row label={t('stats.daysWithReading')} value={String(ev.daysWithReading)} />
                <Row label={t('stats.missingDays')} value={String(ev.missingDays)} />
                <Row label={t('stats.excludedReadings')} value={String(ev.excludedReadings)} />
                <Row label={t('stats.cyclesWithRise')} value={`${ev.cyclesWithRise} / ${ev.completedCycles}`} />
                <p class="text-xs opacity-70">{t('stats.peakToThird')}</p>
                {ev.peakToThirdHigh.map((item) => (
                  <Row key={item.start} label={formatDate(item.start, 'short')} value={item.days === null ? '–' : String(item.days)} />
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Tiles({ label, totals }: { label: string; totals: ReturnType<typeof cycleTotals> }) {
  const cells: [string, number | null][] = [
    [t('stats.count'), totals.count],
    [t('stats.average'), totals.average === null ? null : Math.round(totals.average * 10) / 10],
    [t('stats.min'), totals.min],
    [t('stats.max'), totals.max],
  ];
  return (
    <div class="flex flex-col gap-1">
      <p class="text-sm opacity-70">{label}</p>
      <div class="grid grid-cols-4 gap-2">
        {cells.map(([name, value]) => (
          <div key={name} class="card flex flex-col items-center gap-1 rounded-box border border-base-300 bg-base-100 p-2">
            <span class="text-xs uppercase tracking-wide opacity-70">{name}</span>
            <span class="text-xl font-semibold tabular-nums">{value === null ? '–' : formatNumber(value, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div class="flex justify-between gap-2 border-b border-base-300 py-1 last:border-0">
      <span class="opacity-80">{label}</span>
      <span class="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function sourceLabel(s: SourceId): string {
  return data.value.sources[s].name || t('source.defaultName', { n: s });
}
