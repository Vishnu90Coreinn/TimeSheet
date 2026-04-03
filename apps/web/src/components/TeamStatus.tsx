/**
 * TeamStatus.tsx — Manager Team Status Board (Sprint 15 + UX Audit)
 * Manager + Admin only. Shows each direct report's daily attendance,
 * week progress, timesheet status, and pending approvals.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { StatusBadge, toBadgeStatus } from "./StatusBadge";
import type { TeamMemberStatus } from "../types";
import { AppButton } from "./ui";

type Filter = "all" | "missing" | "needs-approval" | "on-leave";

const FILTER_LABELS: Record<Filter, string> = {
  all:              "All",
  missing:          "Missing Today",
  "needs-approval": "Needs Approval",
  "on-leave":       "On Leave",
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtLocalTime(isoUtc: string | null): string | null {
  if (!isoUtc) return null;
  return new Date(isoUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtHours(minutes: number): string {
  if (minutes === 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Format ISO date as "Mar 17, 2026" */
function fmtDateDisplay(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "2-digit", year: "numeric",
    });
  } catch { return iso; }
}

// ── Dynamic subtitle ──────────────────────────────────────────────────────────

/** M1 — Build dynamic subtitle from live counts */
export function buildSubtitle(
  total: number,
  missing: number,
  needsApproval: number,
): string {
  if (total === 0) return "No direct reports assigned";
  const parts: string[] = [`${total} member${total !== 1 ? "s" : ""}`];
  if (missing > 0) parts.push(`${missing} missing today`);
  if (needsApproval > 0)
    parts.push(`${needsApproval} need${needsApproval !== 1 ? "" : "s"} approval`);
  return parts.join(" · ");
}

// ── Custom Date Picker — trigger + fully custom calendar grid (H1) ───────────

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const CAL_DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/** Fully custom calendar grid — no <input type="date"> */
function MiniCalendar({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (d: string) => void;
  onClose: () => void;
}) {
  const parsedDate = (() => { try { return new Date(value + "T00:00:00"); } catch { return new Date(); } })();
  const [viewYear, setViewYear]   = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  const todayStr = todayIso();

  // Build a 6-row × 7-col grid (42 cells)
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();       // 0=Sun
  const daysInMonth   = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev    = new Date(viewYear, viewMonth, 0).getDate();

  type CalCell = { iso: string; day: number; inMonth: boolean };
  const cells: CalCell[] = [];

  // Trailing days from previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const m = viewMonth === 0 ? 12 : viewMonth;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ iso: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: true });
  }
  // Leading days from next month
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    const m = viewMonth === 11 ? 1 : viewMonth + 2;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ iso: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="select-none w-[224px]">
      {/* Month / year navigation */}
      <div className="flex items-center justify-between mb-2">
        <AppButton
          type="button"
          unstyled
          className="bg-transparent border-0 cursor-pointer px-2 py-[2px] rounded-sm text-base leading-none text-text-secondary flex items-center"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          ‹
        </AppButton>
        <span className="text-[0.82rem] font-bold text-text-primary">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <AppButton
          type="button"
          unstyled
          className="bg-transparent border-0 cursor-pointer px-2 py-[2px] rounded-sm text-base leading-none text-text-secondary flex items-center"
          onClick={nextMonth}
          aria-label="Next month"
        >
          ›
        </AppButton>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {CAL_DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[0.62rem] text-text-tertiary font-semibold py-[2px]">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map(cell => {
          const isSelected = cell.iso === value;
          const isToday    = cell.iso === todayStr;
          return (
            <AppButton
              key={cell.iso}
              type="button"
              unstyled
              onClick={() => { onChange(cell.iso); onClose(); }}
              className="rounded cursor-pointer text-[0.72rem] leading-[28px] h-7 p-0"
              style={{
                border: isToday && !isSelected ? "1px solid var(--brand-400)" : "1px solid transparent",
                fontWeight: isSelected || isToday ? 700 : 400,
                background: isSelected ? "var(--brand-500)" : "transparent",
                color: isSelected ? "#fff"
                  : isToday      ? "var(--brand-600)"
                  : cell.inMonth ? "var(--text-primary)"
                  : "var(--text-tertiary)",
                opacity: cell.inMonth ? 1 : 0.45,
              }}
              aria-label={cell.iso}
              aria-pressed={isSelected}
            >
              {cell.day}
            </AppButton>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div className="mt-2 border-t border-border-subtle pt-2">
        <AppButton
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-[0.75rem]"
          onClick={() => { onChange(todayIso()); onClose(); }}
        >
          Today
        </AppButton>
      </div>
    </div>
  );
}

function DatePicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <AppButton
        type="button"
        variant="outline"
        size="sm"
        className="flex items-center gap-[6px]"
        onClick={() => setOpen(v => !v)}
        aria-label={`Selected date: ${fmtDateDisplay(value)}. Click to change`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarIcon />
        {fmtDateDisplay(value)}
      </AppButton>

      {open && (
        <div
          role="dialog"
          aria-label="Date picker"
          className="absolute top-[calc(100%+6px)] right-0 z-[200] ts-date-popover border border-border-subtle rounded-md shadow-md p-3"
        >
          <MiniCalendar value={value} onChange={onChange} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ member }: { member: TeamMemberStatus }) {
  const initials = (member.displayName || member.username).slice(0, 2).toUpperCase();
  if (member.avatarDataUrl) {
    return (
      <div
        className="w-8 h-8 rounded-md shrink-0 border border-border-subtle"
        style={{
          backgroundImage: `url(${member.avatarDataUrl})`,
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-md shrink-0 flex items-center justify-center text-[0.68rem] font-bold text-white"
      style={{ background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))" }}
    >
      {initials}
    </div>
  );
}

// ── Week progress bar (H3) ─────────────────────────────────────────────────────

function WeekBar({ logged, expected }: { logged: number; expected: number }) {
  const pct = expected > 0 ? Math.min(100, Math.round((logged / expected) * 100)) : 0;
  // H3: green ≥80%, yellow 40–79%, red <40%
  const color = pct >= 80 ? "#10b981" : pct >= 40 ? "#f59e0b" : pct > 0 ? "#ef4444" : "#e5e7eb";
  const loggedH = (logged / 60).toFixed(1);
  const expectedH = (expected / 60).toFixed(1);
  const tooltip = `${loggedH}h logged of ${expectedH}h weekly target`;

  return (
    <div className="min-w-[110px]">
      <div className="flex justify-between text-[11px] text-text-tertiary mb-[3px]">
        <span>{fmtHours(logged)}</span>
        <span>{fmtHours(expected)}</span>
      </div>
      <div
        title={tooltip}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={tooltip}
        className="h-[5px] rounded-[3px] bg-n-100 overflow-hidden"
      >
        <div
          className="h-full rounded-[3px] transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {/* H3: percentage label */}
      <div
        className="text-right text-[10px] font-semibold mt-[2px]"
        style={{ color: pct === 0 ? "var(--text-tertiary)" : color }}
      >
        {pct}%
      </div>
    </div>
  );
}

// ── Clock icon for "Check-in Time" header (H2) ────────────────────────────────

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="inline align-middle mr-1">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

// ── Arrow right icon (H4) ─────────────────────────────────────────────────────

function ArrowRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="inline align-middle ml-[3px]">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

// ── Checkmark icon for Approve button (M3) ────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="inline align-middle">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ── Empty state icon (H5) ─────────────────────────────────────────────────────

function EmptyTeamIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--n-300)"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

// ── KPI strip icons ───────────────────────────────────────────────────────────

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <polyline points="17 11 19 13 23 9"/>
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 22h14"/><path d="M5 2h14"/>
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
    </svg>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function RowSkeleton() {
  const pulse: React.CSSProperties = { background: "var(--n-100)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ ...pulse, width: 32, height: 32, borderRadius: 6, flexShrink: 0 }} />
      <div style={{ ...pulse, flex: 1, height: 13 }} />
      <div style={{ ...pulse, width: 72, height: 22, borderRadius: 20 }} />
      <div style={{ ...pulse, width: 48, height: 13 }} />
      <div style={{ ...pulse, width: 110, height: 8, borderRadius: 4 }} />
      <div style={{ ...pulse, width: 60, height: 22, borderRadius: 20 }} />
      <div style={{ ...pulse, width: 80, height: 28, borderRadius: 6 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamStatus() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [filter, setFilter] = useState<Filter>("all");
  const [reminding, setReminding] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const r = await apiFetch(`/manager/team-status?date=${d}`);
    if (r.ok) setMembers(await r.json() as TeamMemberStatus[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(date); }, [load, date]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function remind(userId: string, username: string) {
    setReminding(prev => new Set(prev).add(userId));
    const r = await apiFetch(`/manager/remind/${userId}`, { method: "POST" });
    setReminding(prev => { const s = new Set(prev); s.delete(userId); return s; });
    if (r.ok || r.status === 204) showToast(`Reminder sent to ${username}.`);
    else showToast("Failed to send reminder.");
  }

  // C3 — Summary counts for filter chips
  const counts: Record<Filter, number> = {
    all:              members.length,
    missing:          members.filter(m => m.todayTimesheetStatus === "missing").length,
    "needs-approval": members.filter(m => m.pendingApprovalCount > 0).length,
    "on-leave":       members.filter(m => m.attendance === "onLeave").length,
  };

  // Present = checked in OR checked out (showed up today)
  const presentCount = members.filter(m => m.attendance === "checkedIn" || m.attendance === "checkedOut").length;

  const filtered = members.filter(m => {
    if (filter === "missing")          return m.todayTimesheetStatus === "missing";
    if (filter === "needs-approval")   return m.pendingApprovalCount > 0;
    if (filter === "on-leave")         return m.attendance === "onLeave";
    return true;
  });

  // M1 — Dynamic subtitle
  const subtitle = buildSubtitle(members.length, counts.missing, counts["needs-approval"]);

  // KPI strip data
  const kpiCards = [
    {
      label: "TOTAL MEMBERS",
      value: loading ? "—" : String(members.length),
      sub: loading ? "Loading…" : members.length === 1 ? "1 direct report" : `${members.length} direct reports`,
      color: "#6366f1", bg: "#eef2ff",
      icon: <UsersIcon />,
    },
    {
      label: "PRESENT TODAY",
      value: loading ? "—" : String(presentCount),
      sub: loading ? "" : presentCount === members.length && members.length > 0
        ? "Full attendance today"
        : `${members.length - presentCount} absent`,
      color: "#10b981", bg: "#ecfdf5",
      icon: <UserCheckIcon />,
    },
    {
      label: "MISSING TODAY",
      value: loading ? "—" : String(counts.missing),
      sub: loading ? "" : counts.missing > 0 ? "No timesheet submitted" : "All submitted",
      color: !loading && counts.missing > 0 ? "#ef4444" : "#64748b",
      bg: !loading && counts.missing > 0 ? "#fef2f2" : "#f8fafc",
      icon: <AlertTriangleIcon />,
    },
    {
      label: "NEEDS APPROVAL",
      value: loading ? "—" : String(counts["needs-approval"]),
      sub: loading ? "" : counts["needs-approval"] > 0 ? "Awaiting your review" : "Nothing pending",
      color: !loading && counts["needs-approval"] > 0 ? "#f59e0b" : "#64748b",
      bg: !loading && counts["needs-approval"] > 0 ? "#fffbeb" : "#f8fafc",
      icon: <HourglassIcon />,
    },
  ];

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "#111827", color: "#fff", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.22)", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          {toast}
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Page Header ─────────────────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <div className="page-title">Team Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
              <span className="page-subtitle" style={{ margin: 0 }}>{subtitle}</span>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>
        </div>

        {/* ── KPI Stats Strip ─────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {kpiCards.map(k => (
            <div key={k.label} style={{ background: "var(--n-0)", border: "1px solid var(--border-subtle)", borderLeft: `3px solid ${k.color}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: k.color }}>
                {k.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Card (filter tabs + table) ─────────────────────────────────── */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>

          {/* Filter tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", padding: "0 4px", overflowX: "auto" }}>
            {(Object.keys(FILTER_LABELS) as Filter[]).map(f => {
              const isActive = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "12px 14px", fontSize: 13, fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--brand-600, #5046e5)" : "var(--text-secondary)",
                    background: "transparent", border: "none",
                    borderBottom: `2px solid ${isActive ? "var(--brand-500, #6366f1)" : "transparent"}`,
                    cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.15s",
                    marginBottom: -1, outline: "none",
                  }}
                >
                  {FILTER_LABELS[f]}
                  <span style={{
                    background: isActive ? "var(--brand-100, #e0e7ff)" : "var(--n-100, #f1f5f9)",
                    color: isActive ? "var(--brand-600, #5046e5)" : "var(--text-tertiary)",
                    borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
                    minWidth: 20, textAlign: "center", display: "inline-block",
                  }}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Body */}
          {loading ? (
            <div>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : filtered.length === 0 && members.length === 0 ? (
            <div style={{ padding: "52px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--n-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EmptyTeamIcon />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>No direct reports assigned</div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", maxWidth: 300, lineHeight: 1.6 }}>
                You don't have any team members yet. Ask your admin to assign employees to you.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 14, color: "var(--text-tertiary)" }}>
              No team members match this filter.
            </div>
          ) : (
            <div>
              <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }} role="grid">
                <thead>
                  <tr>
                    <th style={{ width: "22%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Member</th>
                    <th style={{ width: "13%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Attendance</th>
                    <th style={{ width: "11%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <ClockIcon />Check-in
                    </th>
                    <th style={{ width: "20%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Week Progress</th>
                    <th style={{ width: "12%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Timesheet</th>
                    <th style={{ width: "22%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const isReminding = reminding.has(m.userId);
                    const tsStatus = toBadgeStatus(m.todayTimesheetStatus);
                    const attStatus = toBadgeStatus(m.attendance === "onLeave" ? "on-leave" : m.attendance);

                    // Row left-border accent by priority: missing > needs approval > on leave
                    const rowAccent =
                      m.todayTimesheetStatus === "missing" ? "#ef4444"
                      : m.pendingApprovalCount > 0 ? "#f59e0b"
                      : m.attendance === "onLeave" ? "#6366f1"
                      : undefined;

                    return (
                      <tr key={m.userId} style={rowAccent ? { borderLeft: `3px solid ${rowAccent}` } : {}}>
                        {/* Member */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar member={m} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.displayName || m.username}>
                                {m.displayName || m.username}
                              </div>
                              {m.displayName && (
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`@${m.username}`}>
                                  @{m.username}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Attendance */}
                        <td><StatusBadge status={attStatus} /></td>

                        {/* Check-in / out */}
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {m.checkInAtUtc ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{fmtLocalTime(m.checkInAtUtc)}</div>
                              {m.checkOutAtUtc && (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{fmtLocalTime(m.checkOutAtUtc)}</div>
                              )}
                            </div>
                          ) : <span aria-label="No check-in recorded">—</span>}
                        </td>

                        {/* Week progress */}
                        <td><WeekBar logged={m.weekLoggedMinutes} expected={m.weekExpectedMinutes} /></td>

                        {/* Timesheet */}
                        <td><StatusBadge status={tsStatus} /></td>

                        {/* Actions */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {m.pendingApprovalCount > 0 && (
                              <button
                                type="button"
                                onClick={() => navigate("/approvals")}
                                title={`Review ${m.pendingApprovalCount} pending approval${m.pendingApprovalCount !== 1 ? "s" : ""}`}
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 6, background: "var(--brand-50, #eef2ff)", color: "var(--brand-600, #4f46e5)", border: "1px solid var(--brand-200, #c7d2fe)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >
                                <CheckIcon /> Review {m.pendingApprovalCount}
                              </button>
                            )}
                            {m.todayTimesheetStatus === "missing" && (
                              <button
                                type="button"
                                disabled={isReminding}
                                onClick={() => void remind(m.userId, m.username)}
                                title="Send reminder notification"
                                style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 6, background: "var(--n-0, #fff)", color: "var(--text-secondary)", border: "1px solid var(--border-default)", fontSize: 12, fontWeight: 500, cursor: isReminding ? "not-allowed" : "pointer", opacity: isReminding ? 0.55 : 1 }}
                              >
                                {isReminding ? "Sending…" : "Remind"}
                              </button>
                            )}
                            {m.pendingApprovalCount === 0 && m.todayTimesheetStatus !== "missing" && (
                              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {members.length === 1 && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
                  You're viewing all 1 direct report. Add more team members to see richer data here.
                </div>
              )}
            </div>
          )}
        </div>

      </section>
    </>
  );
}
