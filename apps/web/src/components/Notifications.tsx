import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarClock, CheckCircle2, ChevronRight, Clock3, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Notification, NotificationListResponse } from "../types";
import { EmptyNotifications } from "./EmptyState";
import { useConfirm } from "./ConfirmDialog";

const PAGE_SIZE = 10;
const DRAWER_CLOSE_MS = 220;

const BUCKET_ORDER = ["Today", "Yesterday", "Earlier this week", "Older"] as const;
type NotificationBucketLabel = (typeof BUCKET_ORDER)[number];

type NotificationTone = "brand" | "success" | "warning" | "danger" | "neutral";

type NotificationGroup = {
  label: NotificationBucketLabel;
  items: Notification[];
};

export function normalizeNotificationPayload(payload: unknown): NotificationListResponse {
  if (Array.isArray(payload)) {
    const items = payload as Notification[];
    return {
      items,
      totalUnread: items.reduce((count, item) => count + (item.isRead ? 0 : 1), 0),
      hasMore: false,
    };
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Partial<NotificationListResponse> & { items?: unknown };
    const items = Array.isArray(candidate.items) ? (candidate.items as Notification[]) : [];
    return {
      items,
      totalUnread: typeof candidate.totalUnread === "number"
        ? candidate.totalUnread
        : items.reduce((count, item) => count + (item.isRead ? 0 : 1), 0),
      hasMore: Boolean(candidate.hasMore),
    };
  }

  return { items: [], totalUnread: 0, hasMore: false };
}

export function groupNotifications(items: Notification[], now = new Date()): NotificationGroup[] {
  const groups = new Map<NotificationBucketLabel, Notification[]>(
    BUCKET_ORDER.map((label) => [label, []]),
  );

  items.forEach((item) => {
    const bucket = getNotificationBucket(item.createdAtUtc, now);
    groups.get(bucket)?.push(item);
  });

  return BUCKET_ORDER
    .map((label) => ({ label, items: groups.get(label) ?? [] }))
    .filter((group) => group.items.length > 0);
}

export function formatRelativeTime(createdAtUtc: string, now = new Date()): string {
  const createdAt = new Date(createdAtUtc);
  const diffMs = now.getTime() - createdAt.getTime();
  if (Number.isNaN(diffMs)) return "";

  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 30) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getNotificationBucket(createdAtUtc: string, now = new Date()): NotificationBucketLabel {
  const createdAt = new Date(createdAtUtc);
  if (Number.isNaN(createdAt.getTime())) return "Older";

  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = startOfWeek(now);

  const createdDay = startOfLocalDay(createdAt);
  if (sameDay(createdDay, today)) return "Today";
  if (sameDay(createdDay, yesterday)) return "Yesterday";
  if (createdDay >= weekStart && createdDay < yesterday) return "Earlier this week";
  return "Older";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const local = startOfLocalDay(date);
  const mondayOffset = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - mondayOffset);
  return local;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function mergeNotifications(existing: Notification[], incoming: Notification[]) {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
}

function getNotificationMeta(type: Notification["type"]) {
  const code = Number(type);
  switch (code) {
    case 0:
      return { icon: <Clock3 size={15} />, tone: "warning" as const, label: "Reminder" };
    case 1:
      return { icon: <CheckCircle2 size={15} />, tone: "success" as const, label: "Approval" };
    case 2:
      return { icon: <CalendarClock size={15} />, tone: "brand" as const, label: "Schedule" };
    case 3:
      return { icon: <RefreshCw size={15} />, tone: "neutral" as const, label: "Sync" };
    case 5:
      return { icon: <TriangleAlert size={15} />, tone: "danger" as const, label: "Alert" };
    default:
      return { icon: <Bell size={15} />, tone: "neutral" as const, label: "Notification" };
  }
}

function toneStyles(tone: NotificationTone) {
  switch (tone) {
    case "brand":
      return { background: "var(--brand-50)", color: "var(--brand-700)" };
    case "success":
      return { background: "var(--success-light, #e8fff5)", color: "var(--success, #0f9d58)" };
    case "warning":
      return { background: "var(--warning-light, #fff8e6)", color: "var(--warning, #f59e0b)" };
    case "danger":
      return { background: "var(--danger-light, #ffecec)", color: "var(--danger, #ef4444)" };
    default:
      return { background: "var(--n-100)", color: "var(--text-secondary)" };
  }
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url) || /^mailto:/i.test(url) || /^tel:/i.test(url);
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badgePulse, setBadgePulse] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const prevUnreadRef = useRef<number | null>(null);
  const confirm = useConfirm();
  const navigate = useNavigate();

  const unreadCount = totalUnread;
  const groups = useMemo(() => groupNotifications(items), [items]);
  const hasItems = items.length > 0;

  const loadPage = useCallback(async (requestedPage: number, mode: "replace" | "append" = "replace") => {
    if (mode === "replace") setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const response = await apiFetch(`/notifications?page=${requestedPage}&pageSize=${PAGE_SIZE}`);
      if (!response.ok) throw new Error(`Failed to load notifications (${response.status})`);

      const payload = normalizeNotificationPayload(await response.json());
      setItems((current) => (mode === "replace" ? payload.items : mergeNotifications(current, payload.items)));
      setTotalUnread(payload.totalUnread);
      setHasMore(payload.hasMore);
      setPage(requestedPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1, "replace");
  }, [loadPage]);

  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = unreadCount;
      return;
    }

    if (prevUnreadRef.current !== unreadCount) {
      setBadgePulse(true);
      const timeout = window.setTimeout(() => setBadgePulse(false), 260);
      prevUnreadRef.current = unreadCount;
      return () => window.clearTimeout(timeout);
    }

    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setMounted(true);
      return;
    }

    if (!mounted) return;
    closeTimerRef.current = window.setTimeout(() => setMounted(false), DRAWER_CLOSE_MS);
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [mounted, open]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : previousOverflow;
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function markRead(id: string) {
    const target = items.find((item) => item.id === id);
    if (!target || target.isRead) return;

    const response = await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    if (!response.ok && response.status !== 204) return;

    setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setTotalUnread((current) => Math.max(0, current - 1));
  }

  async function markAllRead() {
    if (unreadCount === 0) return;

    const response = await apiFetch("/notifications/mark-all-read", { method: "POST" });
    if (!response.ok && response.status !== 204) return;

    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setTotalUnread(0);
  }

  async function clearAll() {
    if (!hasItems) return;

    const confirmed = await confirm({
      title: "Clear all notifications?",
      message: "This removes every notification from your list.",
      confirmLabel: "Clear all",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    const response = await apiFetch("/notifications", { method: "DELETE" });
    if (!response.ok && response.status !== 204) return;

    setItems([]);
    setTotalUnread(0);
    setHasMore(false);
    setPage(0);
  }

  async function openNotification(notification: Notification) {
    if (!notification.actionUrl) return;

    await markRead(notification.id);
    setOpen(false);

    if (isExternalUrl(notification.actionUrl)) {
      window.location.assign(notification.actionUrl);
      return;
    }

    navigate(notification.actionUrl);
  }

  async function dismiss(notification: Notification) {
    await markRead(notification.id);
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn relative"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className={`notif-badge${badgePulse ? " notif-badge--pulse" : ""}`}
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {mounted && (
        <div
          className="fixed inset-0 z-[260] transition-opacity duration-200"
          style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        >
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 border-0 bg-[rgba(17,24,39,0.28)] backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className="absolute right-0 top-0 flex h-full w-[min(380px,calc(100vw-16px))] flex-col border-l border-border-subtle bg-n-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)] transition-transform duration-200"
            style={{
              transform: open ? "translateX(0)" : "translateX(100%)",
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Bell size={18} />
                </div>
                <div>
                  <div className="text-[0.95rem] font-semibold text-text-primary">Notifications</div>
                  <div className="text-[0.75rem] text-text-tertiary">
                    {unreadCount > 0 ? `${unreadCount} unread` : "No unread notifications"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-text-tertiary">
                Inbox
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void markAllRead()}
                  disabled={unreadCount === 0}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  onClick={() => void clearAll()}
                  disabled={!hasItems}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && !hasItems ? (
                <div className="flex h-full items-center justify-center px-6 py-10 text-[0.85rem] text-text-tertiary">
                  Loading notifications...
                </div>
              ) : !hasItems ? (
                <div className="flex flex-col gap-4 px-4 py-6">
                  {error && (
                    <div className="rounded-xl border border-border-subtle bg-n-25 px-4 py-3 text-[0.85rem] text-text-secondary">
                      {error}
                    </div>
                  )}
                  <EmptyNotifications />
                </div>
              ) : (
                <div className="flex flex-col gap-5 px-4 py-4">
                  {error && (
                    <div className="rounded-xl border border-border-subtle bg-n-25 px-4 py-3 text-[0.85rem] text-text-secondary">
                      {error}
                    </div>
                  )}
                  {groups.map((group) => (
                    <section key={group.label} className="flex flex-col gap-2">
                      <div className="px-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-text-tertiary">
                        {group.label}
                      </div>
                      <div className="flex flex-col gap-2">
                        {group.items.map((notification) => {
                          const meta = getNotificationMeta(notification.type);
                          const iconStyles = toneStyles(meta.tone);
                          const unread = !notification.isRead;
                          return (
                            <article
                              key={notification.id}
                              className={`rounded-2xl border px-3 py-3 transition-colors duration-150 ${
                                unread ? "border-brand-100 bg-brand-25" : "border-border-subtle bg-n-0"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="mt-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                                  style={iconStyles}
                                  aria-hidden="true"
                                >
                                  {meta.icon}
                                </div>

                                <div className="min-w-0 flex-1">
                                  {notification.actionUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => void openNotification(notification)}
                                      className="block w-full text-left"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`truncate text-[0.9rem] font-semibold ${unread ? "text-text-primary" : "text-text-secondary"}`}>
                                          {notification.title}
                                        </div>
                                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                                      </div>
                                      <div className="mt-1 line-clamp-2 text-[0.82rem] leading-5 text-text-tertiary">
                                        {notification.message}
                                      </div>
                                    </button>
                                  ) : (
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <div className={`truncate text-[0.9rem] font-semibold ${unread ? "text-text-primary" : "text-text-secondary"}`}>
                                          {notification.title}
                                        </div>
                                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                                      </div>
                                      <div className="mt-1 line-clamp-2 text-[0.82rem] leading-5 text-text-tertiary">
                                        {notification.message}
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-[0.72rem] text-text-tertiary">
                                      <span>{formatRelativeTime(notification.createdAtUtc)}</span>
                                      <span aria-hidden="true">•</span>
                                      <span>{meta.label}</span>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => void dismiss(notification)}
                                    >
                                      Dismiss
                                      <ChevronRight size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  {hasMore && (
                    <div className="pt-1">
                      <button
                        type="button"
                        className="btn btn-outline w-full"
                        onClick={() => void loadPage(page + 1, "append")}
                        disabled={loadingMore}
                      >
                        {loadingMore ? "Loading..." : "Load more notifications"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
