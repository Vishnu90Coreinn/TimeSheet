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
  bg: string;
  color: string;
  icon: string;
}

const STATUS_CONFIG: Record<BadgeStatus, StatusConfig> = {
  missing:    { label: "Missing",     bg: "#fef3c7", color: "#92400e", icon: "⚠" },
  draft:      { label: "Draft",       bg: "#f3f4f6", color: "#374151", icon: "✎" },
  submitted:  { label: "Submitted",   bg: "#dbeafe", color: "#1e40af", icon: "🕐" },
  approved:   { label: "Approved",    bg: "#dcfce7", color: "#14532d", icon: "✓" },
  rejected:   { label: "Rejected",    bg: "#fee2e2", color: "#991b1b", icon: "✕" },
  pending:    { label: "Pending",     bg: "#fef3c7", color: "#92400e", icon: "⏳" },
  "on-leave": { label: "On Leave",    bg: "#fef9c3", color: "#a16207", icon: "✦" },
  checkedIn:  { label: "Checked In",  bg: "#dcfce7", color: "#15803d", icon: "●" },
  checkedOut: { label: "Checked Out", bg: "#f0fdf4", color: "#166534", icon: "○" },
  absent:     { label: "Absent",      bg: "#f9fafb", color: "#6b7280", icon: "–" },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  style?: CSSProperties;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: cfg.bg,
        color: cfg.color,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        lineHeight: 1.5,
        ...style,
      }}
      aria-label={`Status: ${cfg.label}`}
      role="status"
    >
      <span aria-hidden="true" style={{ fontSize: 10 }}>{cfg.icon}</span>
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
