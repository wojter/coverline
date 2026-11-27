import type { Ref } from 'preact';
import { X } from 'lucide-preact';
import { ToggleRow } from './ToggleRow';
import { SourceMarker } from './SourceMarker';
import { isInRange, parseTempInput } from '../domain/tempInput';
import type { Marker, SourceId, SourceRow } from '../domain/types';
import { formatTemp, t } from '../i18n';

interface TempInputProps {
  source: SourceId;
  row: SourceRow;
  text: string;
  excluded: boolean;
  hasReading: boolean;
  onText: (text: string) => void;
  onExclude: (excluded: boolean) => void;
  onClear: () => void;
  onEnter?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function TempInput(props: TempInputProps) {
  const { source, row, text, excluded, hasReading } = props;
  const name = row.name || t('source.defaultName', { n: source });
  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <SourceMarker marker={row.marker as Marker} color={row.color} />
          <span class="truncate font-semibold">{name}</span>
          <span class="shrink-0 text-xs opacity-70">{t(`codes.site.${row.site}`)}</span>
        </div>
        <label class="flex shrink-0 items-center gap-2 text-sm">
          {t('field.excludeReading')}
          <input type="checkbox" class="toggle toggle-primary" checked={excluded} disabled={!hasReading && text === ''} onChange={(event) => props.onExclude((event.target as HTMLInputElement).checked)} />
        </label>
      </div>
      <div class="flex items-center gap-2">
        <input
          ref={props.inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={`${name} ${t('field.temperature')}`}
          placeholder="36,50"
          class="input input-lg min-h-12 w-full text-3xl tabular-nums placeholder:text-base-content/30"
          value={text}
          onInput={(event) => props.onText((event.target as HTMLInputElement).value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && props.onEnter) {
              event.preventDefault();
              props.onEnter();
            }
          }}
        />
        <button
          type="button"
          class="btn btn-ghost btn-circle min-h-11 min-w-11"
          aria-label={t('components.temp.clear')}
          disabled={!hasReading && text === ''}
          onClick={props.onClear}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <TempMessage row={row} text={text} />
    </div>
  );
}

function TempMessage({ row, text }: { row: SourceRow; text: string }) {
  const parsed = parseTempInput(text);
  if (parsed === 'invalid') return <p class="text-sm text-error">{t('components.temp.invalid')}</p>;
  if (typeof parsed === 'number' && !isInRange(row, parsed)) {
    return (
      <p class="text-sm text-error">
        {t('components.temp.outOfRange', { min: formatTemp(row.range_min), max: formatTemp(row.range_max) })}
      </p>
    );
  }
  return null;
}
