import { useEffect, useRef, useState } from "react";
import { useToast, type Toast, type ToastVariant } from "../contexts/ToastContext";

const ICONS: Record<ToastVariant, JSX.Element> = {
  success: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

const COLORS: Record<ToastVariant, { accent: string; iconColor: string; iconBg: string }> = {
  success: { accent: "#10b981", iconColor: "#059669", iconBg: "#d1fae5" },
  error:   { accent: "#ef4444", iconColor: "#dc2626", iconBg: "#fee2e2" },
  warning: { accent: "#f59e0b", iconColor: "#d97706", iconBg: "#fef3c7" },
  info:    { accent: "#3b82f6", iconColor: "#2563eb", iconBg: "#dbeafe" },
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(0);
  const duration = t.duration ?? 4000;
  const { accent, iconColor, iconBg } = COLORS[t.variant];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Shrink progress bar
  useEffect(() => {
    startRef.current = performance.now();
    let animId: number;
    function tick(now: number) {
      const elapsed = now - startRef.current;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
      if (elapsed < duration) animId = requestAnimationFrame(tick);
    }
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [duration]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.6rem",
        background: "var(--n-0, #fff)",
        borderRadius: 12,
        boxShadow: "0 8px 28px rgba(16,16,26,0.14), 0 2px 8px rgba(16,16,26,0.07)",
        padding: "0.75rem 0.9rem 0.75rem 0.9rem",
        minWidth: 300,
        maxWidth: 400,
        border: "1px solid var(--border-subtle, #eee)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left accent strip */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: accent, borderRadius: "12px 0 0 12px",
      }} />

      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 4, right: 0,
        height: 2, background: `${accent}30`, borderRadius: "0 0 12px 0",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", background: accent, width: `${progress}%`,
          transition: "width 0.1s linear",
        }} />
      </div>

      {/* Icon */}
      <div style={{
        marginLeft: 8,
        width: 26, height: 26, borderRadius: 8,
        background: iconBg, color: iconColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {ICONS[t.variant]}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary, #10101a)", lineHeight: 1.3 }}>
          {t.title}
        </div>
        {t.message && (
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary, #64647a)", marginTop: 2, lineHeight: 1.5 }}>
            {t.message}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--n-400, #8888a0)", padding: "2px", flexShrink: 0,
          borderRadius: 4, display: "flex", alignItems: "center",
          transition: "color 0.12s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary, #10101a)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--n-400, #8888a0)"; }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        bottom: "1.25rem",
        right: "1.25rem",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column-reverse",
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
