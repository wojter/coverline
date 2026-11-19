import type { ComponentChildren } from 'preact';
import { SyncBadge } from './SyncBadge';

export function Heading({ title, children, badge = true, compact = false }: { title: string; children?: ComponentChildren; badge?: boolean; compact?: boolean }) {
  return (
    <header class="flex items-center justify-between gap-2 print:hidden">
      <h1 class={compact ? 'text-lg font-bold' : 'text-2xl font-bold'}>{title}</h1>
      <div class="flex items-center gap-2">
        {children}
        {badge && <SyncBadge />}
      </div>
    </header>
  );
}
