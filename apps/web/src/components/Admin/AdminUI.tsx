/**
 * AdminUI.tsx — Shared UI primitives for admin pages.
 * Drawer, ConfirmModal, OverflowMenu, ToggleSwitch, Toast hook.
 */
import { useState, type ReactNode } from "react";

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
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
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
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"} btn-sm`} onClick={onConfirm}>
            {confirmLabel}
          </button>
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
      <button className="overflow-btn" onClick={() => setOpen((o) => !o)} aria-label="More actions">
        ···
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
          <div className="overflow-menu">
            {items.map((item) => (
              <button
                key={item.label}
                className={`overflow-item${item.danger ? " overflow-item--danger" : item.warning ? " overflow-item--warning" : ""}`}
                onClick={() => { item.onClick(); setOpen(false); }}
              >
                {item.label}
              </button>
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
