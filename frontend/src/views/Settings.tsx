import { useState } from 'preact/hooks';
import { connect, changeLanguage, changeTheme, disconnect, syncNow } from '../data/store';
import { device, meta, syncState, theme } from '../data/state';
import type { Theme } from '../data/db';
import { type Lang, lang, t } from '../i18n';

const LANGUAGES: Lang[] = ['en', 'pl'];
const THEMES: Theme[] = ['system', 'light', 'dark'];

export default function Settings() {
  return (
    <section class="flex flex-col gap-3">
      <h1 class="text-2xl font-bold">{t('settings.title')}</h1>
      <ConnectionCard />
      <Choice
        title={t('language.title')}
        options={LANGUAGES}
        label={(option) => t(`language.${option}`)}
        current={lang.value}
        onPick={(option) => void changeLanguage(option)}
      />
      <Choice
        title={t('theme.title')}
        options={THEMES}
        label={(option) => t(`theme.${option}`)}
        current={theme.value}
        onPick={(option) => void changeTheme(option)}
      />
      <div class="card border border-base-300 bg-base-100 rounded-box p-4 text-sm">
        {meta.value.persisted ? t('settings.storage.persisted') : t('settings.storage.notPersisted')}
      </div>
    </section>
  );
}

function ConnectionCard() {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saved = meta.value.token;

  async function onConnect(event: Event) {
    event.preventDefault();
    const result = await connect(token);
    if (result === 'ok') {
      setToken('');
      setError(null);
    } else {
      setError(t(result === 'invalid' ? 'settings.connection.invalid' : 'settings.connection.rejected'));
    }
  }

  return (
    <div class="card border border-base-300 bg-base-100 rounded-box p-4 flex flex-col gap-3">
      <h2 class="text-xs uppercase tracking-wide opacity-70">{t('settings.connection.title')}</h2>
      {saved ? (
        <>
          <p class="text-sm">
            {device.value
              ? t('settings.connection.connectedAs', { device: device.value })
              : t('settings.connection.notConnected')}
          </p>
          <p class="text-xs opacity-70 tabular-nums">
            {t('settings.connection.tokenEnding', { last: saved.slice(-4) })}
          </p>
          <div class="flex gap-2">
            <button type="button" class="btn btn-outline rounded-full" onClick={() => void syncNow()}>
              {t('sync.now')}
            </button>
            <button type="button" class="btn btn-soft btn-error rounded-full" onClick={() => void disconnect()}>
              {t('settings.connection.disconnect')}
            </button>
          </div>
          {syncState.value === 'unauthorized' && (
            <div role="alert" class="alert alert-warning">
              <span>{t('settings.connection.rejected')}</span>
            </div>
          )}
        </>
      ) : (
        <form class="flex flex-col gap-3" onSubmit={onConnect}>
          <p class="text-sm opacity-70">{t('settings.connection.notConnected')}</p>
          <p class="text-sm opacity-70">{t('settings.connection.hint')}</p>
          <input
            type="password"
            autoComplete="off"
            class="input w-full rounded-field"
            placeholder={t('settings.connection.placeholder')}
            value={token}
            onInput={(event) => setToken((event.target as HTMLInputElement).value)}
          />
          {error && <p class="text-sm text-error">{error}</p>}
          <button type="submit" class="btn btn-primary rounded-full self-start">
            {t('settings.connection.connect')}
          </button>
        </form>
      )}
    </div>
  );
}

interface ChoiceProps<T extends string> {
  title: string;
  options: T[];
  label: (option: T) => string;
  current: T;
  onPick: (option: T) => void;
}

function Choice<T extends string>({ title, options, label, current, onPick }: ChoiceProps<T>) {
  return (
    <div class="card border border-base-300 bg-base-100 rounded-box p-4 flex flex-col gap-3">
      <h2 class="text-xs uppercase tracking-wide opacity-70">{title}</h2>
      <div class="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === current}
            class={`btn btn-sm rounded-full ${option === current ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onPick(option)}
          >
            {label(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
