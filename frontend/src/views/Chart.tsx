import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { ChevronLeft, ChevronRight, List, Printer } from 'lucide-preact';
import { Chart, type GridTap } from '../components/chart/Chart';
import { Modal } from '../components/Modal';
import { PillChoice } from '../components/Chips';
import { FieldGroup } from '../components/FieldGroup';
import { More } from '../components/More';
import { SourceMarker } from '../components/SourceMarker';
import { ToggleRow } from '../components/ToggleRow';
import { Heading } from '../components/Heading';
import { TokenBanner } from '../components/TokenBanner';
import { cycles, data } from '../data/state';
import { save } from '../data/store';
import { assignMarkOps, markOf, removeMarkOps, tempKey } from '../domain/marks';
import { CHART } from '../components/chart/layout';
import { type Cycle, cycleAt, datesOutsideCycle, moveStartOps, setEndDateOps } from '../domain/cycles';
import { daysBetween, isDate, today } from '../domain/dates';
import { cycleSummary, type CycleSummary } from '../domain/stats';
import { suggestFirstHfMucusDay, suggestFirstMucusDay } from '../domain/derive';
import { parseTempInput } from '../domain/tempInput';
import { INTENTION, MUCUS_MARK, SOURCE_IDS, TEMP_MARK, type Intention, type SourceId } from '../domain/types';
import { formatDate, formatNumber, formatTemp, t } from '../i18n';
import { MucusInfo } from '../components/MucusInfo';
import { Day1Prompt } from '../components/Day1Prompt';

type Mode = 'normal' | 'coverline' | 'fertile' | 'marks';
type Track = 'mucus' | SourceId;

export default function ChartView({ date }: { date?: string }) {
  const { route } = useLocation();
  const now = today();
  const list = cycles.value;
  const hit = date && isDate(date) ? cycleAt(list, date) : null;
  const cycle = hit?.cycle ?? (date ? null : (list.at(-1) ?? null));

  useEffect(() => {
    if (date && hit && hit.cycle.start !== date) route(`/karta/${hit.cycle.start}`, true);
  }, [date, hit?.cycle.start]);

  if (!cycle) {
    return (
      <div class="flex flex-col gap-3">
        <Heading title={t('nav.chart')} />
        <p class="text-sm">{date ? t('chart.noCycleForDate') : t('chart.noCycles')}</p>
        <a href="/kalendarz" class="btn btn-outline min-h-11 rounded-full self-start">{t('nav.calendar')}</a>
      </div>
    );
  }
  return <CycleScreen key={cycle.id} cycle={cycle} today={now} />;
}

function CycleScreen({ cycle, today: now }: { cycle: Cycle; today: string }) {
  const [visible, setVisible] = useState<Record<SourceId, boolean>>({ '1': true, '2': true });
  const [mode, setMode] = useState<Mode>('normal');
  const [track, setTrack] = useState<Track>('mucus');
  const [markValue, setMarkValue] = useState<string | null>('P');
  const [note, setNote] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [source, setSource] = useState<SourceId>('1');
  const [fertilePick, setFertilePick] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { route } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = cycles.value;
  const index = list.findIndex((item) => item.id === cycle.id);
  const previous = list[index - 1];
  const next = list[index + 1];
  const summary = cycleSummary(data.value, list, cycle, now);
  const chartData = { days: data.value.days, temps: data.value.temps, sources: data.value.sources };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const scroller = scrollRef.current?.querySelector<HTMLElement>('[data-chart-scroll]');
      if (!scroller) return;
      const today = daysBetween(cycle.start, now);
      scroller.scrollLeft = Math.max(0, today * CHART.columnWidth + CHART.columnWidth / 2 - scroller.clientWidth / 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [cycle.id, now]);

  async function act(ops: ReturnType<typeof setEndDateOps> | Parameters<typeof save>[0]) {
    setMessage(null);
    const rejected = await save(ops);
    if (rejected.length > 0) setMessage(t('components.save.rejected'));
  }

  function onGridTap(tap: GridTap) {
    setMessage(null);
    if (tap.note) return setNote(tap.date);
    if (mode === 'normal') return route(`/wpis/${tap.date}`);
    if (mode === 'coverline' && tap.row === 'temp' && tap.value !== null) {
      return act([{ entity: 'cycle', key: cycle.id, set: { [`coverline_${source}`]: tap.value } }]);
    }
    if (mode === 'fertile') return tapFertile(tap.date);
    if (mode === 'marks') return tapMark(tap.date);
  }

  function tapFertile(date: string) {
    if (!fertilePick) {
      setFertilePick(date);
      return;
    }
    const [from, to] = fertilePick < date ? [fertilePick, date] : [date, fertilePick];
    setFertilePick(null);
    void act([{ entity: 'cycle', key: cycle.id, set: { fertile_start: from, fertile_end: to } }]);
  }

  function tapMark(date: string) {
    if (track !== 'mucus' && !data.value.temps[tempKey(date, track)]) {
      return setMessage(t('components.dayForm.noReadingForMark'));
    }
    const current = markOf(data.value, track, date);
    if (current === markValue) {
      void act(removeMarkOps(track, date));
      return;
    }
    if (!markValue) return;
    const ops = assignMarkOps(data.value, list, track, date, markValue);
    if ('error' in ops) return setMessage(t('components.save.noReading'));
    void act(ops);
  }

  const modeHint = mode === 'fertile' ? (fertilePick ? t('chart.hint.fertileEnd') : t('chart.hint.fertileStart')) : null;

  return (
    <div class="flex flex-col gap-4">
      <TokenBanner />
      <Heading title={t('nav.chart')} />
      <section class="card flex flex-row items-center justify-between gap-2 rounded-box border border-base-300 bg-base-100 p-3 print:hidden">
        {previous ? (
          <a href={`/karta/${previous.start}`} class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('chart.previousCycle')}>
            <ChevronLeft size={20} aria-hidden="true" />
          </a>
        ) : <span class="min-h-11 min-w-11" />}
        <div class="text-center">
          <p class="text-sm font-semibold">
            {t('chart.cycleNo', { n: cycle.number })} · {formatDate(cycle.start, 'short')} – {cycle.end ? formatDate(cycle.end, 'short') : t('chart.open')}
          </p>
          <p class="text-xs opacity-70">{t('chart.lengthDays', { n: summary.length })}{cycle.excluded ? ` · ${t('chart.excludedBadge')}` : ''}</p>
        </div>
        <div class="flex gap-1">
          <button type="button" class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('chart.cycleList')} onClick={() => setListOpen(true)}>
            <List size={20} aria-hidden="true" />
          </button>
          {next ? (
            <a href={`/karta/${next.start}`} class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('chart.nextCycle')}>
              <ChevronRight size={20} aria-hidden="true" />
            </a>
          ) : <span class="min-h-11 min-w-11" />}
        </div>
      </section>

      <div class="flex flex-wrap gap-2 print:hidden" role="group" aria-label={t('chart.sources')}>
        {SOURCE_IDS.map((id) => {
          const row = data.value.sources[id];
          return (
            <button key={id} type="button" aria-pressed={visible[id]} class={`btn btn-sm min-h-11 rounded-full ${visible[id] ? '' : 'btn-outline'}`} style={{ borderColor: row.color, color: visible[id] ? undefined : row.color }} onClick={() => setVisible({ ...visible, [id]: !visible[id] })}>
              <SourceMarker marker={row.marker} color={row.color} size={14} hollow={!visible[id]} />
              {row.name || t('source.defaultName', { n: id })}
            </button>
          );
        })}
      </div>

      <section class="card rounded-box border border-base-300 bg-base-100 p-2 print:hidden" ref={scrollRef}>
        <Chart cycle={cycle} data={chartData} today={now} visible={visible} mode="screen" onGridTap={onGridTap} />
      </section>

      {modeHint && <p class="alert rounded-box text-sm print:hidden">{modeHint}</p>}
      {message && <p role="alert" class="alert alert-warning rounded-box text-sm print:hidden">{message}</p>}

      <section class="card flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4 print:hidden">
        <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('chart.interpretation')}</h2>
        <PillChoice<Mode>
          options={['normal', 'coverline', 'fertile', 'marks'] as const}
          value={mode}
          label={(option) => t(`chart.mode.${option}`)}
          onChange={(value) => { setFertilePick(null); setMode(value ?? 'normal'); }}
          ariaLabel={t('chart.interpretation')}
        />
        {mode === 'coverline' && (
          <div class="flex flex-col gap-3">
            <PillChoice<SourceId> options={SOURCE_IDS} value={source} label={(id) => data.value.sources[id].name || t('source.defaultName', { n: id })} onChange={(value) => setSource(value ?? source)} ariaLabel={t('chart.coverlineSource')} />
            <CoverlineField cycle={cycle} source={source} onSave={(value) => act([{ entity: 'cycle', key: cycle.id, set: { [`coverline_${source}`]: value } }])} />
          </div>
        )}
        {mode === 'marks' && (
          <div class="flex flex-col gap-3">
            <PillChoice<Track> options={['mucus', '1', '2'] as const} value={track} label={(id) => (id === 'mucus' ? t('chart.track.mucus') : data.value.sources[id].name || t('source.defaultName', { n: id }))} onChange={(value) => setTrack(value ?? 'mucus')} ariaLabel={t('chart.track.title')} />
            <PillChoice<string> options={track === 'mucus' ? MUCUS_MARK : TEMP_MARK} value={markValue} label={(code) => code} onChange={(code) => code && setMarkValue(code)} ariaLabel={t('chart.track.title')} />
          </div>
        )}
      </section>

      <CycleSummary cycle={cycle} summary={summary} onInfo={() => setInfoOpen(true)} />
      <CycleFields cycle={cycle} onAct={act} />

      <div class="flex justify-end print:hidden">
        <button type="button" class="btn btn-outline min-h-11 rounded-full" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" />
          {t('chart.print')}
        </button>
      </div>

      <PrintSheet cycle={cycle} summary={summary} now={now} visible={visible} />

      {note && (
        <Modal title={t('chart.noteTitle', { date: formatDate(note, 'short') })} onClose={() => setNote(null)}>
          <p class="text-base">{data.value.days[note]?.chart_note}</p>
        </Modal>
      )}
      {listOpen && (
        <Modal title={t('chart.cycleList')} onClose={() => setListOpen(false)}>
          <ul class="flex flex-col gap-1">
            {list.map((item) => (
              <li key={item.id}>
                <a href={`/karta/${item.start}`} class="btn btn-ghost min-h-11 w-full justify-between rounded-box font-normal" onClick={() => setListOpen(false)}>
                  <span>{t('chart.cycleNo', { n: item.number })} · {formatDate(item.start, 'short')}</span>
                  <span class="tabular-nums opacity-70">
                    {item.excluded && <span class="badge badge-outline badge-sm mr-2">{t('chart.excludedBadge')}</span>}
                    {item.end ? formatNumber(daysBetween(item.start, item.end) + 1) : t('chart.open')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {infoOpen && <MucusInfo onClose={() => setInfoOpen(false)} />}
    </div>
  );
}

function CoverlineField({ cycle, source, onSave }: { cycle: Cycle; source: SourceId; onSave: (value: number) => void }) {
  const current = cycle.row[source === '1' ? 'coverline_1' : 'coverline_2'];
  const [text, setText] = useState(current === null ? '' : formatTemp(current));
  const parsed = parseTempInput(text);
  const valid = typeof parsed === 'number';
  return (
    <div class="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        aria-label={t('chart.coverline')}
        class="input w-full text-base tabular-nums"
        value={text}
        onInput={(event) => setText((event.target as HTMLInputElement).value)}
      />
      <button type="button" class="btn btn-primary min-h-11 rounded-full" disabled={!valid} onClick={() => valid && onSave(parsed)}>
        {t('components.save.button')}
      </button>
    </div>
  );
}

function summaryRows(cycle: Cycle, summary: CycleSummary): [string, string | null][] {
  const rows: [string, string | null][] = [
    [t('computed.cycleLength'), t('chart.lengthDays', { n: summary.length })],
    [t('computed.lastMenstruation'), summary.lastMenstruationDay ? formatDate(summary.lastMenstruationDay, 'short') : null],
    [t('computed.mucusPeak'), summary.mucusPeak ? `${formatDate(summary.mucusPeak, 'short')} · ${summary.mucusPeakCycleDay}` : null],
    [t('computed.mucusPeakPlus3'), summary.mucusPeakPlus3 ? formatDate(summary.mucusPeakPlus3, 'short') : null],
    [t('field.fertileDays'), cycle.row.fertile_start && cycle.row.fertile_end ? `${formatDate(cycle.row.fertile_start, 'short')} – ${formatDate(cycle.row.fertile_end, 'short')}` : null],
    [t('computed.shortestLongest', { n: data.value.settings.stats_n }), summary.cyclesUsed ? `${summary.shortest} / ${summary.longest} ${t('computed.fromCycles', { count: summary.cyclesUsed })}` : null],
    [t('computed.shortestMinus21'), summary.shortestMinus21 !== null ? String(summary.shortestMinus21) : null],
    [t('computed.shortestMinus20'), summary.shortestMinus20 !== null ? String(summary.shortestMinus20) : null],
    [t('computed.prevCycleRise'), summary.prevCycleRise === null ? null : summary.prevCycleRise ? t('components.yes') : t('components.no')],
  ];
  for (const source of SOURCE_IDS) {
    rows.push([`${t('computed.thirdHighDay')} · ${source}`, summary.thirdHighDay[source] ? formatDate(summary.thirdHighDay[source] as string, 'short') : null]);
    rows.push([`${t('computed.lutealLength')} · ${source}`, summary.lutealLength[source] !== null ? String(summary.lutealLength[source]) : null]);
  }
  return rows;
}

function CycleSummary({ cycle, summary, onInfo }: { cycle: Cycle; summary: CycleSummary; onInfo: () => void }) {
  const rows = summaryRows(cycle, summary);
  const outside = datesOutsideCycle(cycle);
  return (
    <section class="card flex flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-4 print:hidden">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('chart.summary')}</h2>
        <button type="button" class="btn btn-ghost btn-sm min-h-11" onClick={onInfo}>{t('components.dayForm.mucusInfo')}</button>
      </div>
      {cycle.excluded && <p class="alert alert-warning text-sm">{t('chart.excludedNotice')}</p>}
      <dl class="flex flex-col">
        {rows.map(([label, value]) => (
          <div key={label} class="flex justify-between gap-3 border-b border-base-300 py-2 text-sm last:border-0">
            <dt class="opacity-80">{label}</dt>
            <dd class="text-right font-semibold tabular-nums">{value ?? '–'}</dd>
          </div>
        ))}
      </dl>
      {outside.map((field) => (
        <p key={field} class="alert alert-warning text-sm">{t('warning.outside', { field: t(`field.${camel(field)}`) })}</p>
      ))}
      {summary.warnings.map((warning, i) => (
        <p key={i} class="alert alert-warning text-sm">
          {warning.kind === 'duplicate' ? t('warning.duplicate', { mark: warning.value ?? '' }) : t('warning.order')}
        </p>
      ))}
    </section>
  );
}

function camel(field: string): string {
  return field.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function CycleFields({ cycle, onAct }: { cycle: Cycle; onAct: (ops: Parameters<typeof save>[0]) => void }) {
  const [start, setStart] = useState(cycle.start);
  const [moveError, setMoveError] = useState<string | null>(null);
  const row = cycle.row;
  const set = (fields: Record<string, unknown>) => onAct([{ entity: 'cycle', key: cycle.id, set: fields }]);
  const riseValue = row.prev_cycle_rise === null ? 'auto' : row.prev_cycle_rise ? 'yes' : 'no';
  return (
    <section class="card flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4 print:hidden">
      <More title={t('chart.editCycle')} summary={null}>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold">{t('field.cycleStart')}</span>
          <div class="flex gap-2">
            <input type="date" class="input w-full text-base" value={start} onInput={(e) => setStart((e.target as HTMLInputElement).value)} />
            <button type="button" class="btn btn-outline min-h-11 rounded-full" onClick={() => {
              const ops = moveStartOps(data.value, cycle.id, start);
              if (Array.isArray(ops)) { setMoveError(null); onAct(ops); } else setMoveError(t(ops.error === 'neighbour' ? 'day1.neighbour' : 'day1.afterEnd'));
            }}>{t('day1.apply')}</button>
          </div>
          {moveError && <span class="text-sm text-error">{moveError}</span>}
        </label>
        <div class="flex items-end gap-2">
          <label class="flex flex-1 flex-col gap-1">
            <span class="text-sm font-semibold">{t('field.cycleEnd')}</span>
            <input type="date" class="input w-full text-base" value={row.end_date ?? ''} onChange={(e) => set({ end_date: (e.target as HTMLInputElement).value || null })} />
          </label>
          <button type="button" class="btn btn-ghost min-h-11" onClick={() => onAct(setEndDateOps(cycle.id, null))}>{t('components.clear')}</button>
        </div>
        <ToggleRow label={t('field.excludeFromStats')} checked={cycle.excluded} onChange={(checked) => set({ excluded_from_stats: checked })} />
        <FieldGroup title={t('field.intention')}>
          <PillChoice<Intention> options={INTENTION} value={row.intention} label={(code) => t(`codes.intention.${code}`)} onChange={(value) => set({ intention: value })} ariaLabel={t('field.intention')} />
        </FieldGroup>
        <DateField label={t('field.firstMucusDay')} value={row.first_mucus_day} suggestion={suggestFirstMucusDay(data.value, cycle)} onSave={(value) => set({ first_mucus_day: value })} />
        <DateField label={t('field.firstHfMucusDay')} value={row.first_hf_mucus_day} suggestion={suggestFirstHfMucusDay(data.value, cycle)} onSave={(value) => set({ first_hf_mucus_day: value })} />
        <DateField label={t('field.fertileStart')} value={row.fertile_start} onSave={(value) => set({ fertile_start: value })} />
        <DateField label={t('field.fertileEnd')} value={row.fertile_end} onSave={(value) => set({ fertile_end: value })} />
        <FieldGroup title={t('field.prevCycleRise')}>
          <PillChoice<string>
            options={['auto', 'yes', 'no'] as const}
            value={riseValue}
            label={(code) => t(`components.rise.${code}`)}
            onChange={(value) => set({ prev_cycle_rise: value === 'yes' ? true : value === 'no' ? false : null })}
            ariaLabel={t('field.prevCycleRise')}
          />
        </FieldGroup>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold">{t('field.cycleNotes')}</span>
          <textarea class="textarea w-full text-base" rows={2} defaultValue={row.notes ?? ''} onBlur={(e) => set({ notes: (e.target as HTMLTextAreaElement).value || null })} />
        </label>
      </More>
    </section>
  );
}

function DateField({ label, value, suggestion, onSave }: { label: string; value: string | null; suggestion?: string | null; onSave: (value: string | null) => void }) {
  return (
    <label class="flex flex-col gap-1">
      <span class="text-sm font-semibold">{label}</span>
      <div class="flex gap-2">
        <input type="date" class="input w-full text-base" value={value ?? ''} onChange={(e) => onSave((e.target as HTMLInputElement).value || null)} />
        {suggestion && <button type="button" class="btn btn-outline min-h-11 rounded-full" onClick={() => onSave(suggestion)}>{t('chart.confirm')}</button>}
      </div>
    </label>
  );
}

function PrintSheet({ cycle, summary, now, visible }: { cycle: Cycle; summary: CycleSummary; now: string; visible: Record<SourceId, boolean> }) {
  const chartData = { days: data.value.days, temps: data.value.temps, sources: data.value.sources };
  return (
    <div class="hidden print:block">
      <header class="flex items-baseline justify-between">
        <h1 class="text-lg font-bold">{t('chart.cycleNo', { n: cycle.number })} · {formatDate(cycle.start, 'short')} – {cycle.end ? formatDate(cycle.end, 'short') : t('chart.open')}</h1>
        <p class="text-sm">{t('chart.lengthDays', { n: summary.length })} {cycle.excluded ? `· ${t('chart.excludedBadge')}` : ''} · {formatDate(now, 'short')}</p>
      </header>
      <Chart cycle={cycle} data={chartData} today={now} visible={visible} mode="print" />
      <dl class="mt-1 grid grid-cols-3 gap-x-4 gap-y-0.5 text-[10px]">
        {summaryRows(cycle, summary).map(([label, value]) => (
          <div key={label} class="flex justify-between gap-2 border-b border-base-300">
            <dt>{label}</dt>
            <dd class="font-semibold tabular-nums">{value ?? '–'}</dd>
          </div>
        ))}
      </dl>
      <div class="mt-1 grid grid-cols-2 gap-3 text-[10px]">
        <div>
          <p class="font-semibold">{t('chart.legend')}</p>
          {SOURCE_IDS.map((id) => (
            <p key={id} class="flex items-center gap-2">
              <SourceMarker marker={data.value.sources[id].marker} color="#000" size={12} />
              {data.value.sources[id].name || t('source.defaultName', { n: id })} · {t(`codes.marker.${data.value.sources[id].marker}`)}
            </p>
          ))}
          <p>{t('chart.legendFertile')}</p>
          <p>{t('chart.legendBleeding')}</p>
        </div>
        <div>
          <p class="font-semibold">{t('chart.definitions')}</p>
          {(['stretchy', 'clear', 'sticky', 'cloudy'] as const).map((key) => (
            <p key={key}><span class="font-semibold">{t(`mucusDefinition.${key}.title`)}:</span> {t(`mucusDefinition.${key}.text`)}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
