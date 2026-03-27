import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "white",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(24,20,69,0.18)",
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        minWidth: "280px",
        maxWidth: "420px",
        border: "1px solid #e0e7ff",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "1.1rem",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        T
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e1e28" }}>Install TimeSheet</div>
        <div style={{ fontSize: "0.75rem", color: "#64647a" }}>Add to home screen for quick access</div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          background: "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: 8,
          padding: "0.4rem 0.9rem",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          color: "#8888a0",
          cursor: "pointer",
          fontSize: "1.2rem",
          lineHeight: 1,
          padding: "0.25rem",
          flexShrink: 0,
        }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
