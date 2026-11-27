import { Check } from 'lucide-preact';

interface PillProps<T extends string> {
  options: readonly T[];
  value: T | null;
  label: (option: T) => string;
  onChange: (value: T | null) => void;
  activeClass?: (option: T) => string;
  disabled?: (option: T) => boolean;
  ariaLabel: string;
}

// Single choice. Tapping the selected chip clears it (sent as null, spec S4.1).
export function PillChoice<T extends string>({ options, value, label, onChange, activeClass, disabled, ariaLabel }: PillProps<T>) {
  return (
    <div class="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option === value;
        const tone = active ? (activeClass?.(option) ?? 'btn-primary') : IDLE;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            disabled={disabled?.(option)}
            class={`btn btn-sm min-h-11 rounded-full ${tone}`}
            onClick={() => onChange(active ? null : option)}
          >
            {active && <Check size={14} aria-hidden="true" />}
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}

interface TileProps<T extends string> {
  options: readonly T[];
  value: T[] | null;
  label: (option: T) => string;
  onChange: (value: T[] | null) => void;
  ariaLabel: string;
}

const IDLE = 'border-base-300 bg-base-100 hover:border-primary';

const GRID = 'grid grid-cols-2 gap-2 [&>:last-child:nth-child(odd)]:col-span-2';

function Tile({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      class={`btn h-auto min-h-11 rounded-box px-3 py-2 text-center font-medium ${active ? 'btn-primary' : IDLE}`}
      onClick={onClick}
    >
      {active && <Check size={16} aria-hidden="true" class="shrink-0" />}
      <span>{label}</span>
    </button>
  );
}

// Multi choice in a two-column grid. Values stay in spec order, and an empty selection is null.
export function TileChoice<T extends string>({ options, value, label, onChange, ariaLabel }: TileProps<T>) {
  const selected = value ?? [];
  const toggle = (option: T) => {
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : options.filter((item) => item === option || selected.includes(item));
    onChange(next.length > 0 ? next : null);
  };
  return (
    <div class={GRID} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <Tile key={option} active={selected.includes(option)} label={label(option)} onClick={() => toggle(option)} />
      ))}
    </div>
  );
}

interface SingleTileProps<T extends string> {
  options: readonly T[];
  value: T | null;
  label: (option: T) => string;
  onChange: (value: T | null) => void;
  ariaLabel: string;
}

// Single choice in the same two-column grid. Tapping the selected tile clears it. An odd last tile spans both columns.
export function SingleTileChoice<T extends string>({ options, value, label, onChange, ariaLabel }: SingleTileProps<T>) {
  return (
    <div class={GRID} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <Tile key={option} active={option === value} label={label(option)} onClick={() => onChange(option === value ? null : option)} />
      ))}
    </div>
  );
}
