import { CalendarDays, ChartLine, ChartNoAxesCombined, House, Settings } from 'lucide-preact';
import { t } from '../i18n';

const TABS = [
  { href: '/', label: 'nav.today', Icon: House },
  { href: '/kalendarz', label: 'nav.calendar', Icon: CalendarDays },
  { href: '/karta', label: 'nav.chart', Icon: ChartLine },
  { href: '/statystyki', label: 'nav.stats', Icon: ChartNoAxesCombined },
  { href: '/ustawienia', label: 'nav.settings', Icon: Settings },
] as const;

function isActive(path: string, href: string): boolean {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}

// Floating bottom bar on phones. Hidden in print.
export function Dock({ path }: { path: string }) {
  return (
    <nav class="dock dock-sm inset-x-3 bottom-3 w-auto rounded-box border border-base-300 bg-base-100 shadow-lg safe-bottom print:hidden lg:hidden">
      {TABS.map(({ href, label, Icon }) => (
        <a key={href} href={href} class={isActive(path, href) ? 'dock-active text-primary' : undefined}>
          <Icon size={20} aria-hidden="true" />
          <span class="dock-label">{t(label)}</span>
        </a>
      ))}
    </nav>
  );
}

// Pill tabs at 1024 px and wider. Hidden in print.
export function TopTabs({ path }: { path: string }) {
  return (
    <nav class="tabs tabs-box mx-auto mt-4 hidden w-fit lg:flex print:hidden">
      {TABS.map(({ href, label, Icon }) => (
        <a key={href} href={href} class={`tab gap-2 ${isActive(path, href) ? 'tab-active' : ''}`}>
          <Icon size={18} aria-hidden="true" />
          {t(label)}
        </a>
      ))}
    </nav>
  );
}
