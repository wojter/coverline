import { t } from '../i18n';
import type { SaveStatus } from './useDayDraft';
import { SyncBadge } from './SyncBadge';

export function statusText(status: SaveStatus): string | null {
  if (status === 'saved') return t('components.save.saved');
  if (status === 'invalid') return t('components.save.invalid');
  if (status === 'noReading') return t('components.save.noReading');
  if (status === 'rejected') return t('components.save.rejected');
  return null;
}

// Opaque bar above the floating dock on phones, at the bottom of the viewport on desktop.
export function SaveBar({ onSave, status, disabled }: { onSave: () => void; status: SaveStatus; disabled: boolean }) {
  const text = statusText(status);
  return (
    <div class="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 px-3 print:hidden lg:bottom-4">
      <div class="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-box border border-base-300 bg-base-200 px-3 py-2 shadow-lg lg:max-w-5xl">
        <button type="button" class="btn btn-primary min-h-12 flex-1 rounded-full text-base" disabled={disabled} onClick={onSave}>
          {t('components.save.button')}
        </button>
        {text ? <span role="status" class="max-w-[9rem] text-right text-xs leading-tight">{text}</span> : <SyncBadge />}
      </div>
    </div>
  );
}
