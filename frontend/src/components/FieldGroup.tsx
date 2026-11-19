import type { ComponentChildren } from 'preact';

export function FieldGroup({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div class="flex flex-col gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</h3>
      {children}
    </div>
  );
}
