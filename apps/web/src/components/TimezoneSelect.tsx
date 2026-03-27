import { useMemo } from "react";

export interface TimezoneOption {
  id: string;
  displayName: string;
}

interface TimezoneSelectProps {
  value: string;
  options: TimezoneOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimezoneSelect({ value, options, onChange, disabled }: TimezoneSelectProps) {
  const sorted = useMemo(
    () => [...options].sort((a, b) => a.id.localeCompare(b.id)),
    [options],
  );

  return (
    <select
      className="input-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {sorted.map((zone) => (
        <option key={zone.id} value={zone.id}>
          {zone.id} — {zone.displayName}
        </option>
      ))}
    </select>
  );
}
