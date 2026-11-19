import type { ComponentChildren } from 'preact';
import { t } from '../i18n';

export function More({ title, summary, children }: { title: string; summary?: string | null; children: ComponentChildren }) {
  return (
    <details class="collapse collapse-arrow rounded-box bg-base-200" open={Boolean(summary)}>
      <summary class="collapse-title flex min-h-11 flex-wrap items-center gap-2 text-sm font-semibold">
        {title}
        {summary && <span class="text-xs font-normal opacity-70">{summary}</span>}
        <span class="sr-only">{t('common.more')}</span>
      </summary>
      <div class="collapse-content flex flex-col gap-3">{children}</div>
    </details>
  );
}
