/**
 * StatusBadge.tsx — Shared status badge component (Cross-cutting fix)
 * Always pairs color with an explicit text label (WCAG 2.1 SC 1.4.1).
 * Styled per the "Precision Atelier" UI-2.0 design system.
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
  style: CSSProperties;
}

/** Base pill styles shared by every badge (Precision Atelier design rules). */
const BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 9999,
  padding: "2px 10px",
  fontSize: "0.6875rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

const STATUS_CONFIG: Record<BadgeStatus, StatusConfig> = {
  /* approved / active / success */
  approved: {
    label: "Approved",
    style: {
      background: "var(--primary-fixed)",
      color: "var(--on-primary-fixed-variant)",
    },
  },
  checkedIn: {
    label: "Checked In",
    style: {
      background: "var(--primary-fixed)",
      color: "var(--on-primary-fixed-variant)",
    },
  },

  /* pending / in-progress */
  pending: {
    label: "Pending",
    style: {
      background: "var(--secondary-fixed)",
      color: "var(--on-secondary-fixed-variant)",
    },
  },
  "on-leave": {
    label: "On Leave",
    style: {
      background: "var(--secondary-fixed)",
      color: "var(--on-secondary-fixed-variant)",
    },
  },

  /* submitted / under-review */
  submitted: {
    label: "Submitted",
    style: {
      background: "var(--surface-container-highest)",
      color: "var(--on-surface-variant)",
    },
  },
  checkedOut: {
    label: "Checked Out",
    style: {
      background: "var(--surface-container-highest)",
      color: "var(--on-surface-variant)",
    },
  },

  /* rejected / error / overdue */
  rejected: {
    label: "Rejected",
    style: {
      background: "var(--error-container)",
      color: "var(--on-error-container)",
    },
  },
  missing: {
    label: "Missing",
    style: {
      background: "var(--error-container)",
      color: "var(--on-error-container)",
    },
  },

  /* draft / inactive / neutral */
  draft: {
    label: "Draft",
    style: {
      background: "var(--surface-container-high)",
      color: "var(--on-surface-variant)",
    },
  },
  absent: {
    label: "Absent",
    style: {
      background: "var(--surface-container-high)",
      color: "var(--on-surface-variant)",
    },
  },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  style?: CSSProperties;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      style={{ ...BASE_STYLE, ...cfg.style, ...style }}
      aria-label={`Status: ${cfg.label}`}
      role="status"
    >
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
