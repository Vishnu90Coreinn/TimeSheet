/**
 * Notifications.tsx — Pulse SaaS design v3.0
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
    <div ref={ref} className="relative inline-block">
      {/* Bell icon button */}
      <button
        className="icon-btn relative"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}${hasAnomalies ? " — anomaly alerts" : ""}`}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notif-badge" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        {hasAnomalies && (
          <span
            aria-hidden="true"
            className="absolute top-[2px] right-[2px] w-[6px] h-[6px] bg-red-500 rounded-full [animation:anomaly-pulse_1.5s_ease-in-out_infinite]"
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[340px] bg-n-0 border border-border-subtle rounded-lg shadow-lg z-[200] overflow-hidden max-h-[440px] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-border-subtle bg-n-25 flex-shrink-0">
            <span className="flex items-center gap-2 font-bold text-[0.875rem] text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
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
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <div className="text-2xl mb-2 opacity-30">🔔</div>
                <p className="text-[0.825rem] text-text-tertiary m-0">No unread notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const nType = Number(n.type);
                const isAnomaly = nType === 5;
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border-subtle${isAnomaly ? " bg-[#fff5f5]" : ""}`}
                  >
                    <div className="flex items-start gap-2 mb-[2px]">
                      <span className="text-[1rem] leading-none flex-shrink-0 mt-[1px] w-5 text-center" aria-hidden="true">
                        {notifIcon(nType)}
                      </span>
                      <div className={`text-[0.825rem] ${isAnomaly ? "font-bold text-red-500" : "font-semibold text-text-primary"}`}>
                        {n.title}
                      </div>
                    </div>
                    <div className="text-[0.775rem] text-text-secondary mb-2 pl-7">
                      {n.message}
                    </div>
                    <div className="flex justify-between items-center pl-7">
                      <span className="text-[0.72rem] text-text-tertiary">
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
