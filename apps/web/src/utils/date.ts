/**
 * Centralized date formatting utilities.
 * All functions accept ISO date strings (YYYY-MM-DD or full ISO 8601).
 */

/**
 * Safely parse an ISO date string as a local calendar date.
 * Appends T00:00:00 when no time component is present to avoid UTC-shift.
 */
export function parseLocalDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  return new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
}

/**
 * Returns today's date as a YYYY-MM-DD string in local time.
 * Replaces repeated `new Date().toISOString().slice(0, 10)` patterns.
 */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Format an ISO date string as a short date: "Mar 15, 2025".
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseLocalDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Format an ISO date string as a long date: "March 15, 2025".
 */
export function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseLocalDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Format an ISO date string as month + day only: "Mar 15".
 */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseLocalDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Relative time string: "just now", "5m ago", "2h ago", "3d ago", "Mar 15".
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtDateShort(iso);
}
