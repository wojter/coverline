import { useRegisterSW } from 'virtual:pwa-register/preact';
import { t } from '../i18n';

// The update is applied only when the user taps the button, never on its own.
export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div class="toast toast-center toast-bottom z-50 mb-20 lg:mb-4">
      <div class="alert rounded-box border border-base-300 bg-base-100 shadow-lg">
        <span>{t('update.available')}</span>
        <button
          type="button"
          class="btn btn-primary btn-sm rounded-full"
          onClick={() => void updateServiceWorker(true)}
        >
          {t('update.reload')}
        </button>
      </div>
    </div>
  );
}
