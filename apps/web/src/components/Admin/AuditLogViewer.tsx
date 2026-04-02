import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, Download, X, ChevronUp, ChevronDown, Clock, User, FileText,
  Check, AlertCircle, Send, Plus, Edit2, Activity,
  ChevronLeft, ChevronRight, Copy, CheckCheck, Shield,
} from "lucide-react";
import { apiFetch } from "../../api/client";
import { AppButton, AppInput, AppPagination, AppTableShell } from "../ui";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAtUtc: string;
  hasFieldChanges: boolean;
}

interface AuditLogChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  valueType: string | null;
}

interface PageResponse {
  items: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface ActorSummary {
  userId: string;
  displayName: string;
  username: string;
}

interface AuditStats {
  totalCount: number;
  lastEventAt: string | null;
  retentionDays: number;
}

// ── Action label + badge + icon ────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  TimesheetApproved:     "Timesheet Approved",
  TimesheetRejected:     "Timesheet Rejected",
  TimesheetSubmitted:    "Timesheet Submitted",
  TimesheetCreated:      "Timesheet Created",
  TimesheetUpdated:      "Timesheet Updated",
  TimesheetEntryCreated: "Entry Created",
  TimesheetEntryUpdated: "Entry Updated",
  TimesheetEntryDeleted: "Entry Deleted",
  UserCreated:           "User Created",
  UserUpdated:           "User Updated",
  UserDeleted:           "User Deleted",
  LeaveApproved:         "Leave Approved",
  LeaveRejected:         "Leave Rejected",
  LeaveRequested:        "Leave Requested",
  ProjectCreated:        "Project Created",
  ProjectUpdated:        "Project Updated",
};

type BadgeVariant = "green" | "red" | "blue" | "purple" | "amber" | "gray";

function actionVariant(action: string): BadgeVariant {
  if (/Approved|Resolved/i.test(action)) return "green";
  if (/Rejected|Deleted|Removed/i.test(action)) return "red";
  if (/Submitted|Requested/i.test(action)) return "blue";
  if (/Created/i.test(action)) return "purple";
  if (/Updated|Changed|Modified/i.test(action)) return "amber";
  return "gray";
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green:  "bg-[#d1fae5] text-[#065f46]",
  red:    "bg-[#fee2e2] text-[#991b1b]",
  blue:   "bg-[#dbeafe] text-[#1e40af]",
  purple: "bg-[#ede9fe] text-[#5b21b6]",
  amber:  "bg-[#fef3c7] text-[#92400e]",
  gray:   "bg-[#f3f4f6] text-[#374151]",
};

function BadgeIcon({ variant }: { variant: BadgeVariant }) {
  const cls = "w-[12px] h-[12px] flex-shrink-0";
  if (variant === "green")  return <Check className={cls} strokeWidth={3} aria-hidden="true" />;
  if (variant === "red")    return <AlertCircle className={cls} strokeWidth={2.5} aria-hidden="true" />;
  if (variant === "blue")   return <Send className={cls} strokeWidth={2} aria-hidden="true" />;
  if (variant === "purple") return <Plus className={cls} strokeWidth={2.5} aria-hidden="true" />;
  if (variant === "amber")  return <Edit2 className={cls} strokeWidth={2} aria-hidden="true" />;
  return <Activity className={cls} strokeWidth={2} aria-hidden="true" />;
}

// ── Entity icons ───────────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, string> = {
  Timesheet:      "📋",
  TimesheetEntry: "📝",
  User:           "👤",
  LeaveRequest:   "🌴",
  Project:        "📁",
};

// ── Date presets ───────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

const DATE_PRESETS = [
  { label: "All time",    key: "all" },
  { label: "Today",       key: "today" },
  { label: "Last 7 days", key: "7d" },
  { label: "Last 30 days",key: "30d" },
  { label: "This month",  key: "month" },
  { label: "Custom range",key: "custom" },
] as const;

type PresetKey = (typeof DATE_PRESETS)[number]["key"];

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  const sub = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); return isoDate(d); };
  if (key === "today")  return { from: today, to: today };
  if (key === "7d")     return { from: sub(6), to: today };
  if (key === "30d")    return { from: sub(29), to: today };
  if (key === "month")  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return { from: "", to: "" };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string | null, fallback: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
  }
  if (fallback) return fallback.slice(0, 2).toUpperCase();
  return "??";
}

const AVATAR_COLORS = [
  "#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#84cc16",
];
function avatarColor(id: string | null): string {
  if (!id) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function humanLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/([A-Z])/g, " $1").trim();
}

function humanEntityType(entityType: string): string {
  // Split camelCase/PascalCase: "TimesheetEntry" → "Timesheet Entry"
  return entityType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// ── ChangesDiffPanel — lazy-loaded field-level diff from API ───────────────────

function humaniseField(name: string): string {
  return name.replace(/Id$/, "").replace(/([A-Z])/g, " $1").trim();
}

function DiffCell({ value, type }: { value: string | null; type: "old" | "new" }) {
  if (value === null)
    return <span style={{ color: "var(--text-tertiary)", fontStyle: "italic", fontSize: "0.75rem" }}>—</span>;
  if (value === "[REDACTED]")
    return <span className="font-mono text-[0.72rem]" style={{ color: "var(--text-tertiary)" }}>[REDACTED]</span>;
  const style: React.CSSProperties = type === "old"
    ? { color: "#991b1b", background: "rgba(254,226,226,0.5)", textDecoration: "line-through" }
    : { color: "#065f46", background: "rgba(209,250,229,0.5)" };
  return (
    <span className="font-mono text-[0.72rem] px-1 py-0.5 rounded break-all" style={style}>
      {value}
    </span>
  );
}

function ChangesDiffPanel({ logId }: { logId: string }) {
  const [changes, setChanges] = useState<AuditLogChange[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setChanges(null);
    apiFetch(`/admin/audit-logs/${logId}/changes`)
      .then(r => r.ok ? r.json() as Promise<AuditLogChange[]> : Promise.resolve([]))
      .then(setChanges)
      .catch(() => setChanges([]))
      .finally(() => setLoading(false));
  }, [logId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3" style={{ color: "var(--text-tertiary)" }}>
        <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
          style={{ borderColor: "var(--color-primary, #6366f1)", borderTopColor: "transparent" }}
        />
        <span className="text-[0.78rem]">Loading field changes…</span>
      </div>
    );
  }

  if (!changes || changes.length === 0) {
    return (
      <p className="text-[0.78rem]" style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
        No field-level changes recorded.
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
      <table className="w-full text-[0.78rem]">
        <thead>
          <tr style={{ background: "var(--n-50)", borderBottom: "1px solid var(--border-subtle)" }}>
            <th className="px-3 py-1.5 text-left font-semibold w-[30%]" style={{ color: "var(--text-tertiary)" }}>Field</th>
            <th className="px-3 py-1.5 text-left font-semibold w-[35%]" style={{ color: "var(--text-tertiary)" }}>Before</th>
            <th className="px-3 py-1.5 text-left font-semibold w-[35%]" style={{ color: "var(--text-tertiary)" }}>After</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr key={c.fieldName} style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}>
              <td className="px-3 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                {humaniseField(c.fieldName)}
              </td>
              <td className="px-3 py-2"><DiffCell value={c.oldValue} type="old" /></td>
              <td className="px-3 py-2"><DiffCell value={c.newValue} type="new" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Try to parse structured diff from details JSON (legacy path — pre-interceptor entries)
interface FieldChange { field: string; from: string; to: string }
function parseChanges(details: string | null): FieldChange[] | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as unknown;
    if (typeof parsed === "object" && parsed !== null && "changes" in parsed) {
      const changes = (parsed as { changes: unknown }).changes;
      if (Array.isArray(changes) && changes.every(c => typeof c === "object" && c !== null && "field" in c)) {
        return changes as FieldChange[];
      }
    }
  } catch { /* plain text */ }
  return null;
}

// ── CopyButton ─────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy ${label ?? "to clipboard"}`}
      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--n-100)] transition-colors flex-shrink-0"
      aria-label={copied ? "Copied" : `Copy ${label ?? ""}`}
    >
      {copied
        ? <CheckCheck size={13} style={{ color: "#10b981" }} />
        : <Copy size={13} style={{ color: "var(--text-tertiary)" }} />}
    </button>
  );
}

// ── MultiSelectDropdown ────────────────────────────────────────────────────────

interface MultiSelectOption { value: string; label: string }

function MultiSelectDropdown({
  placeholder,
  options,
  selected,
  onChange,
}: {
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buttonLabel = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative" style={{ minWidth: "150px" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input-field w-full flex items-center justify-between gap-2 text-left"
        style={{ color: selected.length > 0 ? "var(--text-primary)" : "var(--text-tertiary)" }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-[0.82rem]">{buttonLabel}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, color: "var(--text-tertiary)" }} />
      </button>
      {open && options.length > 0 && (
        <div
          className="absolute z-20 top-full mt-1 left-0 rounded-lg shadow-xl border overflow-hidden"
          style={{
            background: "var(--surface-card, #fff)",
            borderColor: "var(--border-default)",
            minWidth: "220px",
            maxHeight: "260px",
            overflowY: "auto",
          }}
          role="listbox"
          aria-multiselectable="true"
        >
          {selected.length > 0 && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[0.75rem] font-medium border-b"
              style={{ color: "var(--color-primary, #6366f1)", borderColor: "var(--border-subtle)" }}
              onClick={() => onChange([])}
            >
              Clear selection
            </button>
          )}
          {options.map(opt => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-[0.82rem] hover:bg-[var(--n-50)]"
                style={{ color: "var(--text-primary)" }}
                role="option"
                aria-selected={checked}
              >
                <div
                  className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{
                    border: `1.5px solid ${checked ? "var(--color-primary, #6366f1)" : "var(--border-default)"}`,
                    background: checked ? "var(--color-primary, #6366f1)" : "transparent",
                  }}
                >
                  {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) => onChange(e.target.checked ? [...selected, opt.value] : selected.filter(v => v !== opt.value))}
                  tabIndex={-1}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FilterSelect — native select with consistent chevron styling ───────────────

function FilterSelect({
  value,
  onChange,
  isActive,
  minWidth,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  isActive?: boolean;
  minWidth?: number;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div className="relative" style={{ minWidth: minWidth ?? 150 }}>
      <select
        className="input-field w-full text-[0.82rem] pr-7"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          borderColor: isActive ? "var(--color-primary, #6366f1)" : undefined,
          color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
        aria-hidden="true"
      />
      {isActive && (
        <div
          className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full translate-x-[-4px] translate-y-[4px]"
          style={{ background: "var(--color-primary, #6366f1)" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────

function DetailDrawer({
  entry,
  allItems,
  onClose,
  onNavigate,
}: {
  entry: AuditLogEntry;
  allItems: AuditLogEntry[];
  onClose: () => void;
  onNavigate: (e: AuditLogEntry) => void;
}) {
  const idx = allItems.findIndex(i => i.id === entry.id);
  const canPrev = idx > 0;
  const canNext = idx < allItems.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft" && canPrev) onNavigate(allItems[idx - 1]);
      if (e.key === "ArrowRight" && canNext) onNavigate(allItems[idx + 1]);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, canPrev, canNext, allItems, idx, onNavigate]);

  const variant = actionVariant(entry.action);
  const label = humanLabel(entry.action);
  const localTs = absoluteTime(entry.createdAtUtc);
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isoTs = new Date(entry.createdAtUtc).toISOString();

  return (
    <>
      <div
        className="fixed right-0 bottom-0 left-0 z-40"
        style={{ top: "var(--topbar-height, 52px)", background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Audit log entry detail"
        className="fixed right-0 bottom-0 z-50 flex flex-col"
        style={{
          top: "var(--topbar-height, 52px)",
          width: "min(480px, 100vw)",
          background: "var(--surface-card, #fff)",
          borderLeft: "1px solid var(--border-default)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-default)", background: "var(--n-25, rgba(0,0,0,0.015))" }}
        >
          {/* Left: action badge + entry position */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 text-[0.75rem] font-bold rounded-[6px] px-2.5 py-1 whitespace-nowrap flex-shrink-0 ${BADGE_STYLES[variant]}`}
            >
              <BadgeIcon variant={variant} />
              {label}
            </span>
            <span className="text-[0.72rem] whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
              {idx + 1} / {allItems.length}
            </span>
          </div>
          {/* Right: nav controls + close */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Prev / Next — always rendered as outline buttons so they're always visible */}
            <button
              type="button"
              className="btn btn-outline btn-sm px-2 py-0"
              style={{
                opacity: canPrev ? 1 : 0.35,
                cursor: canPrev ? "pointer" : "default",
              }}
              onClick={() => canPrev && onNavigate(allItems[idx - 1])}
              aria-label="Previous entry"
              aria-disabled={!canPrev}
              title={canPrev ? "Previous (←)" : "No previous entry"}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm px-2 py-0"
              style={{
                opacity: canNext ? 1 : 0.35,
                cursor: canNext ? "pointer" : "default",
              }}
              onClick={() => canNext && onNavigate(allItems[idx + 1])}
              aria-label="Next entry"
              aria-disabled={!canNext}
              title={canNext ? "Next (→)" : "No next entry"}
            >
              <ChevronRight size={14} />
            </button>
            {/* Separator */}
            <div className="w-px h-4 mx-0.5 flex-shrink-0" style={{ background: "var(--border-default)" }} aria-hidden="true" />
            {/* Close */}
            <button
              type="button"
              className="btn btn-ghost btn-sm p-1.5"
              onClick={onClose}
              aria-label="Close detail panel"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Timestamp + Log ID (compliance anchor near top) */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>Timestamp</p>
              <p className="text-[0.88rem] font-semibold" style={{ color: "var(--text-primary)" }}>{localTs}</p>
              <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{tzName} · {relativeTime(entry.createdAtUtc)}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>Log ID</p>
              <div className="flex items-center gap-1 justify-end">
                <p className="font-mono text-[0.68rem]" style={{ color: "var(--text-tertiary)" }}>
                  {entry.id.slice(0, 8)}…
                </p>
                <CopyButton text={entry.id} label="log entry ID" />
              </div>
            </div>
          </div>

          {/* ISO timestamp — monospace code block with own copy button */}
          <div
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[6px]"
            style={{ background: "var(--n-50)", border: "1px solid var(--border-subtle)" }}
          >
            <code className="font-mono text-[0.68rem] truncate" style={{ color: "var(--text-secondary)" }}>
              {isoTs}
            </code>
            <CopyButton text={isoTs} label="ISO timestamp" />
          </div>

          {/* Actor */}
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>Actor</p>
            {entry.actorUserId ? (
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[0.72rem] flex-shrink-0"
                  style={{ background: avatarColor(entry.actorUserId) }}
                  aria-hidden="true"
                >
                  {initials(entry.actorName, entry.actorUsername)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.88rem] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {entry.actorName ?? entry.actorUsername ?? "Unknown User"}
                  </p>
                  {entry.actorUsername && (
                    <p className="text-[0.75rem]" style={{ color: "var(--text-secondary)" }}>@{entry.actorUsername}</p>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    <code className="font-mono text-[0.68rem] truncate" style={{ color: "var(--text-tertiary)" }}>{entry.actorUserId}</code>
                    <CopyButton text={entry.actorUserId} label="actor ID" />
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-[0.82rem]" style={{ color: "var(--text-tertiary)" }}>System / Automated</span>
            )}
          </div>

          {/* Resource */}
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>Resource</p>
            <div className="flex items-start gap-2.5">
              <span className="text-[1.1rem] flex-shrink-0" aria-hidden="true">{ENTITY_ICONS[entry.entityType] ?? "🔷"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[0.88rem] font-semibold" style={{ color: "var(--text-primary)" }}>{humanEntityType(entry.entityType)}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <code className="font-mono text-[0.7rem] truncate" style={{ color: "var(--text-secondary)" }}>{entry.entityId}</code>
                  <CopyButton text={entry.entityId} label="entity ID" />
                </div>
              </div>
            </div>
          </div>

          {/* What Changed — field-level diff (new) or legacy details (old) */}
          {(entry.hasFieldChanges || entry.details) && (() => {
            // New path: interceptor-captured field changes, lazy-fetched from API
            if (entry.hasFieldChanges) {
              return (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                    What Changed
                  </p>
                  <ChangesDiffPanel logId={entry.id} />
                </div>
              );
            }
            // Legacy path: manual WriteAsync — parse JSON diff blob or show plain prose
            const legacyChanges = parseChanges(entry.details);
            return (
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                  {legacyChanges ? "What Changed" : "Details"}
                </p>
                {legacyChanges ? (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
                    <table className="w-full text-[0.78rem]">
                      <thead>
                        <tr style={{ background: "var(--n-50)", borderBottom: "1px solid var(--border-subtle)" }}>
                          <th className="px-3 py-1.5 text-left font-semibold" style={{ color: "var(--text-tertiary)" }}>Field</th>
                          <th className="px-3 py-1.5 text-left font-semibold" style={{ color: "var(--text-tertiary)" }}>Before</th>
                          <th className="px-3 py-1.5 text-left font-semibold" style={{ color: "var(--text-tertiary)" }}>After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacyChanges.map((c, i) => (
                          <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}>
                            <td className="px-3 py-2 font-medium" style={{ color: "var(--text-primary)" }}>{c.field}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: "#991b1b", background: "rgba(254,226,226,0.4)" }}>{c.from}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: "#065f46", background: "rgba(209,250,229,0.4)" }}>{c.to}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[0.82rem] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {entry.details}
                  </p>
                )}
              </div>
            );
          })()}

        </div>

        {/* Footer — keyboard hint, more readable */}
        <div
          className="px-4 py-2.5 border-t flex-shrink-0 flex items-center gap-3"
          style={{ borderColor: "var(--border-subtle)", background: "var(--n-25, rgba(0,0,0,0.015))" }}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[0.65rem] font-mono font-bold"
              style={{ background: "var(--n-50)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              <ChevronLeft size={9} />
              <ChevronRight size={9} />
            </div>
            <span className="text-[0.7rem]" style={{ color: "var(--text-tertiary)" }}>Navigate entries</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex px-1.5 py-0.5 rounded border text-[0.65rem] font-mono font-bold"
              style={{ background: "var(--n-50)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              Esc
            </div>
            <span className="text-[0.7rem]" style={{ color: "var(--text-tertiary)" }}>Close</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── ActorCell ─────────────────────────────────────────────────────────────────

function ActorCell({ entry }: { entry: AuditLogEntry }) {
  if (!entry.actorUserId) {
    return (
      <span className="text-[0.75rem]" style={{ color: "var(--text-tertiary)" }}>
        System
      </span>
    );
  }
  const displayName = entry.actorName || entry.actorUsername || entry.actorUserId.slice(0, 8) + "…";
  const bg = avatarColor(entry.actorUserId);
  return (
    <div className="flex items-center gap-2" title={`${displayName} · ${entry.actorUserId}`}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[0.6rem] flex-shrink-0"
        style={{ background: bg }}
        aria-hidden="true"
      >
        {initials(entry.actorName, entry.actorUsername)}
      </div>
      <span className="text-[0.8rem] font-medium truncate" style={{ color: "var(--text-primary)", maxWidth: "130px" }}>
        {displayName}
      </span>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: AuditStats | null }) {
  if (!stats) return null;
  const cards = [
    {
      icon: <Activity size={15} aria-hidden="true" />,
      iconColor: "var(--color-primary, #6366f1)",
      label: "Total Events",
      value: stats.totalCount.toLocaleString(),
      sub: "all time",
    },
    {
      icon: <Clock size={15} aria-hidden="true" />,
      iconColor: "#10b981",
      label: "Latest Event",
      value: stats.lastEventAt ? absoluteTime(stats.lastEventAt) : "—",
      sub: stats.lastEventAt ? relativeTime(stats.lastEventAt) : undefined,
    },
    {
      icon: <Shield size={15} aria-hidden="true" />,
      iconColor: "#f59e0b",
      label: "Retention Policy",
      value: `${stats.retentionDays} days`,
      sub: "configured",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 mb-4" aria-label="Audit log statistics">
      {cards.map(c => (
        <div
          key={c.label}
          className="rounded-lg px-4 py-3 flex items-center gap-3 border"
          style={{ background: "var(--surface-card, #fff)", borderColor: "var(--border-subtle)" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--n-50)", color: c.iconColor }}
          >
            {c.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              {c.label}
            </p>
            <p className="text-[0.88rem] font-bold truncate" style={{ color: "var(--text-primary)" }}>
              {c.value}
            </p>
            {c.sub && (
              <p className="text-[0.68rem]" style={{ color: "var(--text-tertiary)" }}>{c.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AuditLogViewer() {
  // Pre-filters from URL params — e.g. /audit-logs?entityType=User&entityId={guid}
  const [searchParams] = useSearchParams();
  const initEntityType = searchParams.get("entityType") ?? "";
  const initEntityId   = searchParams.get("entityId")   ?? "";

  // Filter state — initialised from URL params when present
  const [searchInput, setSearchInput]         = useState(initEntityId);
  const [search, setSearch]                   = useState(initEntityId);
  const [actionFilters, setActionFilters]     = useState<string[]>([]);
  const [entityFilters, setEntityFilters]     = useState<string[]>(
    initEntityType ? [initEntityType] : []
  );
  const [actorFilters, setActorFilters]       = useState<string[]>([]);
  const [preset, setPreset]                   = useState<PresetKey>("all");
  const [customFrom, setCustomFrom]           = useState("");
  const [customTo, setCustomTo]               = useState("");
  const [sortOrder, setSortOrder]             = useState<"desc" | "asc">("desc");

  // Pagination
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Data
  const [data, setData]               = useState<PageResponse | null>(null);
  const [actors, setActors]           = useState<ActorSummary[]>([]);
  const [stats, setStats]             = useState<AuditStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Accumulated options for multi-select dropdowns — seed with URL-param entity type
  const [knownActions, setKnownActions]   = useState<string[]>([]);
  const [knownEntities, setKnownEntities] = useState<string[]>(
    initEntityType ? [initEntityType] : []
  );

  // Computed date range from preset
  const { fromDate, toDate } = (() => {
    if (preset === "custom") return { fromDate: customFrom, toDate: customTo };
    if (preset === "all")    return { fromDate: "", toDate: "" };
    const r = presetRange(preset);
    return { fromDate: r.from, toDate: r.to };
  })();

  // Debounce search input → search state
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortOrder });
    if (search)               params.set("search", search);
    if (actionFilters.length) params.set("action", actionFilters.join(","));
    if (entityFilters.length) params.set("entityType", entityFilters.join(","));
    if (actorFilters.length)  params.set("actorId", actorFilters.join(","));
    if (fromDate)             params.set("fromDate", fromDate);
    if (toDate)               params.set("toDate", toDate);

    const r = await apiFetch(`/admin/audit-logs?${params.toString()}`);
    if (r.ok) {
      const json = await r.json() as PageResponse;
      setData(json);
      setKnownActions(prev => Array.from(new Set([...prev, ...json.items.map(i => i.action)])).sort());
      setKnownEntities(prev => Array.from(new Set([...prev, ...json.items.map(i => i.entityType)])).sort());
    }
    setLoading(false);
  }, [page, pageSize, search, actionFilters, entityFilters, actorFilters, fromDate, toDate, sortOrder]);

  useEffect(() => { void load(); }, [load]);

  // Load actors + stats once
  useEffect(() => {
    apiFetch("/admin/audit-logs/actors")
      .then(r => r.ok ? r.json() as Promise<ActorSummary[]> : [])
      .then(setActors).catch(() => {});

    apiFetch("/admin/audit-logs/stats")
      .then(r => r.ok ? r.json() as Promise<AuditStats> : null)
      .then(s => { if (s) setStats(s); }).catch(() => {});
  }, []);

  // Reset page when filters change (except pagination itself)
  function resetPage() { setPage(1); }

  function clearFilters() {
    setSearchInput(""); setSearch("");
    setActionFilters([]); setEntityFilters([]);
    setActorFilters([]);
    setPreset("all"); setCustomFrom(""); setCustomTo("");
    setPage(1);
  }

  function handleExport() {
    const params = new URLSearchParams();
    if (search)               params.set("search", search);
    if (actionFilters.length) params.set("action", actionFilters.join(","));
    if (entityFilters.length) params.set("entityType", entityFilters.join(","));
    if (actorFilters.length)  params.set("actorId", actorFilters.join(","));
    if (fromDate)             params.set("fromDate", fromDate);
    if (toDate)               params.set("toDate", toDate);
    const a = document.createElement("a");
    a.href = `/api/v1/admin/audit-logs/export?${params.toString()}`;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const items      = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 1;
  const rangeStart = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const rangeEnd   = data ? Math.min(data.page * data.pageSize, data.totalCount) : 0;
  const hasFilters = Boolean(search || actionFilters.length || entityFilters.length || actorFilters.length || fromDate || toDate);

  const pageWindow = (() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  const actionOptions: MultiSelectOption[] = knownActions.map(a => ({ value: a, label: humanLabel(a) }));
  const entityOptions: MultiSelectOption[] = knownEntities.map(e => ({ value: e, label: e }));
  const actorOptions: MultiSelectOption[] = actors.map((a) => ({
    value: a.userId,
    label: a.displayName || a.username,
  }));

  return (
    <section>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Immutable record of system events for compliance and investigation.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm flex items-center gap-1.5"
          onClick={handleExport}
          title="Export filtered view as CSV"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* ── Data health bar ─────────────────────────────────────── */}
      <StatsBar stats={stats} />

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div className="card overflow-visible mb-4">
        <div className="mgmt-toolbar p-4">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <AppInput
              type="text"
              className="pl-8"
              placeholder="Search action, entity type, ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search actions, entities, details"
            />
          </div>
          <MultiSelectDropdown
            placeholder="All actions"
            options={actionOptions}
            selected={actionFilters}
            onChange={(v) => { setActionFilters(v); resetPage(); }}
          />
          <MultiSelectDropdown
            placeholder="All resources"
            options={entityOptions}
            selected={entityFilters}
            onChange={(v) => { setEntityFilters(v); resetPage(); }}
          />
          <MultiSelectDropdown
            placeholder="All actors"
            options={actorOptions}
            selected={actorFilters}
            onChange={(v) => { setActorFilters(v); resetPage(); }}
          />
          <AppButton type="button" variant="primary" size="sm" onClick={() => { setSearch(searchInput); setPage(1); }}>
            Search
          </AppButton>
          {hasFilters && (
            <AppButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setActionFilters([]);
                setEntityFilters([]);
                setActorFilters([]);
                setPage(1);
              }}
            >
              Clear
            </AppButton>
          )}
        </div>

        {/* Record count summary */}
        {data && (
          <div className="px-4 pb-3">
            <span className="text-[0.75rem]" style={{ color: "var(--text-tertiary)" }}>
              {data.totalCount === 0
                ? "No records match your filters"
                : `Showing records ${rangeStart}–${rangeEnd} of ${data.totalCount.toLocaleString()}`}
              {hasFilters && (
                <> · <button type="button" className="underline" style={{ color: "var(--color-primary, #6366f1)" }} onClick={clearFilters}>Clear filters</button></>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <AppTableShell className="overflow-x-auto">
          <table className="table-base mgmt-table w-full">
            <thead>
              <tr>
                <th scope="col">
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.75rem" }}
                    onClick={() => { setSortOrder(s => s === "desc" ? "asc" : "desc"); setPage(1); }}
                    aria-sort={sortOrder === "desc" ? "descending" : "ascending"}
                    title={`Sort ${sortOrder === "desc" ? "oldest first" : "newest first"}`}
                  >
                    <Clock size={12} aria-hidden="true" />
                    Timestamp
                    {sortOrder === "desc" ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronUp size={12} aria-hidden="true" />}
                  </button>
                </th>
                <th scope="col"><span className="flex items-center gap-1"><User size={12} aria-hidden="true" />Actor</span></th>
                <th scope="col">Action</th>
                <th scope="col">Resource</th>
                <th scope="col"><span className="flex items-center gap-1"><FileText size={12} aria-hidden="true" />Details</span></th>
                <th scope="col" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j}><div className="skeleton h-3 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="py-14 flex flex-col items-center gap-3 text-center">
                      <div className="text-5xl opacity-20" aria-hidden="true">🔍</div>
                      <div>
                        <p className="text-[0.95rem] font-semibold" style={{ color: "var(--text-primary)" }}>
                          No audit entries found
                        </p>
                        <p className="text-[0.82rem] mt-1" style={{ color: "var(--text-tertiary)" }}>
                          {hasFilters
                            ? "No events match your current filters."
                            : "No system events have been recorded yet."}
                        </p>
                      </div>
                      {hasFilters && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((entry, rowIdx) => {
                  const variant = actionVariant(entry.action);
                  const label = humanLabel(entry.action);
                  const icon = ENTITY_ICONS[entry.entityType] ?? "🔷";
                  const shortId = entry.entityId.length > 10
                    ? `${entry.entityId.slice(0, 10)}…`
                    : entry.entityId;
                  const isEven = rowIdx % 2 === 1;

                  return (
                    <tr
                      key={entry.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`${label} by ${entry.actorName ?? "System"} — press Enter to view details`}
                      aria-haspopup="dialog"
                      style={{
                        background: isEven ? "var(--n-50, rgba(0,0,0,0.025))" : undefined,
                        cursor: "pointer",
                        transition: "background 0.12s",
                        outline: "none",
                      }}
                      onClick={() => setSelectedEntry(entry)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedEntry(entry); } }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isEven ? "var(--n-50, rgba(0,0,0,0.025))" : "")}
                      onFocus={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")}
                      onBlur={(e) => (e.currentTarget.style.background = isEven ? "var(--n-50, rgba(0,0,0,0.025))" : "")}
                    >
                      {/* Timestamp — absolute primary, relative secondary */}
                      <td className="whitespace-nowrap">
                        <div>
                          <span className="text-[0.8rem] font-medium" style={{ color: "var(--text-primary)" }}>
                            {absoluteTime(entry.createdAtUtc)}
                          </span>
                          <br />
                          <span className="text-[0.7rem]" style={{ color: "var(--text-tertiary)" }}>
                            {relativeTime(entry.createdAtUtc)}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td><ActorCell entry={entry} /></td>

                      {/* Action badge with icon */}
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 text-[0.72rem] font-bold rounded-[6px] px-2 py-[3px] whitespace-nowrap ${BADGE_STYLES[variant]}`}
                          aria-label={`Action: ${label}`}
                        >
                          <BadgeIcon variant={variant} />
                          {label}
                        </span>
                      </td>

                      {/* Resource (merged) */}
                      <td>
                        <div className="flex flex-col gap-0">
                          <span className="flex items-center gap-1 text-[0.8rem] font-medium" style={{ color: "var(--text-primary)" }}>
                            <span aria-hidden="true">{icon}</span>
                            {humanEntityType(entry.entityType)}
                          </span>
                          <code
                            className="font-mono text-[0.64rem] mt-0.5"
                            style={{ color: "var(--text-tertiary)", letterSpacing: "0.01em" }}
                            title={entry.entityId}
                          >
                            {shortId}
                          </code>
                        </div>
                      </td>

                      {/* Details */}
                      <td
                        className="text-[0.75rem] max-w-[200px] truncate"
                        style={{ color: "var(--text-secondary)" }}
                        title={entry.details ?? undefined}
                      >
                        {entry.details ?? <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                      </td>

                      {/* Open detail hint */}
                      <td className="pr-3 text-right" aria-hidden="true">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.75rem] font-bold"
                          style={{ background: "var(--n-100)", color: "var(--text-secondary)" }}
                        >
                          ›
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </AppTableShell>

        {/* ── Pagination ──────────────────────────────────────── */}
        {data && data.totalCount > 0 && (
          <div
            className="flex items-center justify-between flex-wrap gap-3 border-t px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {/* Range text */}
            <span className="text-[0.75rem]" style={{ color: "var(--text-tertiary)" }}>
              {rangeStart}–{rangeEnd} of {data.totalCount.toLocaleString()} entries
            </span>
            <AppPagination page={page} totalPages={totalPages} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
          </div>
        )}
      </div>

      {/* ── Detail Drawer ──────────────────────────────────────── */}
      {selectedEntry && (
        <DetailDrawer
          entry={selectedEntry}
          allItems={items}
          onClose={() => setSelectedEntry(null)}
          onNavigate={setSelectedEntry}
        />
      )}
    </section>
  );
}
