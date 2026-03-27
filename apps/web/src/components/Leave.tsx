/**
 * Leave.tsx — PulseHQ design v3.0
 */
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { SkeletonPage } from "./Skeleton";
import { EmptyLeave } from "./EmptyState";
import type { LeaveBalance, LeaveRequest, LeaveRequestGroup, LeaveType, TeamLeaveEntry, User } from "../types";

// ─── Types ─────────────────────────────────────────────────────
interface CalendarEntry { date: string; type: "pending" | "approved" | "rejected" }
interface TeamCalEntry { userId: string; username: string; displayName: string; leaveTypeName: string; status: string; }
interface TeamCalDay { date: string; entries: TeamCalEntry[]; }

interface LeaveProps {
  isManager: boolean;
  isAdmin: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────
const AVATAR_PALETTE = ["#818cf8","#a78bfa","#34d399","#60a5fa","#f472b6","#fb923c","#facc15","#4ade80","#38bdf8","#f87171"];
function avatarColor(name: string): string {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return name.split(/[\s_]+/).map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Mar 26, 2026" */
function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "Mar 17–18, 2026" for same month; "Mar 26 – Apr 2, 2026" for cross-month */
function fmtDateRange(from: string, to: string): string {
  if (from === to) return fmtDate(from);
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  if (f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth()) {
    return `${f.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${t.getDate()}, ${t.getFullYear()}`;
  }
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

/** Semantic bar color: green ≥50%, amber ≥20%, red <20% remaining */
function balanceBarColor(remaining: number, total: number): string {
  if (total === 0) return "#e5e7eb";
  const pct = (remaining / total) * 100;
  if (pct >= 50) return "#10b981";
  if (pct >= 20) return "#f59e0b";
  return "#ef4444";
}

function statusBadge(status: string) {
  if (status === "approved") return <span className="badge badge-success">{status}</span>;
  if (status === "rejected") return <span className="badge badge-error">{status}</span>;
  if (status === "pending")  return <span className="badge badge-warning">{status}</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["SU","MO","TU","WE","TH","FR","SA"];

// ─── Mini Calendar Component ────────────────────────────────────
function MiniCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [calEntries, setCalEntries] = useState<CalendarEntry[]>([]);
  const [teamCalendar, setTeamCalendar] = useState<TeamCalDay[]>([]);

  function loadCalendar(y: number, m: number) {
    apiFetch(`/leave/calendar?year=${y}&month=${m + 1}`)
      .then(async (r) => { if (r.ok) setCalEntries(await r.json()); })
      .catch(() => {});
    apiFetch(`/leave/team-calendar?year=${y}&month=${m + 1}`)
      .then(async (r) => { if (r.ok) setTeamCalendar(await r.json()); })
      .catch(() => {});
  }

  useEffect(() => { loadCalendar(year, month); }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const entryMap = new Map<string, CalendarEntry["type"]>();
  for (const e of calEntries) entryMap.set(e.date, e.type);

  const teamCalMap = new Map<string, TeamCalEntry[]>();
  for (const d of teamCalendar) teamCalMap.set(d.date, d.entries);

  const cells: { day: number; monthOffset: number; dateStr: string }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const day = daysInPrev - firstDay + 1 + i;
    const d = new Date(year, month - 1, day);
    cells.push({ day, monthOffset: -1, dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    cells.push({ day: d, monthOffset: 0, dateStr: `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,"0")}-${String(dateObj.getDate()).padStart(2,"0")}` });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const dateObj = new Date(year, month + 1, d);
    cells.push({ day: d, monthOffset: 1, dateStr: `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,"0")}-${String(dateObj.getDate()).padStart(2,"0")}` });
  }

  return (
    <div className="lv-cal">
      <div className="lv-cal-nav">
        <button className="lv-cal-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="lv-cal-month">{MONTH_NAMES[month]} {year}</span>
        <button className="lv-cal-btn" onClick={nextMonth} aria-label="Next month">›</button>
      </div>
      <div className="lv-cal-grid">
        {DAY_LABELS.map((d) => <div key={d} className="lv-cal-day-label">{d}</div>)}
        {cells.map((cell) => {
          const isToday = cell.dateStr === todayStr && cell.monthOffset === 0;
          const entry = cell.monthOffset === 0 ? entryMap.get(cell.dateStr) : undefined;
          const teamEntries = cell.monthOffset === 0 ? (teamCalMap.get(cell.dateStr) ?? []) : [];
          const visibleChips = teamEntries.slice(0, 3);
          const overflow = teamEntries.length - visibleChips.length;
          const tooltipLines = teamEntries.map((e) => `${e.displayName} — ${e.leaveTypeName}`).join("\n");
          return (
            <div key={cell.dateStr + cell.monthOffset} className="lv-cal-cell" title={teamEntries.length > 0 ? tooltipLines : undefined}>
              <span className={`lv-cal-num${isToday ? " today" : ""}${cell.monthOffset !== 0 ? " other-month" : ""}`}>
                {cell.day}
              </span>
              {entry === "pending"  && <div className="lv-cal-dot bg-[#f59e0b]" />}
              {entry === "approved" && <div className="lv-cal-dot bg-[#10b981]" />}
              {entry === "rejected" && <div className="lv-cal-dot bg-[#ef4444]" />}
              {teamEntries.length > 0 && (
                <div className="flex gap-px flex-nowrap mt-px">
                  {visibleChips.map((te) => (
                    <div
                      key={te.userId}
                      title={`${te.displayName} — ${te.leaveTypeName} (${te.status})`}
                      className="lv-cal-chip"
                      style={{
                        background: avatarColor(te.displayName),
                        opacity: te.status === "pending" ? 0.6 : 1,
                      }}
                    >
                      {initials(te.displayName)}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="lv-cal-chip bg-[#9ca3af] [font-size:0.45rem]">
                      +{overflow}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="lv-cal-legend">
        <div className="lv-cal-leg-item">
          <div className="lv-cal-leg-today" />
          <span>Today</span>
        </div>
        <div className="lv-cal-leg-item">
          <div className="lv-cal-leg-dot bg-[#f59e0b]" />
          <span>Pending</span>
        </div>
        <div className="lv-cal-leg-item">
          <div className="lv-cal-leg-dot bg-[#10b981]" />
          <span>Approved</span>
        </div>
        <div className="lv-cal-leg-item">
          <div className="lv-cal-leg-dot bg-[#ef4444]" />
          <span>Rejected</span>
        </div>
        <div className="lv-cal-leg-item">
          <div className="lv-cal-leg-dot bg-[#818cf8]" />
          <span>Team off</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export function Leave({ isManager, isAdmin }: LeaveProps) {
  const currentYear = new Date().getFullYear();

  // State
  const [loading, setLoading]           = useState(true);
  const [leaveTypes, setLeaveTypes]     = useState<LeaveType[]>([]);
  const [balances, setBalances]         = useState<LeaveBalance[]>([]);
  const [history, setHistory]           = useState<LeaveRequestGroup[]>([]);
  const [histFallback, setHistFallback] = useState<LeaveRequest[]>([]);
  const [useFallback, setUseFallback]   = useState(false);
  const [histYear, setHistYear]         = useState(currentYear);
  const [teamOnLeave, setTeamOnLeave]   = useState<TeamLeaveEntry[]>([]);
  const [showTeam, setShowTeam]         = useState(false);
  const [allUsers, setAllUsers]         = useState<User[]>([]);

  // Apply form
  const applyRef = useRef<HTMLDivElement>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: "",
    fromDate: today(),
    toDate: today(),
    isHalfDay: false,
    comment: "",
    onBehalfOfUserId: "",
  });

  // Apply form error
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");

  // Conflict warning
  const [conflicts, setConflicts] = useState<{ count: number; names: string[] } | null>(null);

  // Manager state
  const [pendingLeaves, setPendingLeaves]   = useState<LeaveRequest[]>([]);
  const [rejectComments, setRejectComments] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  // ── Loaders ──────────────────────────────────────────────────
  function loadBalances() {
    apiFetch("/leave/balance/my")
      .then(async (r) => { if (r.ok) setBalances(await r.json()); else setBalances([]); })
      .catch(() => setBalances([]));
  }

  function loadHistory() {
    apiFetch("/leave/requests/my/grouped")
      .then(async (r) => {
        if (r.ok) { setHistory(await r.json()); setUseFallback(false); }
        else {
          setUseFallback(true);
          apiFetch("/leave/requests/my")
            .then(async (r2) => { if (r2.ok) setHistFallback(await r2.json()); })
            .catch(() => {});
        }
      })
      .catch(() => {
        setUseFallback(true);
        apiFetch("/leave/requests/my")
          .then(async (r2) => { if (r2.ok) setHistFallback(await r2.json()); })
          .catch(() => {});
      });
  }

  function loadTeamOnLeave() {
    apiFetch("/leave/team-on-leave")
      .then(async (r) => {
        if (r.ok) {
          const data: TeamLeaveEntry[] = await r.json();
          setTeamOnLeave(data);
          setShowTeam(data.length > 0);
        }
      })
      .catch(() => {});
  }

  function loadTypes() {
    apiFetch("/leave/types")
      .then(async (r) => {
        if (r.ok) {
          const d: LeaveType[] = await r.json();
          setLeaveTypes(d);
          if (d.length > 0) setLeaveForm((p) => ({ ...p, leaveTypeId: p.leaveTypeId || d[0].id }));
        }
      })
      .catch(() => {});
  }

  function loadPending() {
    if (!isManager) return;
    apiFetch("/leave/requests/pending")
      .then(async (r) => { if (r.ok) setPendingLeaves(await r.json()); })
      .catch(() => {});
  }

  function loadUsers() {
    if (!isAdmin) return;
    apiFetch("/users")
      .then(async (r) => { if (r.ok) setAllUsers(await r.json()); })
      .catch(() => {});
  }

  // Fetch conflict warning when both dates are set
  useEffect(() => {
    setConflicts(null);
    if (!leaveForm.fromDate || !leaveForm.toDate) return;
    apiFetch(`/leave/conflicts?fromDate=${leaveForm.fromDate}&toDate=${leaveForm.toDate}`)
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json() as { conflictingCount: number; conflictingUsernames: string[] };
          if (data.conflictingCount > 0) {
            setConflicts({ count: data.conflictingCount, names: data.conflictingUsernames });
          } else {
            setConflicts(null);
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveForm.fromDate, leaveForm.toDate]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      new Promise<void>(res => { loadTypes(); res(); }),
      new Promise<void>(res => { loadBalances(); res(); }),
      new Promise<void>(res => { loadHistory(); res(); }),
      new Promise<void>(res => { loadTeamOnLeave(); res(); }),
      new Promise<void>(res => { loadPending(); res(); }),
      new Promise<void>(res => { loadUsers(); res(); }),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, isAdmin]);

  // ── Apply form submit ────────────────────────────────────────
  async function applyLeave(e: FormEvent) {
    e.preventDefault();
    setApplyError("");
    setApplySuccess("");

    // Client-side date validation
    if (leaveForm.toDate < leaveForm.fromDate) {
      setApplyError("'To Date' must be on or after 'From Date'.");
      return;
    }

    const body: Record<string, unknown> = {
      leaveTypeId: leaveForm.leaveTypeId,
      fromDate: leaveForm.fromDate,
      toDate: leaveForm.toDate,
      isHalfDay: leaveForm.isHalfDay,
      comment: leaveForm.comment,
    };
    if (isAdmin && leaveForm.onBehalfOfUserId) {
      body.onBehalfOfUserId = leaveForm.onBehalfOfUserId;
    }
    const r = await apiFetch("/leave/requests", { method: "POST", body: JSON.stringify(body) });
    if (r.ok) {
      setLeaveForm({ leaveTypeId: leaveTypes[0]?.id ?? "", fromDate: today(), toDate: today(), isHalfDay: false, comment: "", onBehalfOfUserId: "" });
      setApplySuccess("Leave request submitted successfully.");
      loadBalances();
      loadHistory();
    } else {
      const body2 = await r.json().catch(() => ({})) as { message?: string; detail?: string };
      setApplyError(body2.message ?? body2.detail ?? "Failed to submit leave request. Please try again.");
    }
  }

  // ── Cancel leave (with themed modal) ─────────────────────────
  const [cancelModal, setCancelModal] = useState<string | null>(null); // holds leave id

  async function confirmCancelLeave() {
    if (!cancelModal) return;
    const id = cancelModal;
    setCancelModal(null);
    const r = await apiFetch(`/leave/requests/${id}`, { method: "DELETE" });
    if (r.ok) {
      loadHistory();
      loadBalances();
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      alert(body.message ?? "Could not cancel this request.");
    }
  }

  // ── Re-apply (pre-fill form) ─────────────────────────────────
  function reApply(group: LeaveRequestGroup) {
    const leaveType = leaveTypes.find((lt) => lt.name === group.leaveTypeName);
    setLeaveForm({
      leaveTypeId: leaveType?.id ?? leaveTypes[0]?.id ?? "",
      fromDate: group.fromDate,
      toDate: group.toDate,
      isHalfDay: false,
      comment: group.comment ?? "",
      onBehalfOfUserId: "",
    });
    applyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const firstInput = applyRef.current?.querySelector("input, select") as HTMLElement | null;
      firstInput?.focus();
    }, 300);
  }

  // ── Manager review ───────────────────────────────────────────
  async function reviewLeave(id: string, approve: boolean) {
    const comment = approve ? "" : (rejectComments[id] ?? "");
    if (!approve && !comment.trim()) { alert("Rejection comment is required."); return; }
    const r = await apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve, comment }) });
    if (r.ok) { loadPending(); setShowRejectForm(null); }
  }

  // ── Helpers ──────────────────────────────────────────────────
  function scrollToApply() {
    applyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const firstInput = applyRef.current?.querySelector("input, select") as HTMLElement | null;
      firstInput?.focus();
    }, 300);
  }

  // Years with data + always include current year
  const yearsWithData = new Set(history.map((h) => Number(h.fromDate.slice(0, 4))));
  yearsWithData.add(currentYear);
  const historyYearOptions = [2023, 2024, 2025, 2026, 2027, 2028];

  // Filtered history
  const filteredHistory  = history.filter((h) => h.fromDate.startsWith(String(histYear)));
  const filteredFallback = histFallback.filter((h) => h.leaveDate.startsWith(String(histYear)));
  const historyEmpty = (!useFallback && filteredHistory.length === 0) || (useFallback && filteredFallback.length === 0);

  if (loading) return <SkeletonPage kpis={3} rows={5} cols={4} />;

  return (
    <section className="flex flex-col gap-[var(--space-6)]">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">Leave Management</div>
          <div className="page-subtitle">
            {isAdmin
              ? "Manage team leave, approvals, and policies."
              : `FY ${currentYear} · Track, apply, and manage your time off`}
          </div>
        </div>
        <div className="page-actions">
          {/* Leave Report — with download icon */}
          <button className="btn btn-outline flex items-center gap-[6px]">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3v10M6 9l4 4 4-4"/><rect x="3" y="14" width="14" height="3" rx="1"/>
            </svg>
            Leave Report
          </button>
          {/* Scroll-to-form CTA — only when not already in view */}
          <button className="btn btn-primary" onClick={scrollToApply}>+ Apply for Leave</button>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      <div className="lv-layout">

        {/* ══ MAIN COLUMN ══════════════════════════════════ */}
        <div className="lv-main">

          {/* Balance cards */}
          {balances.length > 0 && (
            <div className="lv-balances">
              {balances.map((b) => {
                const barColor = balanceBarColor(b.remainingDays, b.totalDays);
                const pct = b.totalDays > 0 ? Math.max(0, Math.min(100, (b.remainingDays / b.totalDays) * 100)) : 0;
                const tooltip = `${b.usedDays} of ${b.totalDays} days used`;
                if (b.totalDays === 0) {
                  return (
                    <div className="lv-bal-card--zero" key={b.leaveTypeId}>
                      <div className="lv-bal-type">{b.leaveTypeName}</div>
                      <div className="lv-bal-days text-[var(--n-300,#d1d5db)]">0</div>
                      <div className="lv-bal-of text-[var(--text-tertiary)]">No days allocated</div>
                      {isAdmin && (
                        <span className="lv-bal-zero-cta">Set policy →</span>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="lv-bal-card" key={b.leaveTypeId}>
                    <div className="lv-bal-type">{b.leaveTypeName}</div>
                    <div className="lv-bal-days" style={{ color: barColor }}>{b.remainingDays}</div>
                    <div className="lv-bal-of">of {b.totalDays} days available</div>
                    <div className="lv-bal-bar" title={tooltip}>
                      <div className="lv-bal-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Apply for Leave form */}
          <div className="card" ref={applyRef}>
            <div className="card-header">
              <div>
                <div className="card-title">Apply for Leave</div>
                <div className="card-subtitle">Submit a new leave request</div>
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={(e) => void applyLeave(e)}>
                <div className="lv-form-grid">

                  {/* Admin: Apply on behalf of */}
                  {isAdmin && (
                    <div className="form-field lv-form-full">
                      <label className="form-label" htmlFor="lv-onbehalf">
                        Apply on behalf of
                      </label>
                      <select
                        id="lv-onbehalf"
                        className="input-field"
                        value={leaveForm.onBehalfOfUserId}
                        onChange={(e) => setLeaveForm((p) => ({ ...p, onBehalfOfUserId: e.target.value }))}
                      >
                        <option value="">Myself</option>
                        {allUsers.filter((u) => u.isActive).map((u) => (
                          <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                      </select>
                      {leaveForm.onBehalfOfUserId && (
                        <div className="lv-onbehalf-banner">
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="10" cy="7" r="3"/><path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
                          </svg>
                          Submitting on behalf of {allUsers.find((u) => u.id === leaveForm.onBehalfOfUserId)?.username}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leave type */}
                  <div className="form-field">
                    <label className="form-label" htmlFor="lv-type">Leave Type <span className="required">*</span></label>
                    <select
                      id="lv-type"
                      className="input-field"
                      value={leaveForm.leaveTypeId}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, leaveTypeId: e.target.value }))}
                      required
                    >
                      {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                    </select>
                  </div>

                  {/* Duration */}
                  <div className="form-field">
                    <label className="form-label" htmlFor="lv-duration">Duration <span className="required">*</span></label>
                    <select
                      id="lv-duration"
                      className="input-field"
                      value={leaveForm.isHalfDay ? "half" : "full"}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, isHalfDay: e.target.value === "half" }))}
                    >
                      <option value="full">Full day</option>
                      <option value="half">Half day</option>
                    </select>
                  </div>

                  {/* From date */}
                  <div className="form-field">
                    <label className="form-label" htmlFor="lv-from">From Date <span className="required">*</span></label>
                    <input
                      id="lv-from"
                      type="date"
                      className="input-field"
                      value={leaveForm.fromDate}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, fromDate: e.target.value }))}
                      required
                    />
                  </div>

                  {/* To date */}
                  <div className="form-field">
                    <label className="form-label" htmlFor="lv-to">To Date <span className="required">*</span></label>
                    <input
                      id="lv-to"
                      type="date"
                      className="input-field"
                      value={leaveForm.toDate}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, toDate: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Conflict warning banner */}
                  {conflicts && (
                    <div className="lv-form-full flex items-start gap-[10px] bg-[#fffbeb] [border:1px_solid_#fbbf24] rounded-lg px-[14px] py-[10px] text-[0.825rem] text-[#92400e]">
                      <span className="shrink-0">⚠</span>
                      <span>
                        {conflicts.count} team member{conflicts.count !== 1 ? "s" : ""} already {conflicts.count !== 1 ? "have" : "has"} leave during these dates:{" "}
                        {conflicts.names.join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Reason — full width */}
                  <div className="form-field lv-form-full">
                    <label className="form-label" htmlFor="lv-reason">Reason</label>
                    <textarea
                      id="lv-reason"
                      className="input-field"
                      rows={3}
                      placeholder="Brief description of the reason for leave…"
                      value={leaveForm.comment}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, comment: e.target.value }))}
                      maxLength={1000}
                      style={{ resize: "vertical", minHeight: 80 }}
                    />
                  </div>
                </div>

                <div className="flex gap-[var(--space-3)] mt-[var(--space-4)]">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setLeaveForm({ leaveTypeId: leaveTypes[0]?.id ?? "", fromDate: today(), toDate: today(), isHalfDay: false, comment: "", onBehalfOfUserId: "" })}
                  >
                    Reset form
                  </button>
                  <button type="submit" className="btn btn-primary">Submit request</button>
                </div>

                {/* Form feedback */}
                {applyError && (
                  <div className="flex items-start gap-[10px] mt-[var(--space-3)] bg-[#fef2f2] [border:1px_solid_#fca5a5] rounded-lg px-[14px] py-[10px] text-[0.825rem] text-[#b91c1c]">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 mt-px">
                      <circle cx="10" cy="10" r="9"/><path d="M10 6v4M10 14h.01"/>
                    </svg>
                    {applyError}
                  </div>
                )}
                {applySuccess && (
                  <div className="flex items-center gap-[10px] mt-[var(--space-3)] bg-[#f0fdf4] [border:1px_solid_#86efac] rounded-lg px-[14px] py-[10px] text-[0.825rem] text-[#166534]">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
                      <circle cx="10" cy="10" r="9"/><path d="M6 10l3 3 5-5"/>
                    </svg>
                    {applySuccess}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Leave History */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="lv-hist-header flex-1">
                <div className="card-title">Leave History</div>
                <select
                  className="lv-year-sel"
                  value={histYear}
                  onChange={(e) => setHistYear(Number(e.target.value))}
                  aria-label="Select year"
                >
                  {historyYearOptions.map((y) => (
                    <option
                      key={y}
                      value={y}
                      disabled={y > currentYear && !yearsWithData.has(y)}
                    >
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {historyEmpty ? (
              <EmptyLeave />
            ) : (
              <div className="lv-hist-cards">
                {!useFallback && filteredHistory.map((h) => (
                  <div className="lv-hist-card" key={h.id}>
                    <div className="lv-hist-card-left">
                      <div className="lv-hist-card-type">{h.leaveTypeName}</div>
                      <div className="lv-hist-card-dates">{fmtDateRange(h.fromDate, h.toDate)}</div>
                      <div className="lv-hist-card-meta">
                        {h.days} {h.days === 1 ? "day" : "days"}
                        {" · "}Applied {fmtDate(h.appliedOnDate)}
                        {h.approvedByUsername && ` · Approved by ${h.approvedByUsername}`}
                      </div>
                    </div>
                    <div className="lv-hist-card-right">
                      {statusBadge(h.status)}
                      {(h.status === "pending" || h.status === "rejected") && (
                        <div className="lv-hist-card-actions">
                          {h.status === "rejected" && (
                            <button className="btn btn-outline btn-sm" onClick={() => reApply(h)}>Re-apply</button>
                          )}
                          {h.status === "pending" && (
                            <button
                              className="btn btn-sm [border:1px_solid_#ef4444] text-[#ef4444] bg-transparent"
                              onClick={() => setCancelModal(h.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {useFallback && filteredFallback.map((h) => (
                  <div className="lv-hist-card" key={h.id}>
                    <div className="lv-hist-card-left">
                      <div className="lv-hist-card-type">{h.leaveTypeName}</div>
                      <div className="lv-hist-card-dates">{fmtDate(h.leaveDate)}</div>
                    </div>
                    <div className="lv-hist-card-right">
                      {statusBadge(h.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manager: Pending Leave Approvals */}
          {isManager && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <div>
                  <div className="card-title">Pending Leave Approvals</div>
                  <div className="card-subtitle">Leave requests awaiting your decision</div>
                </div>
                {pendingLeaves.length > 0 && <span className="badge badge-warning">{pendingLeaves.length}</span>}
              </div>

              {pendingLeaves.length === 0 ? (
                <div className="lv-pending-empty">
                  <svg className="lv-pending-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                  </svg>
                  <div className="lv-pending-empty-title">All caught up!</div>
                  <div className="lv-pending-empty-sub">No pending leave requests right now. Your team is on track — check back later.</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table-base">
                    <thead>
                      <tr><th>Employee</th><th>Date</th><th>Type</th><th>Duration</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pendingLeaves.map((l) => (
                        <>
                          <tr key={l.id}>
                            <td>
                              <div className="flex items-center gap-[var(--space-2)]">
                                <div
                                  className="lv-table-avatar"
                                  style={{ background: avatarColor(l.username) }}
                                >
                                  {initials(l.username)}
                                </div>
                                <strong>{l.username}</strong>
                              </div>
                            </td>
                            <td>{fmtDate(l.leaveDate)}</td>
                            <td>{l.leaveTypeName}</td>
                            <td>{l.isHalfDay ? "Half Day" : "Full Day"}</td>
                            <td>
                              <div className="flex gap-[var(--space-2)]">
                                <button className="btn btn-outline-success btn-sm" onClick={() => void reviewLeave(l.id, true)}>✓ Approve</button>
                                <button className="btn btn-outline-reject btn-sm" onClick={() => setShowRejectForm(showRejectForm === l.id ? null : l.id)}>✗ Reject</button>
                              </div>
                            </td>
                          </tr>
                          {showRejectForm === l.id && (
                            <tr key={`${l.id}-rej`}>
                              <td colSpan={5} className="p-0">
                                <div className="lv-mgr-reject-row">
                                  <input
                                    className="input-field flex-1 max-w-[360px]"
                                    placeholder="Rejection comment (required)"
                                    value={rejectComments[l.id] ?? ""}
                                    onChange={(e) => setRejectComments((p) => ({ ...p, [l.id]: e.target.value }))}
                                    required
                                    maxLength={1000}
                                  />
                                  <button className="btn btn-danger btn-sm" onClick={() => void reviewLeave(l.id, false)}>Confirm Reject</button>
                                  <button className="btn btn-ghost btn-sm" onClick={() => setShowRejectForm(null)}>Cancel</button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>{/* /lv-main */}

        {/* ══ SIDEBAR ══════════════════════════════════════ */}
        <div className="lv-sidebar">

          {/* Mini Calendar */}
          <MiniCalendar />

          {/* Team on Leave */}
          {showTeam && (
            <div>
              <div className="lv-team-head">Team on Leave</div>
              <div className="lv-team-card">
                <div className="lv-team-list">
                  {teamOnLeave.map((t) => {
                    const isAway = t.status === "approved";
                    return (
                      <div key={t.userId} className="lv-team-entry">
                        <div className="lv-team-avatar" style={{ background: avatarColor(t.username) }}>
                          {initials(t.username)}
                        </div>
                        <div className="lv-team-meta">
                          <div className="lv-team-name">{t.username}</div>
                          <div className="lv-team-sub">{fmtDateRange(t.fromDate, t.toDate)} · {t.leaveTypeName}</div>
                        </div>
                        <span className={isAway ? "lv-pill-away" : "lv-pill-upcoming"}>
                          {isAway ? "Away" : "Upcoming"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cancel leave confirmation modal ─────────────────── */}
      {cancelModal && (
        <div className="lv-modal-backdrop" onClick={() => setCancelModal(null)}>
          <div className="lv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lv-modal-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div className="lv-modal-title">Cancel Leave Request</div>
            <div className="lv-modal-body">
              Are you sure you want to cancel this leave request? This action cannot be undone.
            </div>
            <div className="lv-modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setCancelModal(null)}>Keep it</button>
              <button
                className="btn btn-sm bg-[#ef4444] text-white border-none"
                onClick={() => void confirmCancelLeave()}
              >
                Yes, cancel request
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
