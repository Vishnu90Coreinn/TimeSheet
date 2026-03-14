/**
 * Notifications.tsx — Design system applied (Step 3).
 * All business logic and API calls are unchanged.
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

  // Close on outside click
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
      {/* Bell button */}
      <button
        className="btn-ghost"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        style={{ position: "relative", padding: "var(--space-2)" }}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "2px", right: "2px",
            background: "var(--color-error)", color: "white",
            borderRadius: "var(--radius-full)",
            minWidth: "18px", height: "18px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", fontFamily: "var(--font-display)", fontWeight: "var(--font-bold)",
            padding: "0 4px", lineHeight: 1,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: "340px",
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 200,
          overflow: "hidden",
          maxHeight: "420px",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "var(--space-4) var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--color-surface-raised)",
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--font-semibold)", fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
              Notifications {unreadCount > 0 && <span className="badge badge-blue" style={{ marginLeft: "var(--space-2)" }}>{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button className="btn-ghost" style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-2)" }} onClick={() => void markAllRead()}>
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <p style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", margin: 0 }}>
                No unread notifications
              </p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderBottom: "1px solid var(--color-border)",
                  background: "var(--color-background)",
                }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--font-semibold)", fontSize: "var(--text-sm)", color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>
                    {n.title}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
                    {n.message}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-text-muted)" }}>
                      {new Date(n.createdAtUtc).toLocaleString()}
                    </span>
                    <button className="btn-ghost" style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-2)" }} onClick={() => void markRead(n.id)}>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
