import { useState } from 'preact/hooks';
import { Heading } from '../components/Heading';
import { SourceMarker } from '../components/SourceMarker';
import { PillChoice } from '../components/Chips';
import { FieldGroup } from '../components/FieldGroup';
import { SOURCE_SWATCHES } from '../components/tokens';
import { downloadBlob } from '../components/download';
import { connect, changeLanguage, changeTheme, disconnect, exportJson, retryFailed, discardFailed, save, syncNow } from '../data/store';
import { cycles, data, device, failed, lastSaved, meta, outbox, syncState, theme } from '../data/state';
import { buildCsv } from '../domain/csv';
import { defaultRange } from '../domain/tempInput';
import { INTENTION, MARKER, SITE, SOURCE_IDS, type Intention, type Marker, type Site, type SourceId } from '../domain/types';
import { formatTemp, lang, t, type Lang } from '../i18n';
import { parseTempInput } from '../domain/tempInput';

import type { Theme } from '../data/db';
import { today } from '../domain/dates';

export default function Settings() {
  return (
    <div class="flex flex-col gap-4">
      <Heading title={t('settings.title')} />
      <SourcesCard />
      <LanguageCard />
      <ThemeCard />
      <CycleCard />
      <DataCard />
      <ConnectionCard />
    </div>
  );
}

function Card({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section class="card flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4">
      <h2 class="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</h2>
      {children}
    </section>
  );
}

function SourcesCard() {
  return (
    <Card title={t('settings.sources.title')}>
      {SOURCE_IDS.map((id) => (
        <SourceEditor key={id} id={id} />
      ))}
    </Card>
  );
}

function SourceEditor({ id }: { id: SourceId }) {
  const row = data.value.sources[id];
  const [name, setName] = useState(row.name);
  const [rangeMin, setRangeMin] = useState(formatTemp(row.range_min));
  const [rangeMax, setRangeMax] = useState(formatTemp(row.range_max));
  const [rangeError, setRangeError] = useState<string | null>(null);
  const put = (set: Record<string, unknown>) => void save([{ entity: 'source', key: id, set }]);

  function applyRange() {
    const min = parseTempInput(rangeMin);
    const max = parseTempInput(rangeMax);
    if (typeof min !== 'number' || typeof max !== 'number' || min >= max) {
      return setRangeError(t('settings.sources.rangeInvalid'));
    }
    setRangeError(null);
    put({ range_min: min, range_max: max });
  }

  return (
    <div class="flex flex-col gap-3 rounded-box bg-base-200 p-3">
      <div class="flex items-center gap-2">
        <SourceMarker marker={row.marker} color={row.color} />
        <span class="font-semibold">{row.name || t('source.defaultName', { n: id })}</span>
      </div>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-semibold">{t('settings.sources.name')}</span>
        <input type="text" class="input w-full text-base" placeholder={t('source.defaultName', { n: id })} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={(event) => {
          const value = (event.target as HTMLInputElement).value;
          if (value !== row.name) put({ name: value });
        }} />
      </label>
      <FieldGroup title={t('settings.sources.site')}>
        <PillChoice<Site>
          options={SITE}
          value={row.site}
          label={(code) => t(`codes.site.${code}`)}
          onChange={(site) => {
            if (!site || site === row.site) return;
            const range = defaultRange(site);
            put({ site, range_min: range.min, range_max: range.max });
          }}
          ariaLabel={t('settings.sources.site')}
        />
        <p class="text-xs opacity-70">{t('settings.sources.siteHint')}</p>
      </FieldGroup>
      <FieldGroup title={t('settings.sources.colour')}>
        <div class="flex flex-wrap gap-2" role="group" aria-label={t('settings.sources.colour')}>
          {SOURCE_SWATCHES.map((color) => (
            <button key={color} type="button" aria-label={color} aria-pressed={row.color === color} class={`h-11 w-11 rounded-full border-2 ${row.color === color ? 'border-base-content' : 'border-base-300'}`} style={{ backgroundColor: color }} onClick={() => put({ color })} />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup title={t('settings.sources.marker')}>
        <PillChoice<Marker>
          options={MARKER}
          value={row.marker}
          label={(code) => t(`codes.marker.${code}`)}
          onChange={(marker) => marker && put({ marker })}
          ariaLabel={t('settings.sources.marker')}
        />
      </FieldGroup>
      <FieldGroup title={t('settings.sources.range')}>
        <div class="grid grid-cols-2 gap-2">
          <input type="text" inputMode="decimal" aria-label={t('settings.sources.min')} class="input w-full text-base tabular-nums" value={rangeMin} onInput={(e) => setRangeMin((e.target as HTMLInputElement).value)} />
          <input type="text" inputMode="decimal" aria-label={t('settings.sources.max')} class="input w-full text-base tabular-nums" value={rangeMax} onInput={(e) => setRangeMax((e.target as HTMLInputElement).value)} />
        </div>
        {rangeError && <p class="text-sm text-error">{rangeError}</p>}
        <button type="button" class="btn btn-outline min-h-11 rounded-full self-start" onClick={applyRange}>{t('settings.sources.applyRange')}</button>
      </FieldGroup>
    </div>
  );
}

function LanguageCard() {
  return (
    <Card title={t('language.title')}>
      <PillChoice<Lang>
        options={['en', 'pl'] as const}
        value={lang.value}
        label={(code) => t(`language.${code}`)}
        onChange={(code) => code && void changeLanguage(code)}
        ariaLabel={t('language.title')}
      />
    </Card>
  );
}

function ThemeCard() {
  return (
    <Card title={t('theme.title')}>
      <PillChoice<Theme>
        options={['system', 'light', 'dark'] as const}
        value={theme.value}
        label={(code) => t(`theme.${code}`)}
        onChange={(code) => code && void changeTheme(code)}
        ariaLabel={t('theme.title')}
      />
    </Card>
  );
}

function CycleCard() {
  const [cycleStart, setCycleStart] = useState(String(data.value.settings.cycle_number_start));
  const [statsN, setStatsN] = useState(String(data.value.settings.stats_n));
  const settings = data.value.settings;
  const setting = (key: string, value: unknown) => void save([{ entity: 'setting', key, set: { value } }]);
  return (
    <Card title={t('settings.cycle.title')}>
      <FieldGroup title={t('settings.cycle.intention')}>
        <PillChoice<Intention>
          options={INTENTION}
          value={settings.default_intention}
          label={(code) => t(`codes.intention.${code}`)}
          onChange={(code) => setting('default_intention', code)}
          ariaLabel={t('settings.cycle.intention')}
        />
        <p class="text-xs opacity-70">{t('settings.cycle.intentionHint')}</p>
      </FieldGroup>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-semibold">{t('settings.cycle.startNumber')}</span>
        <div class="flex gap-2">
          <input type="number" min="1" inputMode="numeric" class="input w-full text-base tabular-nums" value={cycleStart} onInput={(e) => setCycleStart((e.target as HTMLInputElement).value)} />
          <button type="button" class="btn btn-outline min-h-11 rounded-full" onClick={() => setting('cycle_number_start', Number(cycleStart))}>{t('components.save.button')}</button>
        </div>
        <p class="text-xs opacity-70">{t('settings.cycle.startNumberHint')}</p>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-semibold">{t('settings.cycle.statsN')}</span>
        <div class="flex gap-2">
          <input type="number" min="1" inputMode="numeric" class="input w-full text-base tabular-nums" value={statsN} onInput={(e) => setStatsN((e.target as HTMLInputElement).value)} />
          <button type="button" class="btn btn-outline min-h-11 rounded-full" onClick={() => setting('stats_n', Number(statsN))}>{t('components.save.button')}</button>
        </div>
        <p class="text-xs opacity-70">{t('settings.cycle.statsNHint')}</p>
      </label>
    </Card>
  );
}

function DataCard() {
  const [jsonError, setJsonError] = useState<string | null>(null);
  const connected = Boolean(meta.value.token);
  const stamp = today();
  function csv() {
    const label = (key: string) => t(key);
    const sourceName = (s: SourceId) => data.value.sources[s].name || t('source.defaultName', { n: s });
    const text = buildCsv(data.value, cycles.value, lang.value, label, sourceName);
    downloadBlob(`coverline-${stamp}.csv`, new Blob([text], { type: 'text/csv;charset=utf-8' }));
  }
  async function json() {
    try {
      setJsonError(null);
      const text = await exportJson();
      downloadBlob(`coverline-${stamp}.json`, new Blob([text], { type: 'application/json' }));
    } catch {
      setJsonError(t('settings.data.jsonError'));
    }
  }
  return (
    <Card title={t('settings.data.title')}>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-outline min-h-11 rounded-full" onClick={csv}>{t('settings.data.csv')}</button>
        <button type="button" class="btn btn-outline min-h-11 rounded-full" disabled={!connected} onClick={() => void json()}>{t('settings.data.json')}</button>
      </div>
      {!connected && <p class="text-xs opacity-70">{t('settings.data.jsonNeedsConnection')}</p>}
      {jsonError && <p class="text-sm text-error">{jsonError}</p>}
      <p class="text-sm">{t('settings.data.queue', { count: outbox.value.length })}</p>
      <button type="button" class="btn btn-outline min-h-11 rounded-full self-start" onClick={() => void syncNow()}>{t('sync.now')}</button>
      {failed.value.length > 0 && (
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{t('settings.data.failed')}</h3>
          {failed.value.map((item, index) => (
            <div key={index} class="flex flex-col gap-2 rounded-box bg-base-200 p-3 text-sm">
              <span class="font-mono text-xs">{item.op.entity} {item.op.key}</span>
              <span class="text-error">{item.error}</span>
              <div class="flex gap-2">
                <button type="button" class="btn btn-outline btn-sm min-h-11 rounded-full" onClick={() => void retryFailed(index)}>{t('settings.data.retry')}</button>
                <button type="button" class="btn btn-soft btn-error btn-sm min-h-11 rounded-full" onClick={() => void discardFailed(index)}>{t('settings.data.discard')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p class="text-xs opacity-70">{lastSaved.value ? t(`sync.${lastSaved.value === 'synced' ? 'synced' : 'saved'}`) : ''}</p>
    </Card>
  );
}

function ConnectionCard() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const saved = meta.value.token;

  async function onConnect(event: Event) {
    event.preventDefault();
    const result = await connect(token);
    if (result === 'ok') {
      setToken('');
      setMessage(null);
    } else {
      setMessage(t(`settings.connection.${result === 'invalid' ? 'invalid' : result === 'offline' ? 'offline' : 'rejected'}`));
    }
  }

  return (
    <Card title={t('settings.connection.title')}>
      {saved ? (
        <>
          <p class="text-sm">{device.value ? t('settings.connection.connectedAs', { device: device.value }) : t('settings.connection.notConnected')}</p>
          <p class="text-xs opacity-70 tabular-nums">{t('settings.connection.tokenEnding', { last: saved.slice(-4) })}</p>
          <p class="text-xs opacity-70">{t(`sync.state.${stateKey(syncState.value)}`)}</p>
          {syncState.value === 'unauthorized' && <p role="alert" class="alert alert-warning text-sm">{t('settings.connection.rejected')}</p>}
          <button type="button" class="btn btn-soft btn-error min-h-11 rounded-full self-start" onClick={() => void disconnect()}>{t('settings.connection.disconnect')}</button>
        </>
      ) : (
        <form class="flex flex-col gap-3" onSubmit={onConnect}>
          <p class="text-sm opacity-70">{t('settings.connection.notConnected')}</p>
          <p class="text-sm opacity-70">{t('settings.connection.hint')}</p>
          <input type="password" autoComplete="off" class="input w-full text-base" placeholder={t('settings.connection.placeholder')} value={token} onInput={(e) => setToken((e.target as HTMLInputElement).value)} />
          {message && <p class="text-sm text-error">{message}</p>}
          <button type="submit" class="btn btn-primary min-h-11 rounded-full self-start">{t('settings.connection.connect')}</button>
        </form>
      )}
    </Card>
  );
}

function stateKey(state: string): string {
  return state === 'not-connected' ? 'notConnected' : state;
}
