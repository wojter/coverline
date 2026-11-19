export function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label class="flex min-h-11 items-center justify-between gap-3">
      <span class="text-base">{label}</span>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange((event.target as HTMLInputElement).checked)}
      />
    </label>
  );
}
