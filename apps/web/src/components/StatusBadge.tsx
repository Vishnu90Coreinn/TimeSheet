/**
 * StatusBadge.tsx — Shared status badge component (Cross-cutting fix)
 * Always pairs color with an icon + explicit text label (WCAG 2.1 SC 1.4.1).
 */
import type { CSSProperties } from "react";

export type BadgeStatus =
  | "missing"
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "pending"
  | "on-leave"
  | "checkedIn"
  | "checkedOut"
  | "absent";

interface StatusConfig {
  label: string;
  /** Tailwind bg + text classes */
  cls: string;
  icon: string;
}

const STATUS_CONFIG: Record<BadgeStatus, StatusConfig> = {
  missing:    { label: "Missing",     cls: "bg-amber-100 text-amber-800",  icon: "⚠" },
  draft:      { label: "Draft",       cls: "bg-gray-100 text-gray-700",    icon: "✎" },
  submitted:  { label: "Submitted",   cls: "bg-blue-100 text-blue-800",    icon: "🕐" },
  approved:   { label: "Approved",    cls: "bg-green-100 text-green-900",  icon: "✓" },
  rejected:   { label: "Rejected",    cls: "bg-red-100 text-red-800",      icon: "✕" },
  pending:    { label: "Pending",     cls: "bg-amber-100 text-amber-800",  icon: "⏳" },
  "on-leave": { label: "On Leave",    cls: "bg-yellow-100 text-yellow-700",icon: "✦" },
  checkedIn:  { label: "Checked In",  cls: "bg-green-100 text-green-700",  icon: "●" },
  checkedOut: { label: "Checked Out", cls: "bg-green-50 text-green-800",   icon: "○" },
  absent:     { label: "Absent",      cls: "bg-gray-50 text-gray-500",     icon: "–" },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  style?: CSSProperties;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold whitespace-nowrap leading-[1.5] ${cfg.cls}`}
      style={style}
      aria-label={`Status: ${cfg.label}`}
      role="status"
    >
      <span aria-hidden="true" className="text-[10px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

/** Map a raw string status from the API to a typed BadgeStatus */
export function toBadgeStatus(raw: string): BadgeStatus {
  const map: Record<string, BadgeStatus> = {
    missing: "missing", draft: "draft", submitted: "submitted",
    approved: "approved", rejected: "rejected", pending: "pending",
    "on-leave": "on-leave", oncleave: "on-leave",
    checkedin: "checkedIn", checkedout: "checkedOut", absent: "absent",
  };
  return map[raw?.toLowerCase()] ?? "draft";
}
