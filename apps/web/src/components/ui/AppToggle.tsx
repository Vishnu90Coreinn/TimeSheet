interface AppToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function AppToggle({ checked, onChange, label, disabled }: AppToggleProps) {
  return (
    <label className={`toggle-wrap${disabled ? " opacity-50 pointer-events-none" : ""}`}>
      <div className={`toggle-track${checked ? " on" : ""}`} onClick={() => !disabled && onChange(!checked)}>
        <div className="toggle-thumb" />
      </div>
      {label && <span className="text-[0.8rem] text-text-secondary">{label}</span>}
    </label>
  );
}
