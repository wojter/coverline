import { useMemo, useRef, useState } from 'preact/hooks';
import { Info } from 'lucide-preact';
import { PillChoice, SingleTileChoice, TileChoice } from './Chips';
import { FieldGroup } from './FieldGroup';
import { More } from './More';
import { MucusInfo } from './MucusInfo';
import { TempInput } from './TempInput';
import { ToggleRow } from './ToggleRow';
import { BLEED_BG } from './tokens';
import type { DayDraft } from './useDayDraft';
import type { Track } from '../domain/marks';
import { BLEEDING, DISTURBANCE, INTERCOURSE, MUCUS_FEATURE, MUCUS_MARK, MUCUS_QUALITY, SENSATION, SOURCE_IDS, SYMPTOM, TEMP_MARK, type SourceId } from '../domain/types';
import { derivedMucusQuality, mucusQuality } from '../domain/derive';
import { data } from '../data/state';
import { t } from '../i18n';

const LENGTH_LIMIT = 30;

export function DayForm({ draft, variant, day1 }: { draft: DayDraft; variant: 'full' | 'quick'; day1: { checked: boolean; onToggle: () => void } }) {
  const full = variant === 'full';
  const [infoOpen, setInfoOpen] = useState(false);
  const secondRef = useRef<HTMLInputElement>(null);
  const day = draft.day;
  const derived = derivedMucusQuality(day);
  const quality = mucusQuality(day);
  const overridden = day.mucus_quality_override !== null;
  const hasTemp = (source: SourceId) => draft.temp(source).hasReading || draft.temp(source).text !== '';

  return (
    <div class="flex flex-col gap-4">
      <section class="card flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4">
        <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('components.dayForm.temperature')}</h2>
        {SOURCE_IDS.map((source) => {
          const temp = draft.temp(source);
          return (
            <TempInput
              key={source}
              source={source}
              row={data.value.sources[source]}
              text={temp.text}
              excluded={temp.excluded}
              hasReading={temp.hasReading}
              onText={(text) => draft.setTemp(source, { text, clear: false })}
              onExclude={(excluded) => draft.setTemp(source, { excluded })}
              onClear={() => draft.clearTemp(source)}
              onCommit={() => void draft.commit()}
              onEnter={source === '1' ? () => secondRef.current?.focus() : undefined}
              inputRef={source === '2' ? secondRef : undefined}
            />
          );
        })}
        <div class="flex flex-col gap-2">
          <ToggleRow label={t('field.cycleDay1')} checked={day1.checked} onChange={day1.onToggle} />
        </div>
      </section>

      <section class="card flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4">
        {full && (
          <FieldGroup title={t('components.dayForm.bleeding')}>
            <PillChoice
              options={BLEEDING}
              value={day.bleeding}
              label={(code) => t(`codes.bleeding.${code}`)}
              activeClass={(code) => BLEED_BG[code]}
              onChange={(value) => draft.setField('bleeding', value)}
              ariaLabel={t('field.bleeding')}
            />
          </FieldGroup>
        )}
        <FieldGroup title={t('components.dayForm.mucus')}>
          <p class="text-sm font-semibold">{t('field.sensation')}</p>
          <SingleTileChoice
            options={SENSATION}
            value={day.mucus_sensation}
            label={(code) => t(`codes.sensation.${code}`)}
            onChange={(value) => draft.setField('mucus_sensation', value)}
            ariaLabel={t('field.sensation')}
          />
          <p class="text-sm font-semibold">{t('field.mucusFeatures')}</p>
          <TileChoice
            options={MUCUS_FEATURE}
            value={day.mucus_features}
            label={(code) => t(`codes.mucus_feature.${code}`)}
            onChange={(value) => draft.setField('mucus_features', value)}
            ariaLabel={t('field.mucusFeatures')}
          />
          <ToggleRow label={t('field.atypical')} checked={day.mucus_atypical === true} onChange={(checked) => draft.setField('mucus_atypical', checked)} />
          {full && (
            <div class="flex flex-col gap-2 rounded-box bg-base-200 p-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-semibold">{t('field.mucusQuality')}</span>
                <span class={`badge ${overridden ? 'badge-warning' : 'badge-ghost'}`}>
                  {quality ? t(`codes.mucus_quality.${quality}`) : t('components.dayForm.qualityEmpty')}
                </span>
                <span class="badge badge-outline badge-sm">{overridden ? t('components.dayForm.changed') : t('components.dayForm.auto')}</span>
                <button type="button" class="btn btn-ghost btn-sm min-h-11" aria-label={t('components.dayForm.mucusInfo')} onClick={() => setInfoOpen(true)}>
                  <Info size={18} aria-hidden="true" />
                </button>
              </div>
              <SingleTileChoice
                options={MUCUS_QUALITY}
                value={day.mucus_quality_override}
                label={(code) => t(`codes.mucus_quality.${code}`)}
                onChange={(value) => draft.setField('mucus_quality_override', value)}
                ariaLabel={t('field.mucusQuality')}
              />
              {overridden && (
                <button type="button" class="btn btn-ghost btn-sm min-h-11 self-start" onClick={() => draft.setField('mucus_quality_override', null)}>
                  {t('components.dayForm.reset')} ({t(`codes.mucus_quality.${derived ?? 'none'}`)})
                </button>
              )}
            </div>
          )}
        </FieldGroup>
        {full && (
          <FieldGroup title={t('components.dayForm.symptoms')}>
            <TileChoice options={SYMPTOM} value={day.symptoms} label={(code) => t(`codes.symptom.${code}`)} onChange={(value) => draft.setField('symptoms', value)} ariaLabel={t('field.symptoms')} />
          </FieldGroup>
        )}
        {full && (
          <FieldGroup title={t('field.intercourse')}>
            <TileChoice options={INTERCOURSE} value={day.intercourse} label={(code) => t(`codes.intercourse.${code}`)} onChange={(value) => draft.setField('intercourse', value)} ariaLabel={t('field.intercourse')} />
          </FieldGroup>
        )}
        {full ? (
          <FieldGroup title={t('field.disturbances')}>
            <TileChoice options={DISTURBANCE} value={day.disturbances} label={(code) => t(`codes.disturbance.${code}`)} onChange={(value) => draft.setField('disturbances', value)} ariaLabel={t('field.disturbances')} />
          </FieldGroup>
        ) : (
          <More title={t('field.disturbances')} summary={day.disturbances ? day.disturbances.map((code) => t(`codes.disturbance.${code}`)).join(', ') : null}>
            <TileChoice options={DISTURBANCE} value={day.disturbances} label={(code) => t(`codes.disturbance.${code}`)} onChange={(value) => draft.setField('disturbances', value)} ariaLabel={t('field.disturbances')} />
          </More>
        )}
      </section>

      {full && <MarksSection draft={draft} hasTemp={hasTemp} />}
      {full && <NotesSection draft={draft} />}
      {infoOpen && <MucusInfo onClose={() => setInfoOpen(false)} />}
    </div>
  );
}

function MarksSection({ draft, hasTemp }: { draft: DayDraft; hasTemp: (source: SourceId) => boolean }) {
  return (
    <section class="card flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4">
      <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('components.dayForm.marks')}</h2>
      <FieldGroup title={t('field.markMucus')}>
        <PillChoice<string>
          options={MUCUS_MARK}
          value={draft.markValue('mucus')}
          label={(code) => code}
          onChange={(value) => draft.setMark('mucus', value)}
          ariaLabel={t('field.markMucus')}
        />
      </FieldGroup>
      {SOURCE_IDS.map((source) => (
        <FieldGroup key={source} title={`${t('field.markTemp')} · ${data.value.sources[source].name || t('source.defaultName', { n: source })}`}>
          <PillChoice<string>
            options={TEMP_MARK}
            value={draft.markValue(source as Track)}
            label={(code) => code}
            onChange={(value) => draft.setMark(source, value)}
            disabled={() => !hasTemp(source)}
            ariaLabel={t('field.markTemp')}
          />
          {!hasTemp(source) && <p class="text-xs opacity-70">{t('components.dayForm.noReadingForMark')}</p>}
        </FieldGroup>
      ))}
    </section>
  );
}

function NotesSection({ draft }: { draft: DayDraft }) {
  const note = draft.day.chart_note ?? '';
  const length = useMemo(() => [...note].length, [note]);
  return (
    <section class="card flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4">
      <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{t('components.dayForm.commentAndNotes')}</h2>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-semibold">{t('field.chartNote')}</span>
        <input
          type="text"
          class="input w-full"
          value={note}
          onInput={(event) => {
            const value = [...(event.target as HTMLInputElement).value].slice(0, LENGTH_LIMIT).join('');
            draft.typeField('chart_note', value);
          }}
          onBlur={() => void draft.commit()}
        />
        <span class="self-end text-xs tabular-nums opacity-70">{t('components.dayForm.counter', { count: length, max: LENGTH_LIMIT })}</span>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-semibold">{t('field.notes')}</span>
        <textarea class="textarea w-full" rows={3} value={draft.day.notes ?? ''} onInput={(event) => draft.typeField('notes', (event.target as HTMLTextAreaElement).value)} onBlur={() => void draft.commit()} />
      </label>
    </section>
  );
}
