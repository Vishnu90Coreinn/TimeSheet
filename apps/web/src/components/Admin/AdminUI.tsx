/**
 * AdminUI.tsx — Shared UI primitives for admin pages.
 * Drawer, ConfirmModal, OverflowMenu, ToggleSwitch, Toast hook.
 */
import { useState, type ReactNode } from "react";
import { AppButton } from "../ui";

// ── Drawer ────────────────────────────────────────────────
interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}
export function Drawer({ open, title, onClose, children, footer }: DrawerProps) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-header">
          <div className="drawer-title">{title}</div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </>
  );
}

// ── ConfirmModal ──────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
export function ConfirmModal({ open, title, body, confirmLabel = "Delete", danger = true, onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <AppButton variant="ghost" size="sm" onClick={onCancel}>Cancel</AppButton>
          <AppButton variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </AppButton>
        </div>
      </div>
    </div>
  );
}

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

// ── useToast ──────────────────────────────────────────────
export interface ToastState { msg: string; ok: boolean }
export function useToast(): [ToastState | null, (msg: string, ok?: boolean) => void] {
  const [toast, setToast] = useState<ToastState | null>(null);
  function show(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }
  return [toast, show];
}

export function Toast({ state }: { state: ToastState | null }) {
  if (!state) return null;
  return (
    <div className={`toast${state.ok ? " toast--ok" : " toast--err"}`}>
      {state.ok ? "✓" : "✗"} {state.msg}
    </div>
  );
}
