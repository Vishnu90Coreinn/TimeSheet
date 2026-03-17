/**
 * Notifications.tsx — Pulse SaaS design v2.0
 */
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import type { Notification } from "../types";

function notifIcon(type: number): string {
  switch (type) {
    case 0: return "🕐";
    case 1: return "📋";
    case 2: return "✅";
    case 3: return "🔄";
    case 5: return "🚨";
    default: return "🔔";
  }
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    const r = await apiFetch("/notifications");
    if (r.ok) setNotifications(await r.json());
  }

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    setNotifications([]);
  }

  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => void loadNotifications(), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.length;
  const hasAnomalies = notifications.some((n) => Number(n.type) === 5);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell icon button */}
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}${hasAnomalies ? " — anomaly alerts" : ""}`}
        style={{ position: "relative" }}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notif-badge" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        {hasAnomalies && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 6,
              height: 6,
              background: "#ef4444",
              borderRadius: "50%",
              animation: "anomaly-pulse 1.5s ease-in-out infinite",
            }}
          />
        )}
      </button>
      <style>{`
        @keyframes anomaly-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: "340px",
          background: "var(--n-0)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 200,
          overflow: "hidden",
          maxHeight: "440px",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "var(--space-4)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--n-25)",
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              Notifications
              {unreadCount > 0 && <span className="badge badge-brand">{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => void markAllRead()}>
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)", opacity: 0.3 }}>🔔</div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-tertiary)", margin: 0 }}>No unread notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const nType = Number(n.type);
                const isAnomaly = nType === 5;
                return (
                  <div key={n.id} style={{
                    padding: "var(--space-3) var(--space-4)",
                    borderBottom: "1px solid var(--border-subtle)",
                    background: isAnomaly ? "#fff5f5" : undefined,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0, marginTop: 1, width: 20, textAlign: "center" }} aria-hidden="true">
                        {notifIcon(nType)}
                      </span>
                      <div style={{ fontSize: "0.825rem", fontWeight: isAnomaly ? 700 : 600, color: isAnomaly ? "#ef4444" : "var(--text-primary)" }}>
                        {n.title}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.775rem", color: "var(--text-secondary)", marginBottom: "var(--space-2)", paddingLeft: 28 }}>
                      {n.message}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 28 }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                        {new Date(n.createdAtUtc).toLocaleString()}
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => void markRead(n.id)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
