interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  size?: "sm" | "md" | "lg";
}

export function EmptyState({ icon = "📭", title, description, action, size = "md" }: EmptyStateProps) {
  const padding = size === "sm" ? "2rem 1.5rem" : size === "lg" ? "5rem 2rem" : "3.5rem 2rem";
  const iconSize = size === "sm" ? "1.8rem" : size === "lg" ? "3.5rem" : "2.5rem";
  const titleSize = size === "sm" ? "0.85rem" : size === "lg" ? "1.15rem" : "0.95rem";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding,
      gap: "0.5rem",
    }}>
      <div style={{ fontSize: iconSize, lineHeight: 1, marginBottom: "0.25rem" }}>{icon}</div>
      <div style={{ fontSize: titleSize, fontWeight: 600, color: "var(--text-primary, #10101a)" }}>
        {title}
      </div>
      {description && (
        <div style={{
          fontSize: "0.8rem",
          color: "var(--text-secondary, #64647a)",
          maxWidth: 320,
          lineHeight: 1.5,
        }}>
          {description}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: "0.75rem",
            background: "var(--brand-600, #4f46e5)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.5rem 1.25rem",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─── Preset empty states ─────────────────────────────────── */

export function EmptyTimesheets({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon="🕐"
      title="No timesheet entries yet"
      description="Start tracking your time by adding your first entry for this week."
      action={onAdd ? { label: "Add entry", onClick: onAdd } : undefined}
    />
  );
}

export function EmptyLeave({ onApply }: { onApply?: () => void }) {
  return (
    <EmptyState
      icon="🌴"
      title="No leave requests"
      description="You haven't submitted any leave requests. Plan your time off here."
      action={onApply ? { label: "Apply for leave", onClick: onApply } : undefined}
    />
  );
}

export function EmptyApprovals() {
  return (
    <EmptyState
      icon="✅"
      title="All caught up!"
      description="There are no pending approvals right now. Check back later."
    />
  );
}

export function EmptyReports() {
  return (
    <EmptyState
      icon="📊"
      title="No data for this period"
      description="Try adjusting the date range or filters to see results."
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon="🔍"
      title={`No results for "${query}"`}
      description="Try a different search term or clear the filter."
      size="sm"
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon="🔔"
      title="No notifications"
      description="You're all up to date."
      size="sm"
    />
  );
}
