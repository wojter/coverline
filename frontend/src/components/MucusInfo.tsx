import { Modal } from './Modal';
import { t } from '../i18n';

const DEFINITIONS = ['stretchy', 'clear', 'sticky', 'cloudy'] as const;

export function MucusInfo({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={t('components.mucusInfo.title')} onClose={onClose}>
      <dl class="flex flex-col gap-3">
        {DEFINITIONS.map((key) => (
          <div key={key} class="flex flex-col gap-0.5">
            <dt class="font-semibold">{t(`mucusDefinition.${key}.title`)}</dt>
            <dd class="text-sm">{t(`mucusDefinition.${key}.text`)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
