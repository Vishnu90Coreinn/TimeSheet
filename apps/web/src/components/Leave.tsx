/**
 * Leave.tsx — PulseHQ design v3.0
 */
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import type { LeaveBalance, LeaveRequest, LeaveRequestGroup, LeaveType, TeamLeaveEntry } from "../types";

// ─── Types ─────────────────────────────────────────────────────
interface CalendarEntry { date: string; type: "pending" | "approved" }

interface LeaveProps {
  isManager: boolean;
  isAdmin: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────
const BALANCE_COLORS = ["#6366f1","#10b981","#f59e0b","#3b82f6","#ec4899","#8b5cf6"];

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
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(status: string) {
  if (status === "approved") return <span className="badge badge-success">{status}</span>;
  if (status === "rejected") return <span className="badge badge-error">{status}</span>;
  if (status === "pending")  return <span className="badge badge-warning">{status}</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["SU","MO","TU","WE","TH","FR","SA"];

// ─── Scoped styles ─────────────────────────────────────────────
const PAGE_STYLES = `
.lv3-layout { display: flex; gap: var(--space-6); align-items: flex-start; }
.lv3-main   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-6); }
.lv3-sidebar { width: 300px; flex-shrink: 0; position: sticky; top: var(--space-6);
  display: flex; flex-direction: column; gap: var(--space-5); }
@media (max-width: 900px) {
  .lv3-layout { flex-direction: column; }
  .lv3-sidebar { width: 100%; position: static; }
}

/* Balance cards */
.lv3-balances { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-4); }
.lv3-bal-card { background: var(--n-0); border: 1px solid var(--border-subtle); border-radius: var(--r-xl);
  padding: var(--space-5); box-shadow: var(--shadow-xs); display: flex; flex-direction: column; gap: var(--space-3); }
.lv3-bal-type { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--text-tertiary); }
.lv3-bal-days { font-size: 2.25rem; font-weight: 800; line-height: 1; font-family: var(--font-display); }
.lv3-bal-of   { font-size: 0.78rem; color: var(--text-secondary); }
.lv3-bal-bar  { height: 5px; border-radius: var(--r-full); background: var(--n-100); overflow: hidden; }
.lv3-bal-fill { height: 100%; border-radius: var(--r-full); transition: width 0.4s; }

/* Form grid */
.lv3-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
@media (max-width: 640px) { .lv3-form-grid { grid-template-columns: 1fr; } }
.lv3-form-full { grid-column: 1 / -1; }

/* History header */
.lv3-hist-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.lv3-year-sel { font-size: 0.825rem; padding: 5px var(--space-3); border: 1px solid var(--border-default);
  border-radius: var(--r-md); background: var(--n-0); color: var(--text-primary);
  font-family: var(--font-sans); cursor: pointer; }
.lv3-hist-sub { font-size: 0.8rem; color: var(--text-secondary); margin-top: var(--space-2); }

/* Mini calendar */
.lv3-cal { background: var(--n-0); border: 1px solid var(--border-subtle); border-radius: var(--r-xl);
  padding: var(--space-5); box-shadow: var(--shadow-xs); }
.lv3-cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
.lv3-cal-month { font-size: 0.9rem; font-weight: 700; color: var(--text-primary); }
.lv3-cal-btn { background: none; border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  width: 28px; height: 28px; cursor: pointer; font-size: 0.8rem; color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; }
.lv3-cal-btn:hover { background: var(--n-100); }
.lv3-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.lv3-cal-day-label { font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-align: center;
  padding: 2px 0 4px; }
.lv3-cal-cell { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 3px 2px;
  min-height: 34px; }
.lv3-cal-num { font-size: 0.75rem; font-weight: 500; color: var(--text-primary); width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); }
.lv3-cal-num.today { background: #6366f1; color: #fff; font-weight: 700; }
.lv3-cal-num.other-month { color: var(--text-tertiary); }
.lv3-cal-dot { width: 5px; height: 5px; border-radius: var(--r-full); }
.lv3-cal-legend { display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-4);
  flex-wrap: wrap; }
.lv3-cal-leg-item { display: flex; align-items: center; gap: var(--space-2); font-size: 0.72rem;
  color: var(--text-secondary); }
.lv3-cal-leg-dot { width: 7px; height: 7px; border-radius: var(--r-full); }
.lv3-cal-leg-circle { width: 14px; height: 14px; border-radius: var(--r-full); background: #6366f1; }

/* Team on leave */
.lv3-team-head { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--text-tertiary); margin-bottom: var(--space-3); }
.lv3-team-card { background: var(--n-0); border: 1px solid var(--border-subtle); border-radius: var(--r-xl);
  padding: var(--space-4) var(--space-5); box-shadow: var(--shadow-xs); }
.lv3-team-list { display: flex; flex-direction: column; gap: var(--space-3); }
.lv3-team-entry { display: flex; align-items: center; gap: var(--space-3); }
.lv3-team-avatar { width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-weight: 700;
  font-size: 0.75rem; color: #fff; }
.lv3-team-meta { flex: 1; min-width: 0; }
.lv3-team-name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }
.lv3-team-sub  { font-size: 0.72rem; color: var(--text-secondary); margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lv3-pill-away     { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: var(--r-full);
  background: #fef2f2; color: #dc2626; }
.lv3-pill-upcoming { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: var(--r-full);
  background: #f0fdfa; color: #0d9488; }

/* Manager pending */
.lv3-mgr-reject-row { background: var(--n-50); border-top: 1px solid var(--border-subtle);
  padding: var(--space-4) var(--space-5); display: flex; gap: var(--space-3);
  align-items: center; flex-wrap: wrap; }
`;

// ─── Mini Calendar Component ────────────────────────────────────
function MiniCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [calEntries, setCalEntries] = useState<CalendarEntry[]>([]);

  function loadCalendar(y: number, m: number) {
    apiFetch(`/leave/calendar?year=${y}&month=${m + 1}`)
      .then(async (r) => { if (r.ok) setCalEntries(await r.json()); })
      .catch(() => {});
  }

  useEffect(() => { loadCalendar(year, month); }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const todayStr = now.toISOString().slice(0, 10);

  const entryMap = new Map<string, "pending" | "approved">();
  for (const e of calEntries) entryMap.set(e.date, e.type);

  const cells: { day: number; monthOffset: number; dateStr: string }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const day = daysInPrev - firstDay + 1 + i;
    const d = new Date(year, month - 1, day);
    cells.push({ day, monthOffset: -1, dateStr: d.toISOString().slice(0, 10) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    cells.push({ day: d, monthOffset: 0, dateStr: dateObj.toISOString().slice(0, 10) });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const dateObj = new Date(year, month + 1, d);
    cells.push({ day: d, monthOffset: 1, dateStr: dateObj.toISOString().slice(0, 10) });
  }

  return (
    <div className="lv3-cal">
      <div className="lv3-cal-nav">
        <button className="lv3-cal-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="lv3-cal-month">{MONTH_NAMES[month]} {year}</span>
        <button className="lv3-cal-btn" onClick={nextMonth} aria-label="Next month">›</button>
      </div>
      <div className="lv3-cal-grid">
        {DAY_LABELS.map((d) => <div key={d} className="lv3-cal-day-label">{d}</div>)}
        {cells.map((cell) => {
          const isToday = cell.dateStr === todayStr && cell.monthOffset === 0;
          const entry = cell.monthOffset === 0 ? entryMap.get(cell.dateStr) : undefined;
          return (
            <div key={cell.dateStr + cell.monthOffset} className="lv3-cal-cell">
              <span className={`lv3-cal-num${isToday ? " today" : ""}${cell.monthOffset !== 0 ? " other-month" : ""}`}>
                {cell.day}
              </span>
              {entry === "pending"  && <div className="lv3-cal-dot" style={{ background: "#f59e0b" }} />}
              {entry === "approved" && <div className="lv3-cal-dot" style={{ background: "#10b981" }} />}
            </div>
          );
        })}
      </div>
      <div className="lv3-cal-legend">
        <div className="lv3-cal-leg-item">
          <div className="lv3-cal-leg-circle" />
          <span>Today</span>
        </div>
        <div className="lv3-cal-leg-item">
          <div className="lv3-cal-leg-dot" style={{ background: "#f59e0b" }} />
          <span>Pending leave</span>
        </div>
        <div className="lv3-cal-leg-item">
          <div className="lv3-cal-leg-dot" style={{ background: "#10b981" }} />
          <span>Approved leave</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export function Leave({ isManager, isAdmin }: LeaveProps) {
  const currentYear = new Date().getFullYear();

  // State
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances]     = useState<LeaveBalance[]>([]);
  const [history, setHistory]       = useState<LeaveRequestGroup[]>([]);
  const [histFallback, setHistFallback] = useState<LeaveRequest[]>([]);
  const [useFallback, setUseFallback] = useState(false);
  const [histYear, setHistYear]     = useState(currentYear);
  const [teamOnLeave, setTeamOnLeave] = useState<TeamLeaveEntry[]>([]);
  const [showTeam, setShowTeam]     = useState(false);

  // Apply form
  const applyRef = useRef<HTMLDivElement>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: "",
    fromDate: today(),
    toDate: today(),
    isHalfDay: false,
    comment: "",
  });

  // Manager state
  const [pendingLeaves, setPendingLeaves]   = useState<LeaveRequest[]>([]);
  const [rejectComments, setRejectComments] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  // Admin state
  const [leaveTypeForm, setLeaveTypeForm] = useState({ name: "", isActive: true });

  // ── Loaders ──────────────────────────────────────────────────
  function loadBalances() {
    apiFetch("/leave/balance/my")
      .then(async (r) => { if (r.ok) setBalances(await r.json()); else setBalances([]); })
      .catch(() => { setBalances([]); });
  }

  function loadHistory() {
    apiFetch("/leave/requests/my/grouped")
      .then(async (r) => {
        if (r.ok) {
          setHistory(await r.json());
          setUseFallback(false);
        } else {
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

  useEffect(() => {
    loadTypes();
    loadBalances();
    loadHistory();
    loadTeamOnLeave();
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  // ── Apply form submit ────────────────────────────────────────
  async function applyLeave(e: FormEvent) {
    e.preventDefault();
    const body = {
      leaveTypeId: leaveForm.leaveTypeId,
      fromDate: leaveForm.fromDate,
      toDate: leaveForm.toDate,
      isHalfDay: leaveForm.isHalfDay,
      comment: leaveForm.comment,
    };
    const r = await apiFetch("/leave/requests", { method: "POST", body: JSON.stringify(body) });
    if (r.ok) {
      setLeaveForm({ leaveTypeId: leaveTypes[0]?.id ?? "", fromDate: today(), toDate: today(), isHalfDay: false, comment: "" });
      loadBalances();
      loadHistory();
    }
  }

  // ── Manager review ───────────────────────────────────────────
  async function reviewLeave(id: string, approve: boolean) {
    const comment = approve ? "" : (rejectComments[id] ?? "");
    if (!approve && !comment.trim()) { alert("Rejection comment is required."); return; }
    const r = await apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve, comment }) });
    if (r.ok) {
      loadPending();
      setShowRejectForm(null);
    }
  }

  // ── Admin: create leave type ─────────────────────────────────
  async function createLeaveType(e: FormEvent) {
    e.preventDefault();
    const r = await apiFetch("/leave/types", { method: "POST", body: JSON.stringify(leaveTypeForm) });
    if (r.ok) {
      setLeaveTypeForm({ name: "", isActive: true });
      loadTypes();
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  function scrollToApply() {
    applyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstInput = applyRef.current?.querySelector("input, select") as HTMLElement | null;
    firstInput?.focus();
  }

  const historyYearOptions = [2023, 2024, 2025, 2026, 2027, 2028];

  // Filter grouped history by year
  const filteredHistory = history.filter((h) => h.fromDate.startsWith(String(histYear)));
  const filteredFallback = histFallback.filter((h) => h.leaveDate.startsWith(String(histYear)));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <style>{PAGE_STYLES}</style>

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">Leave Management</div>
          <div className="page-subtitle">FY {currentYear} · Track, apply, and manage your time off</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">Leave Report</button>
          <button className="btn btn-primary" onClick={scrollToApply}>+ Apply for Leave</button>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      <div className="lv3-layout">

        {/* ══ MAIN COLUMN ══════════════════════════════════ */}
        <div className="lv3-main">

          {/* Balance cards */}
          {balances.length > 0 && (
            <div className="lv3-balances">
              {balances.map((b, i) => {
                const color = BALANCE_COLORS[i % BALANCE_COLORS.length];
                const pct = b.totalDays > 0 ? Math.max(0, Math.min(100, (b.remainingDays / b.totalDays) * 100)) : 0;
                return (
                  <div className="lv3-bal-card" key={b.leaveTypeId}>
                    <div className="lv3-bal-type">{b.leaveTypeName}</div>
                    <div className="lv3-bal-days" style={{ color }}>{b.remainingDays}</div>
                    <div className="lv3-bal-of">of {b.totalDays} days available</div>
                    <div className="lv3-bal-bar">
                      <div className="lv3-bal-fill" style={{ width: `${pct}%`, background: color }} />
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
                <div className="lv3-form-grid">
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
                  {/* Reason — full width */}
                  <div className="form-field lv3-form-full">
                    <label className="form-label" htmlFor="lv-reason">Reason</label>
                    <textarea
                      id="lv-reason"
                      className="input-field"
                      rows={3}
                      placeholder="Brief description of the reason for leave…"
                      value={leaveForm.comment}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, comment: e.target.value }))}
                      maxLength={1000}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setLeaveForm({ leaveTypeId: leaveTypes[0]?.id ?? "", fromDate: today(), toDate: today(), isHalfDay: false, comment: "" })}
                  >
                    Reset form
                  </button>
                  <button type="submit" className="btn btn-primary">Submit request</button>
                </div>
              </form>
            </div>
          </div>

          {/* Leave History */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-header">
              <div className="lv3-hist-header" style={{ flex: 1 }}>
                <div className="card-title">Leave History</div>
                <select
                  className="lv3-year-sel"
                  value={histYear}
                  onChange={(e) => setHistYear(Number(e.target.value))}
                  aria-label="Select year"
                >
                  {historyYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: "0 var(--space-5) var(--space-2)" }}>
              <div className="lv3-hist-sub">FY {histYear}</div>
            </div>
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>TYPE</th>
                    <th>DATES</th>
                    <th>DAYS</th>
                    <th>APPLIED ON</th>
                    <th>APPROVED BY</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {!useFallback && filteredHistory.map((h) => (
                    <tr key={h.id}>
                      <td>{h.leaveTypeName}</td>
                      <td>{h.fromDate === h.toDate ? h.fromDate : `${h.fromDate} – ${h.toDate}`}</td>
                      <td>{h.days}</td>
                      <td>{h.appliedOnDate}</td>
                      <td>{h.approvedByUsername ?? "—"}</td>
                      <td>{statusBadge(h.status)}</td>
                    </tr>
                  ))}
                  {useFallback && filteredFallback.map((h) => (
                    <tr key={h.id}>
                      <td>{h.leaveTypeName}</td>
                      <td>{h.leaveDate}</td>
                      <td>1</td>
                      <td>—</td>
                      <td>—</td>
                      <td>{statusBadge(h.status)}</td>
                    </tr>
                  ))}
                  {((!useFallback && filteredHistory.length === 0) || (useFallback && filteredFallback.length === 0)) && (
                    <tr className="empty-row">
                      <td colSpan={6}>No leave records for {histYear}.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manager: Pending Leave Approvals */}
          {isManager && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Pending Leave Approvals</div>
                  <div className="card-subtitle">Leave requests awaiting your decision</div>
                </div>
                {pendingLeaves.length > 0 && <span className="badge badge-warning">{pendingLeaves.length}</span>}
              </div>
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
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                              <div
                                style={{
                                  width: 28, height: 28, borderRadius: 8,
                                  background: avatarColor(l.username),
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "0.7rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                                }}
                              >
                                {initials(l.username)}
                              </div>
                              <strong>{l.username}</strong>
                            </div>
                          </td>
                          <td>{l.leaveDate}</td>
                          <td>{l.leaveTypeName}</td>
                          <td>{l.isHalfDay ? "Half Day" : "Full Day"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                              <button className="btn btn-outline-success btn-sm" onClick={() => void reviewLeave(l.id, true)}>✓ Approve</button>
                              <button className="btn btn-outline-reject btn-sm" onClick={() => setShowRejectForm(showRejectForm === l.id ? null : l.id)}>✗ Reject</button>
                            </div>
                          </td>
                        </tr>
                        {showRejectForm === l.id && (
                          <tr key={`${l.id}-rej`}>
                            <td colSpan={5} style={{ padding: 0 }}>
                              <div className="lv3-mgr-reject-row">
                                <input
                                  className="input-field"
                                  style={{ flex: 1, maxWidth: 360 }}
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
                    {pendingLeaves.length === 0 && (
                      <tr className="empty-row"><td colSpan={5}>No pending leave requests.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin: Create Leave Type */}
          {isAdmin && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Create Leave Type</div>
                  <div className="card-subtitle">Add a new leave category for the organisation</div>
                </div>
              </div>
              <div className="card-body">
                <form onSubmit={(e) => void createLeaveType(e)} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label" htmlFor="lt-name">Leave Type Name <span className="required">*</span></label>
                    <input
                      id="lt-name"
                      className="input-field"
                      placeholder="e.g. Maternity Leave"
                      value={leaveTypeForm.name}
                      onChange={(e) => setLeaveTypeForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      maxLength={120}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.825rem", color: "var(--text-secondary)", paddingBottom: 2 }}>
                    <input
                      type="checkbox"
                      checked={leaveTypeForm.isActive}
                      onChange={(e) => setLeaveTypeForm((p) => ({ ...p, isActive: e.target.checked }))}
                      style={{ accentColor: "var(--brand-600)" }}
                    />
                    Active
                  </label>
                  <button type="submit" className="btn btn-primary">Save Leave Type</button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* ══ SIDEBAR ══════════════════════════════════════ */}
        <div className="lv3-sidebar">

          {/* Mini Calendar */}
          <MiniCalendar />

          {/* Team on Leave */}
          {showTeam && (
            <div>
              <div className="lv3-team-head">Team on Leave</div>
              <div className="lv3-team-card">
                <div className="lv3-team-list">
                  {teamOnLeave.map((t) => {
                    const isAway = t.status === "approved";
                    return (
                      <div key={t.userId} className="lv3-team-entry">
                        <div className="lv3-team-avatar" style={{ background: avatarColor(t.username) }}>
                          {initials(t.username)}
                        </div>
                        <div className="lv3-team-meta">
                          <div className="lv3-team-name">{t.username}</div>
                          <div className="lv3-team-sub">{t.fromDate === t.toDate ? t.fromDate : `${t.fromDate} – ${t.toDate}`} · {t.leaveTypeName}</div>
                        </div>
                        <span className={isAway ? "lv3-pill-away" : "lv3-pill-upcoming"}>
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
    </section>
  );
}
