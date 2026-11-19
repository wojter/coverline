import type { ComponentChildren } from 'preact';
import { X } from 'lucide-preact';
import { t } from '../i18n';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}) {
  return (
    <div class="modal modal-open modal-bottom sm:modal-middle print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div class="modal-box flex max-w-md flex-col gap-3 rounded-box bg-base-100">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">{title}</h2>
          <button type="button" class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('common.close')} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
      <button type="button" class="modal-backdrop" aria-label={t('common.close')} onClick={onClose} />
    </div>
  );
}
