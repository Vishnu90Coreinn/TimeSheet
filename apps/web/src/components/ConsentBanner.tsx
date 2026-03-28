/**
 * ConsentBanner.tsx — Cookie/consent notice shown once on first visit.
 * Stores acceptance in localStorage. Logs consent to backend on login.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

const STORAGE_KEY = "ts_consent_accepted";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) setVisible(true);
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
    // Log to backend (fire-and-forget — user may not be logged in yet)
    void apiFetch("/privacy/consent", {
      method: "POST",
      body: JSON.stringify({ consentType: "analytics", granted: true }),
    }).catch(() => {/* ignore if unauthenticated */});
  }

  function handleDecline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
    void apiFetch("/privacy/consent", {
      method: "POST",
      body: JSON.stringify({ consentType: "analytics", granted: false }),
    }).catch(() => {});
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50
                 bg-white border border-border-default rounded-xl shadow-lg p-4 flex flex-col gap-3"
    >
      <div>
        <p className="text-[0.85rem] font-semibold text-text-primary mb-1">We use cookies</p>
        <p className="text-[0.75rem] text-text-secondary leading-relaxed">
          We use essential cookies to keep you signed in, and optional analytics cookies to
          improve the product. You can change this in your profile at any time.
        </p>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          className="btn btn-ghost btn-sm text-text-tertiary"
          onClick={handleDecline}
        >
          Decline
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAccept}
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
