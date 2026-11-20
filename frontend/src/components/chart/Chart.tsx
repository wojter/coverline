import { CHART, chartDays, chartHeight, columnCenter, curveSegments, mucusRowMatch, noteCharLimit, rowLayout, rowTint, tempBands, tempTicks, tempY, temperatureScale, truncateNote, valueAtY, type Reading, type RowKey, type TempScale } from './layout';
import { isFertileDay, type Cycle } from '../../domain/cycles';
import { SOURCE_IDS, type DayRow, type Marker, type SourceId, type SourceRow, type TempRow } from '../../domain/types';
import { formatTemp, t } from '../../i18n';

export interface GridTap {
  date: string;
  row: RowKey;
  value: number | null;
  note: boolean;
}

export interface ChartData {
  days: Record<string, DayRow | undefined>;
  temps: Record<string, TempRow | undefined>;
  sources: Record<SourceId, SourceRow>;
}

interface ChartProps {
  cycle: Cycle;
  data: ChartData;
  today: string;
  visible: Record<SourceId, boolean>;
  mode: 'screen' | 'print';
  onGridTap?: (tap: GridTap) => void;
}

interface Model {
  columns: string[];
  scale: TempScale;
  rows: ReturnType<typeof rowLayout>;
  height: number;
  width: number;
  readings: Record<SourceId, (Reading | undefined)[]>;
}

function inCycleRange(cycle: Cycle, date: string): boolean {
  return date >= cycle.start && (cycle.end === null || date <= cycle.end);
}

function buildModel(props: ChartProps): Model {
  const { cycle, data, today } = props;
  const columns = chartDays(cycle.start, cycle.end, today);
  const all: number[] = [];
  const readings = { '1': [], '2': [] } as Record<SourceId, (Reading | undefined)[]>;
  for (const source of SOURCE_IDS) {
    readings[source] = columns.map((date) => {
      if (!inCycleRange(cycle, date)) return undefined;
      const row = data.temps[`${date}/${source}`];
      if (row) all.push(row.value);
      return row ? { value: row.value, excluded: row.excluded } : undefined;
    });
  }
  const scale = temperatureScale(all);
  return {
    columns,
    scale,
    rows: rowLayout(scale),
    height: chartHeight(scale),
    width: columns.length * CHART.columnWidth,
    readings,
  };
}

export function labelFor(row: RowKey): string {
  const keys: Record<RowKey, string> = {
    date: 'chart.date',
    temp: 'chart.temperature',
    cycleDay: 'chart.cycleDay',
    bleeding: 'chart.bleeding',
    peak: 'chart.mucusPeak',
    wet: 'codes.sensation.wet',
    stretchy: 'codes.mucus_feature.stretchy',
    clear: 'codes.mucus_feature.clear',
    moist: 'codes.sensation.moist',
    sticky: 'codes.mucus_feature.sticky',
    cloudy: 'codes.mucus_feature.cloudy',
    dry: 'codes.sensation.dry',
    atypical: 'chart.atypical',
    ovulationPain: 'codes.symptom.ovulation_pain',
    breastTension: 'codes.symptom.breast_tension',
    fertile: 'chart.fertileDays',
    intercourse: 'chart.intercourse',
    disturbances: 'chart.disturbances',
  };
  return t(keys[row]);
}

export function Chart(props: ChartProps) {
  const model = buildModel(props);
  const labels = <LabelsLayer model={model} props={props} />;
  const grid = <GridLayer model={model} props={props} />;
  if (props.mode === 'print') {
    return (
      <svg viewBox={`0 0 ${CHART.labelWidth + model.width} ${model.height}`} width="100%" class="block" role="img" aria-label={t('chart.title')}>
        {labels}
        <g transform={`translate(${CHART.labelWidth} 0)`}>{grid}</g>
      </svg>
    );
  }
  return (
    <div class="flex">
      <svg width={CHART.labelWidth} height={model.height} class="shrink-0" aria-hidden="true">
        {labels}
      </svg>
      <div class="min-w-0 flex-1 overflow-x-auto" data-chart-scroll>
        <svg width={model.width} height={model.height} class="block" role="img" aria-label={t('chart.title')} onClick={(event) => handleTap(event, model, props)}>
          {grid}
        </svg>
      </div>
    </div>
  );
}

const MUCUS_GROUP_KEYS: ReadonlySet<RowKey> = new Set(['wet', 'stretchy', 'clear', 'moist', 'sticky', 'cloudy', 'dry']);

function LabelsLayer({ model }: { model: Model; props: ChartProps }) {
  const tempTop = rowTop(model, 'temp');
  const tempH = model.rows.find((row) => row.key === 'temp')?.height ?? 0;
  const scaleLeft = CHART.groupHeaderWidth;
  const scaleWidth = CHART.labelWidth - scaleLeft;
  const mucusTop = rowTop(model, 'wet');
  const mucusH = 7 * CHART.symbolRow;
  return (
    <g class="fill-base-content text-[10px]">
      <rect x="0" y={tempTop} width={scaleLeft} height={tempH} class="fill-base-content" fill-opacity={CHART.lightTint} />
      {tempBands(model.scale).map((band) => (
        <rect key={`band-${band.y}`} x={scaleLeft} y={tempTop + band.y} width={scaleWidth} height={band.height} class="fill-base-content" fill-opacity={CHART.lightTint} />
      ))}
      <rect x="0" y={mucusTop} width={CHART.groupHeaderWidth} height={mucusH} class="fill-base-content" fill-opacity={CHART.lightTint} />
      <RowTints model={model} width={CHART.labelWidth} mucusOffset={CHART.groupHeaderWidth} />
      {tempTicks(model.scale)
        .filter((tick) => tick.top > 0)
        .map((tick) => (
          <line key={`ltick-${tick.value}`} x1={scaleLeft} x2={CHART.labelWidth} y1={tempTop + tick.top} y2={tempTop + tick.top} stroke="var(--color-base-content)" stroke-opacity="0.35" stroke-width="0.75" />
        ))}
      <line x1={scaleLeft} x2={scaleLeft} y1={tempTop} y2={tempTop + tempH} stroke="var(--color-base-content)" stroke-opacity="0.45" stroke-width="0.75" />
      <line x1={CHART.groupHeaderWidth} x2={CHART.groupHeaderWidth} y1={mucusTop} y2={mucusTop + mucusH} stroke="var(--color-base-content)" stroke-opacity="0.45" stroke-width="0.75" />
      <RowLines model={model} width={CHART.labelWidth} mucusOffset={CHART.groupHeaderWidth} />
      <line x1="0.5" x2="0.5" y1="0" y2={model.height} stroke="var(--color-base-content)" stroke-opacity="0.5" stroke-width="1" />
      <line x1={CHART.labelWidth - 0.5} x2={CHART.labelWidth - 0.5} y1="0" y2={model.height} stroke="var(--color-base-content)" stroke-opacity="0.5" stroke-width="1" />
      <text transform={`translate(${scaleLeft / 2} ${tempTop + tempH / 2}) rotate(-90)`} text-anchor="middle" dominant-baseline="middle" class="text-[10px] font-bold tracking-wider uppercase">
        {labelFor('temp')}
      </text>
      <text transform={`translate(${CHART.groupHeaderWidth / 2} ${mucusTop + mucusH / 2}) rotate(-90)`} text-anchor="middle" dominant-baseline="middle" class="text-[10px] font-bold tracking-wider uppercase">
        {t('chart.track.mucus')}
      </text>
      {model.rows
        .filter((row) => row.key !== 'temp')
        .map((row) => {
          const y = row.y + row.height / 2;
          const bold = row.key === 'cycleDay' || row.key === 'peak' || row.key === 'fertile';
          const x = MUCUS_GROUP_KEYS.has(row.key) ? CHART.groupHeaderWidth + 5 : 6;
          return (
            <text key={row.key} x={x} y={y} dominant-baseline="middle" class={`text-[9.5px] ${bold ? 'font-bold' : 'font-medium'}`}>
              {labelFor(row.key)}
            </text>
          );
        })}
      {tempTicks(model.scale)
        .filter((tick) => tick.labelled)
        .map((tick) => (
          <text key={tick.value} x={scaleLeft + scaleWidth / 2} y={tempTop + tick.center} text-anchor="middle" dominant-baseline="middle" class="text-[8.5px] font-medium opacity-90 tabular-nums">
            {formatTemp(tick.value)}
          </text>
        ))}
    </g>
  );
}

function RowTints({ model, width, mucusOffset = 0 }: { model: Model; width: number; mucusOffset?: number }) {
  return (
    <g>
      {model.rows.map((row) => {
        const tint = rowTint(row.key);
        if (!tint) return null;
        const x = MUCUS_GROUP_KEYS.has(row.key) ? mucusOffset : 0;
        return <rect key={`tint-${row.key}`} x={x} y={row.y} width={width - x} height={row.height} class="fill-base-content" fill-opacity={tint.opacity} />;
      })}
    </g>
  );
}

const FRAMED_ROWS: ReadonlySet<RowKey> = new Set(['cycleDay', 'fertile']);

function RowLines({ model, width, mucusOffset = 0 }: { model: Model; width: number; mucusOffset?: number }) {
  return (
    <g>
      {model.rows.map((row, i) => {
        const prev = model.rows[i - 1];
        const strong = FRAMED_ROWS.has(row.key) || (prev !== undefined && FRAMED_ROWS.has(prev.key));
        const inset = MUCUS_GROUP_KEYS.has(row.key) && prev !== undefined && MUCUS_GROUP_KEYS.has(prev.key);
        const x1 = inset ? mucusOffset : 0;
        return (
          <line
            key={`sep-${row.key}`}
            x1={x1}
            x2={width}
            y1={row.y || 0.5}
            y2={row.y || 0.5}
            stroke="var(--color-base-content)"
            stroke-opacity={strong ? 0.85 : 0.42}
            stroke-width={strong ? 1.5 : 0.75}
          />
        );
      })}
      <line x1="0" x2={width} y1={model.height - 0.5} y2={model.height - 0.5} stroke="var(--color-base-content)" stroke-opacity="0.5" stroke-width="1" />
    </g>
  );
}

function rowTop(model: Model, key: RowKey): number {
  return model.rows.find((row) => row.key === key)?.y ?? 0;
}

function rowAt(model: Model, y: number): RowKey | null {
  return model.rows.find((row) => y >= row.y && y < row.y + row.height)?.key ?? null;
}

function handleTap(event: MouseEvent, model: Model, props: ChartProps) {
  if (!props.onGridTap) return;
  const svg = event.currentTarget as SVGSVGElement;
  const box = svg.getBoundingClientRect();
  const x = event.clientX - box.left;
  const y = event.clientY - box.top;
  const index = Math.floor(x / CHART.columnWidth);
  const date = model.columns[index];
  if (!date) return;
  const row = rowAt(model, y) ?? 'date';
  const note = Boolean(props.data.days[date]?.chart_note) && row === 'temp' && y - rowTop(model, 'temp') < noteExtent(props.data.days[date]?.chart_note ?? '');
  const value = row === 'temp' ? valueAtY(model.scale, y - rowTop(model, 'temp')) : null;
  props.onGridTap({ date, row, value, note });
}

function noteExtent(note: string): number {
  return Math.min(note.length * CHART.noteFontSize * 0.6 + 8, 300);
}

function GridLayer({ model, props }: { model: Model; props: ChartProps }) {
  const { cycle, data, today, visible, mode } = props;
  const tempTop = rowTop(model, 'temp');
  const tempHeight = model.rows.find((row) => row.key === 'temp')?.height ?? 0;
  const W = CHART.columnWidth;
  const H = model.height;
  return (
    <g>
      <defs>
        <pattern id="fertile-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-base-content)" stroke-opacity="0.45" stroke-width="1.2" />
        </pattern>
      </defs>
      {tempBands(model.scale).map((band) => (
        <rect key={`band-${band.y}`} x="0" y={tempTop + band.y} width={model.width} height={band.height} class="fill-base-content" fill-opacity={CHART.lightTint} />
      ))}
      <RowTints model={model} width={model.width} />
      {model.columns.map((date, index) => {
        const x = index * W;
        const fertileY = rowTop(model, 'fertile');
        return (
          <g key={`col-${date}`}>
            {isFertileDay(cycle, date) && <rect x={x} y={fertileY} width={W} height={CHART.symbolRow} fill="url(#fertile-hatch)" />}
            {date === today && <rect class="print:hidden" x={x + 1} y="1" width={W - 2} height={H - 2} fill="none" stroke="var(--color-primary)" stroke-width="1.5" />}
          </g>
        );
      })}
      {tempTicks(model.scale)
        .filter((tick) => tick.top > 0)
        .map((tick) => (
          <line key={`tick-${tick.value}`} x1="0" x2={model.width} y1={tempTop + tick.top} y2={tempTop + tick.top} stroke="var(--color-base-content)" stroke-opacity="0.32" stroke-width="0.75" />
        ))}
      {model.columns.map((date, index) =>
        index > 0 ? <line key={`day-${date}`} x1={index * W} x2={index * W} y1="0" y2={H} stroke="var(--color-base-content)" stroke-opacity="0.4" stroke-width="0.75" /> : null,
      )}
      <line x1={model.width - 0.5} x2={model.width - 0.5} y1="0" y2={H} stroke="var(--color-base-content)" stroke-opacity="0.5" stroke-width="1" />
      <RowLines model={model} width={model.width} />
      {SOURCE_IDS.filter((s) => visible[s]).map((source) => {
        const coverline = cycle.row[source === '1' ? 'coverline_1' : 'coverline_2'];
        if (coverline === null) return null;
        const y = tempTop + tempY(model.scale, coverline);
        return <line key={`cover-${source}`} x1="0" x2={model.width} y1={y} y2={y} stroke={data.sources[source].color} stroke-width="1.5" stroke-dasharray={source === '1' ? '6 4' : '2 3'} />;
      })}
      {model.columns.map((date, index) => {
        if (!inCycleRange(cycle, date)) return null;
        const note = data.days[date]?.chart_note;
        if (!note) return null;
        const limit = noteCharLimit(tempHeight);
        return (
          <text key={`note-${date}`} transform={`translate(${columnCenter(index) + 3} ${tempTop + 4}) rotate(-90)`} text-anchor="end" dominant-baseline="middle" font-size={CHART.noteFontSize} font-weight="600" class="fill-base-content opacity-75">
            {truncateNote(note, limit)}
          </text>
        );
      })}
      {SOURCE_IDS.filter((s) => visible[s]).map((source) =>
        curveSegments(model.readings[source], (value) => tempTop + tempY(model.scale, value)).map((segment, i) => (
          <polyline key={`curve-${source}-${i}`} points={segment.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={data.sources[source].color} stroke-width="1.5" stroke-dasharray={mode === 'print' && source === '2' ? '5 3' : undefined} />
        )),
      )}
      {SOURCE_IDS.filter((s) => visible[s]).map((source) =>
        model.columns.map((date, index) => {
          const reading = model.readings[source][index];
          if (!reading) return null;
          const cx = columnCenter(index);
          const cy = tempTop + tempY(model.scale, reading.value);
          const row = data.sources[source];
          const mark = data.temps[`${date}/${source}`]?.mark ?? null;
          const disturbed = (data.days[date]?.disturbances ?? []).length > 0;
          return (
            <g key={`point-${source}-${date}`}>
              {disturbed && <circle cx={cx} cy={cy} r="4.5" fill="none" stroke="var(--color-base-content)" stroke-width="1" stroke-dasharray="2 2" />}
              <Shape marker={row.marker} x={cx} y={cy} size={2.5} fill={reading.excluded ? 'var(--color-base-100)' : row.color} stroke={row.color} />
              {mark && (
                <text x={cx} y={cy - 5} text-anchor="middle" font-size="9" font-weight="700" fill={row.color}>
                  {mark}
                </text>
              )}
            </g>
          );
        }),
      )}
      {model.columns.map((date, index) => (
        <RowSymbols key={`sym-${date}`} date={date} index={index} model={model} data={data} cycle={cycle} />
      ))}
    </g>
  );
}

function intercourseSymbol(day: DayRow | undefined): string | null {
  const hasMorning = day?.intercourse?.includes('morning') ?? false;
  const hasEvening = day?.intercourse?.includes('evening') ?? false;
  if (hasMorning && hasEvening) return 'X/X';
  if (hasMorning) return 'X/';
  if (hasEvening) return '/X';
  return null;
}

function RowSymbols({ date, index, model, data, cycle }: { date: string; index: number; model: Model; data: ChartData; cycle: Cycle }) {
  const inCycle = inCycleRange(cycle, date);
  const day = inCycle ? data.days[date] : undefined;
  const cx = columnCenter(index);
  const y = (key: RowKey) => rowTop(model, key) + CHART.symbolRow / 2;
  const cycleDay = index + 1;
  const intercourse = intercourseSymbol(day);
  return (
    <g>
      <text x={cx} y={y('cycleDay')} text-anchor="middle" dominant-baseline="middle" font-size="10" class="fill-base-content tabular-nums">
        {cycleDay}
      </text>
      {inCycle && (
        <text x={cx} y={y('date')} text-anchor="middle" dominant-baseline="middle" font-size="9" class="fill-base-content tabular-nums">
          {date.slice(8)}
        </text>
      )}
      {day?.bleeding && (
        <text x={cx} y={y('bleeding')} text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" class="fill-base-content">
          {t(`codes.bleedingSymbol.${day.bleeding}`)}
        </text>
      )}
      {day?.mark_mucus && (
        <text x={cx} y={y('peak')} text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" class="fill-base-content">
          {day.mark_mucus}
        </text>
      )}
      {(['wet', 'stretchy', 'clear', 'moist', 'sticky', 'cloudy', 'dry'] as RowKey[]).map((key) =>
        day && mucusRowMatch(key, day) ? <circle key={key} cx={cx} cy={y(key)} r="3" class="fill-base-content" /> : null,
      )}
      {day?.mucus_atypical === true && <path d={`M ${cx} ${y('atypical') - 4} L ${cx + 4} ${y('atypical')} L ${cx} ${y('atypical') + 4} L ${cx - 4} ${y('atypical')} Z`} class="fill-base-content" />}
      {day?.symptoms?.includes('ovulation_pain') && <circle cx={cx} cy={y('ovulationPain')} r="3" class="fill-base-content" />}
      {day?.symptoms?.includes('breast_tension') && <path d={`M ${cx} ${y('breastTension') - 3.5} L ${cx + 3.5} ${y('breastTension') + 3} L ${cx - 3.5} ${y('breastTension') + 3} Z`} class="fill-base-content" />}
      {intercourse && (
        <text x={cx} y={y('intercourse')} text-anchor="middle" dominant-baseline="middle" font-size="9.5" font-weight="700" class="fill-base-content">
          {intercourse}
        </text>
      )}
      {(day?.disturbances ?? []).length > 0 && <circle cx={cx} cy={y('disturbances')} r="3.5" fill="none" class="stroke-base-content" stroke-width="1.5" />}
    </g>
  );
}

function Shape({ marker, x, y, size, fill, stroke }: { marker: Marker; x: number; y: number; size: number; fill: string; stroke: string }) {
  const common = { fill, stroke, 'stroke-width': 1 };
  if (marker === 'square') return <rect x={x - size * 0.8} y={y - size * 0.8} width={size * 1.6} height={size * 1.6} {...common} />;
  if (marker === 'triangle') return <path d={`M ${x} ${y - size - 1} L ${x + size + 1} ${y + size} L ${x - size - 1} ${y + size} Z`} {...common} />;
  if (marker === 'diamond') return <path d={`M ${x} ${y - size - 1} L ${x + size + 1} ${y} L ${x} ${y + size + 1} L ${x - size - 1} ${y} Z`} {...common} />;
  return <circle cx={x} cy={y} r={size} {...common} />;
}
