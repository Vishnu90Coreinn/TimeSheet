/**
 * Notifications.tsx — Pulse SaaS design v2.0
 */
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import type { Notification } from "../types";

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

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell icon button */}
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notif-badge" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

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
              notifications.map((n) => (
                <div key={n.id} style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}>
                  <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: "0.775rem", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                    {n.message}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                      {new Date(n.createdAtUtc).toLocaleString()}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => void markRead(n.id)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
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
