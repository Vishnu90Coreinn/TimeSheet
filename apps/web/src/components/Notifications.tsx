import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { Notification } from "../types";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

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

  const unreadCount = notifications.length;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        {"\uD83D\uDD14"}{unreadCount > 0 && <span style={{ background: "red", color: "white", borderRadius: "50%", padding: "2px 6px", fontSize: "11px", marginLeft: "4px" }}>{unreadCount}</span>}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", width: "320px", background: "white", border: "1px solid #ccc", borderRadius: "4px", zIndex: 100, maxHeight: "400px", overflowY: "auto" }}>
          <div style={{ padding: "8px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Notifications</strong>
            {unreadCount > 0 && <button onClick={() => void markAllRead()} style={{ fontSize: "12px" }}>Mark all read</button>}
          </div>
          {notifications.length === 0 ? (
            <p style={{ padding: "12px", textAlign: "center", color: "#888" }}>No unread notifications</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ fontWeight: "bold", fontSize: "13px" }}>{n.title}</div>
                <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{n.message}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  <span style={{ fontSize: "11px", color: "#999" }}>{new Date(n.createdAtUtc).toLocaleString()}</span>
                  <button onClick={() => void markRead(n.id)} style={{ fontSize: "11px" }}>Dismiss</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
