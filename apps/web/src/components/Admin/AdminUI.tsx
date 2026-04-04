/**
 * AdminUI.tsx — Shared UI primitives for admin pages.
 * OverflowMenu, ToggleSwitch.
 * AppDrawer, AppModal, AppToggle are now in ui/index.ts
 */
import { useState } from "react";
import { AppButton } from "../ui";

// ── OverflowMenu ──────────────────────────────────────────
export interface OverflowMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  warning?: boolean;
}
export function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-wrap">
      <AppButton className="overflow-btn" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-label="More actions">
        ···
      </AppButton>
      {open && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
          <div className="overflow-menu">
            {items.map((item) => (
              <AppButton
                key={item.label}
                className={`overflow-item${item.danger ? " overflow-item--danger" : item.warning ? " overflow-item--warning" : ""}`}
                onClick={() => { item.onClick(); setOpen(false); }}
                variant="ghost"
                size="sm"
              >
                {item.label}
              </AppButton>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── ToggleSwitch ──────────────────────────────────────────
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}
export function ToggleSwitch({ checked, onChange, label, disabled }: ToggleSwitchProps) {
  return (
    <label className={`toggle-wrap${disabled ? " opacity-50 pointer-events-none" : ""}`}>
      <div className={`toggle-track${checked ? " on" : ""}`} onClick={() => !disabled && onChange(!checked)}>
        <div className="toggle-thumb" />
      </div>
      {label && <span className="text-[0.8rem] text-text-secondary">{label}</span>}
    </label>
  );
}

