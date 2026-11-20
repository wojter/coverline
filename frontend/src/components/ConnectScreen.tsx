import { useState } from 'preact/hooks';
import { connect } from '../data/store';
import { t } from '../i18n';

// Shown instead of the whole app while the device has no token. Once the token is
// stored the shell takes over, so this screen never appears again on this device.
export function ConnectScreen() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: Event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await connect(token.trim());
    setBusy(false);
    if (result === 'invalid' || result === 'rejected') setMessage(t(`settings.connection.${result}`));
  }

  return (
    <main class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
      <h1 class="text-center text-3xl font-bold">{t('app.name')}</h1>
      <form class="card flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4" onSubmit={onSubmit}>
        <h2 class="text-lg font-semibold">{t('connect.title')}</h2>
        <p class="text-sm opacity-70">{t('connect.intro')}</p>
        <p class="text-sm opacity-70">{t('settings.connection.hint')}</p>
        <input type="password" autoComplete="off" autoCapitalize="off" spellcheck={false} aria-label={t('settings.connection.title')} class="input w-full text-base" placeholder={t('settings.connection.placeholder')} value={token} onInput={(e) => setToken((e.target as HTMLInputElement).value)} />
        {message && <p role="alert" class="text-sm text-error">{message}</p>}
        <button type="submit" disabled={busy || token.trim() === ''} class="btn btn-primary min-h-11 rounded-full">{t('settings.connection.connect')}</button>
      </form>
    </main>
  );
}
