import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  function handleResponse(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  const VARIANT_COLOR: Record<string, string> = {
    danger:  "var(--danger, #ef4444)",
    warning: "var(--warning, #f59e0b)",
    default: "var(--brand-600, #4f46e5)",
  };

  const confirmColor = VARIANT_COLOR[pending?.variant ?? "default"];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {pending && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => handleResponse(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 99990,
              background: "rgba(16,16,26,0.5)",
              backdropFilter: "blur(2px)",
              animation: "fadeIn 0.15s ease",
            }}
          />

          {/* Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 99991,
              background: "var(--n-0, #fff)",
              borderRadius: 14,
              padding: "1.75rem",
              width: "min(420px, calc(100vw - 2rem))",
              boxShadow: "0 20px 60px rgba(16,16,26,0.2)",
              animation: "slideUp 0.18s ease",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {/* Icon row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: pending.variant === "danger"
                    ? "var(--danger-light, #fef2f2)"
                    : pending.variant === "warning"
                    ? "var(--warning-light, #fffbeb)"
                    : "var(--brand-50, #eef2ff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                {pending.variant === "danger" ? "🗑️" : pending.variant === "warning" ? "⚠️" : "❓"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary, #10101a)", marginBottom: 4 }}>
                  {pending.title}
                </div>
                <div style={{ fontSize: "0.83rem", color: "var(--text-secondary, #64647a)", lineHeight: 1.5 }}>
                  {pending.message}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
              <button
                onClick={() => handleResponse(false)}
                style={{
                  background: "var(--n-50, #f5f5f7)",
                  border: "1px solid var(--border-default, #e2e2e8)",
                  borderRadius: 8, padding: "0.5rem 1.1rem",
                  fontSize: "0.83rem", fontWeight: 500,
                  color: "var(--text-primary, #10101a)", cursor: "pointer",
                }}
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => handleResponse(true)}
                style={{
                  background: confirmColor,
                  border: "none", borderRadius: 8,
                  padding: "0.5rem 1.1rem",
                  fontSize: "0.83rem", fontWeight: 600,
                  color: "#fff", cursor: "pointer",
                }}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx.confirm;
}
