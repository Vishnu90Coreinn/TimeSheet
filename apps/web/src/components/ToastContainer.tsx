import { useEffect, useState } from "react";
import { useToast, type Toast, type ToastVariant } from "../contexts/ToastContext";

const VARIANT_STYLES: Record<ToastVariant, { bar: string; icon: string; iconBg: string }> = {
  success: { bar: "#10b981", icon: "✓", iconBg: "#ecfdf5" },
  error:   { bar: "#ef4444", icon: "✕", iconBg: "#fef2f2" },
  warning: { bar: "#f59e0b", icon: "!", iconBg: "#fffbeb" },
  info:    { bar: "#3b82f6", icon: "i", iconBg: "#eff6ff"  },
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(enter);
  }, []);

  const { bar, icon, iconBg } = VARIANT_STYLES[t.variant];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.65rem",
        background: "var(--n-0, #fff)",
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(16,16,26,0.12), 0 1px 4px rgba(16,16,26,0.06)",
        padding: "0.75rem 1rem",
        minWidth: 280,
        maxWidth: 380,
        borderLeft: `3px solid ${bar}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(24px)",
        transition: "opacity 0.22s ease, transform 0.22s ease",
        position: "relative",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: iconBg, color: bar,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary, #10101a)", lineHeight: 1.3 }}>
          {t.title}
        </div>
        {t.message && (
          <div style={{ fontSize: "0.77rem", color: "var(--text-secondary, #64647a)", marginTop: 2, lineHeight: 1.4 }}>
            {t.message}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--n-400, #8888a0)", fontSize: "1rem", lineHeight: 1,
          padding: "0 0 0 4px", flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        pointerEvents: toasts.length === 0 ? "none" : "auto",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
