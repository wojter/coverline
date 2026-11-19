import { useMemo } from 'preact/hooks';
import { t } from '../i18n';

export interface RingSegment {
  start: number;
  end: number;
  className: string;
}

interface RingProps {
  compact?: boolean;
  cycleDay: number | null;
  average: number | null;
  intention: string | null;
  segments: RingSegment[];
  fertile: RingSegment | null;
}

const CENTER = 100;
const RADIUS = 86;

function point(fraction: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + fraction * 2 * Math.PI;
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
}

function arcPath(from: number, to: number): string {
  const a = point(from);
  const b = point(to);
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${b.x} ${b.y}`;
}

// Day positions are fractions of the average cycle. Anything past the average keeps the ring full.
function span(segment: RingSegment, average: number): [number, number] | null {
  const from = Math.min(segment.start / average, 1);
  const to = Math.min(segment.end / average, 1);
  return to > from ? [from, to] : null;
}

export function CycleRing({ compact = false, cycleDay, average, intention, segments, fertile }: RingProps) {
  const progress = useMemo(() => {
    if (cycleDay === null || average === null || average <= 0) return null;
    return Math.min(cycleDay / average, 1);
  }, [cycleDay, average]);

  return (
    <div class={`relative mx-auto aspect-square w-full ${compact ? 'max-w-44' : 'max-w-64'}`}>
      <svg viewBox="0 0 200 200" class="h-full w-full" role="img" aria-label={t('computed.cycleDayLabel')}>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-base-300)" stroke-width="14" />
        {average !== null && fertile && span(fertile, average) && (
          <path d={arcPath(...(span(fertile, average) as [number, number]))} fill="none" class="stroke-fertile" stroke-width="14" />
        )}
        {average !== null &&
          segments.map((segment) => {
            const range = span(segment, average);
            if (!range) return null;
            return <path key={`${segment.start}-${segment.className}`} d={arcPath(...range)} fill="none" class={segment.className} stroke-width="14" />;
          })}
        {progress !== null && progress > 0 && (
          <path d={arcPath(0, progress)} fill="none" stroke="var(--color-primary)" stroke-width="4" stroke-linecap="round" opacity="0.85" />
        )}
        {progress !== null && (
          <circle cx={point(progress).x} cy={point(progress).y} r="9" fill="var(--color-base-100)" stroke="var(--color-primary)" stroke-width="3" />
        )}
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
        {cycleDay === null ? (
          <span class="px-6 text-sm font-semibold">{t('computed.noCycle')}</span>
        ) : (
          <>
            <span class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('computed.cycleDayLabel')}</span>
            <span class="text-5xl font-semibold tabular-nums">{cycleDay}</span>
            {intention && <span class="text-sm opacity-80">{t(`codes.intention.${intention}`)}</span>}
          </>
        )}
      </div>
    </div>
  );
}
