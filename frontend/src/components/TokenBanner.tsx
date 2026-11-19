import { syncState } from '../data/state';
import { t } from '../i18n';

export function TokenBanner() {
  if (syncState.value !== 'unauthorized') return null;
  return (
    <div role="alert" class="alert alert-warning rounded-box">
      <span class="text-sm">{t('sync.state.unauthorized')}</span>
      <a href="/ustawienia" class="btn btn-sm rounded-full">
        {t('nav.settings')}
      </a>
    </div>
  );
}
