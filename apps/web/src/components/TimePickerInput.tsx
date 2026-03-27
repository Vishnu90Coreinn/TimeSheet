/**
 * TimePickerInput — compact HH : MM picker built with two selects.
 * Matches ts-form-input styling; emits a "HH:MM" string via onChange.
 */
import { Clock } from "lucide-react";

interface TimePickerInputProps {
  value: string;          // "HH:MM" or ""
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export function TimePickerInput({ value, onChange, label, disabled }: TimePickerInputProps) {
  const [hh, mm] = value ? value.split(":") : ["", ""];

  function setHour(h: string) {
    onChange(`${h}:${mm || "00"}`);
  }

  function setMinute(m: string) {
    onChange(`${hh || "00"}:${m}`);
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[12px] font-semibold text-[var(--n-600,#4b5563)]">{label}</label>
      )}
      <div
        className="ts-form-input"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 8px",
          cursor: disabled ? "not-allowed" : undefined,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Clock size={13} strokeWidth={2} style={{ color: "var(--n-400,#9ca3af)", flexShrink: 0 }} />

        {/* Hour select */}
        <select
          disabled={disabled}
          value={hh || ""}
          onChange={(e) => setHour(e.target.value)}
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: hh ? "var(--n-900,#111827)" : "var(--n-400,#9ca3af)",
            width: 40,
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: "6px 0",
            textAlign: "center",
          }}
        >
          <option value="" disabled>HH</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>

        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--n-400,#9ca3af)", lineHeight: 1, userSelect: "none" }}>:</span>

        {/* Minute select */}
        <select
          disabled={disabled}
          value={mm || ""}
          onChange={(e) => setMinute(e.target.value)}
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: mm ? "var(--n-900,#111827)" : "var(--n-400,#9ca3af)",
            width: 40,
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: "6px 0",
            textAlign: "center",
          }}
        >
          <option value="" disabled>MM</option>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
