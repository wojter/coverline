import { t } from '../i18n';
import { SyncBadge } from './SyncBadge';

export function Page({ title }: { title: string }) {
  return (
    <section class="flex flex-col gap-3">
      <header class="flex items-center justify-between gap-2">
        <h1 class="text-2xl font-bold">{title}</h1>
        <SyncBadge />
      </header>
      <p class="text-sm opacity-70">{t('app.placeholder')}</p>
    </section>
  );
}
