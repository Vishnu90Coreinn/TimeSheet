/**
 * Approvals.tsx — PulseHQ v3.0 redesign
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { ApprovalItem, LeaveRequest } from "../types";

// ─── Types ────────────────────────────────────────────────────
type Tab = "all" | "timesheets" | "leave";

interface ApprovalStats {
  approvedThisMonth: number | null;
  rejectedThisMonth: number | null;
  avgResponseHours: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────
function initials(name: string): string {
  return name.split(/[\s_]+/).map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const AVATAR_PALETTE = ["#818cf8","#a78bfa","#34d399","#60a5fa","#f472b6","#fb923c","#facc15","#4ade80","#38bdf8","#f87171"];
function avatarColor(name: string): string {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

// ─── Scoped styles ────────────────────────────────────────────
const PAGE_STYLES = `
.apr3-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); }
@media (max-width: 900px) { .apr3-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px)  { .apr3-stats { grid-template-columns: 1fr 1fr; } }
.apr3-stat { background: var(--n-0); border: 1px solid var(--border-subtle); border-radius: var(--r-xl);
  padding: var(--space-5); display: flex; align-items: center; gap: var(--space-4); box-shadow: var(--shadow-xs); }
.apr3-stat-icon { width: 40px; height: 40px; border-radius: var(--r-lg); display: flex; align-items: center;
  justify-content: center; font-size: 18px; flex-shrink: 0; }
.apr3-stat-num { font-size: 1.75rem; font-weight: 700; line-height: 1; font-family: var(--font-display); }
.apr3-stat-label { font-size: 0.78rem; color: var(--text-secondary); margin-top: 3px; }
.apr3-tabs { display: flex; align-items: center; gap: var(--space-1); background: var(--n-100);
  border-radius: var(--r-lg); padding: 4px; width: fit-content; }
.apr3-tab { padding: 6px 16px; border-radius: var(--r-md); font-size: 0.825rem; font-weight: 600;
  cursor: pointer; background: none; border: none; color: var(--text-secondary); transition: all 0.15s;
  display: flex; align-items: center; gap: 6px; font-family: var(--font-sans); }
.apr3-tab.active { background: var(--n-0); color: var(--text-primary); box-shadow: var(--shadow-xs); }
.apr3-tab-count { background: var(--n-200); color: var(--text-secondary); border-radius: var(--r-full);
  padding: 0 7px; font-size: 0.72rem; font-weight: 700; }
.apr3-tab.active .apr3-tab-count { background: var(--brand-100); color: var(--brand-700); }
.apr3-list { display: flex; flex-direction: column; gap: var(--space-3); }
.apr3-card { background: var(--n-0); border: 1px solid var(--border-subtle); border-radius: var(--r-xl);
  overflow: hidden; box-shadow: var(--shadow-xs); transition: box-shadow 0.15s; }
.apr3-card:hover { box-shadow: var(--shadow-sm); }
.apr3-card-inner { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4) var(--space-5); }
.apr3-avatar { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center;
  justify-content: center; font-weight: 700; font-size: 14px; color: #fff; flex-shrink: 0; }
.apr3-meta { flex: 1; min-width: 0; }
.apr3-meta-title { font-size: 0.9rem; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.apr3-meta-sub { font-size: 0.8rem; color: var(--text-secondary); margin-top: 3px; }
.apr3-meta-sub strong { color: var(--text-primary); font-weight: 600; }
.apr3-right { display: flex; align-items: center; gap: var(--space-4); flex-shrink: 0; }
.apr3-type-metric { text-align: right; }
.apr3-type-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em;
  color: var(--text-tertiary); text-transform: uppercase; }
.apr3-type-value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); line-height: 1.15; }
.apr3-actions { display: flex; gap: var(--space-2); }
.apr3-reject-row { background: var(--n-50); border-top: 1px solid var(--border-subtle);
  padding: var(--space-4) var(--space-5); display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; }
.apr3-empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
  padding: 60px var(--space-6); color: var(--text-secondary); text-align: center; }
.apr3-empty-icon { font-size: 2.5rem; opacity: 0.35; }
`;

// ─── Component ────────────────────────────────────────────────
export function Approvals() {
  const [tsPending, setTsPending]     = useState<ApprovalItem[]>([]);
  const [leavePending, setLeavePending] = useState<LeaveRequest[]>([]);
  const [stats, setStats]             = useState<ApprovalStats>({ approvedThisMonth: null, rejectedThisMonth: null, avgResponseHours: null });
  const [tab, setTab]                 = useState<Tab>("all");
  const [rejectFor, setRejectFor]     = useState<{ id: string; kind: "ts" | "leave" } | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [bulkApproving, setBulkApproving] = useState(false);

  function loadData() {
    apiFetch("/approvals/pending-timesheets").then(async (r) => { if (r.ok) setTsPending(await r.json()); });
    apiFetch("/leave/requests/pending").then(async (r) => { if (r.ok) setLeavePending(await r.json()); });
    void apiFetch("/approvals/stats").then(async (r) => { if (r.ok) setStats(await r.json()); });
  }

  useEffect(() => { loadData(); }, []);

  async function approveTs(timesheetId: string) {
    const r = await apiFetch(`/approvals/timesheets/${timesheetId}/approve`, { method: "POST", body: JSON.stringify({ comment: "" }) });
    if (r.ok) loadData();
  }

  async function confirmRejectTs(timesheetId: string) {
    if (!rejectComment.trim()) { alert("Comment required for rejection."); return; }
    const r = await apiFetch(`/approvals/timesheets/${timesheetId}/reject`, { method: "POST", body: JSON.stringify({ comment: rejectComment }) });
    if (r.ok) { setRejectFor(null); setRejectComment(""); loadData(); }
  }

  async function approveLeave(id: string) {
    const r = await apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve: true, comment: "" }) });
    if (r.ok) loadData();
  }

  async function confirmRejectLeave(id: string) {
    if (!rejectComment.trim()) { alert("Comment required for rejection."); return; }
    const r = await apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve: false, comment: rejectComment }) });
    if (r.ok) { setRejectFor(null); setRejectComment(""); loadData(); }
  }

  async function bulkApprove() {
    setBulkApproving(true);
    await Promise.all(tsPending.map((a) =>
      apiFetch(`/approvals/timesheets/${a.timesheetId}/approve`, { method: "POST", body: JSON.stringify({ comment: "" }) })
    ));
    setBulkApproving(false);
    loadData();
  }

  function toggleReject(id: string, kind: "ts" | "leave") {
    if (rejectFor?.id === id && rejectFor.kind === kind) {
      setRejectFor(null);
    } else {
      setRejectFor({ id, kind });
      setRejectComment("");
    }
  }

  const pendingCount = tsPending.length + leavePending.length;
  const showTs    = tab !== "leave";
  const showLeave = tab !== "timesheets";

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "all",        label: "All",        count: pendingCount },
    { key: "timesheets", label: "Timesheets",  count: tsPending.length },
    { key: "leave",      label: "Leave",       count: leavePending.length },
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <style>{PAGE_STYLES}</style>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Approvals</div>
          <div className="page-subtitle">Review and action pending requests</div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-outline"
            onClick={() => void bulkApprove()}
            disabled={bulkApproving || tsPending.length === 0}
          >
            {bulkApproving ? "Approving…" : "Bulk approve"}
          </button>
        </div>
      </div>

      {/* KPI stats */}
      <div className="apr3-stats">
        <div className="apr3-stat">
          <div className="apr3-stat-icon" style={{ background: "#fff7ed" }}>⏳</div>
          <div>
            <div className="apr3-stat-num" style={{ color: "#ea580c" }}>{pendingCount}</div>
            <div className="apr3-stat-label">Pending action</div>
          </div>
        </div>
        <div className="apr3-stat">
          <div className="apr3-stat-icon" style={{ background: "#f0fdf4" }}>✓</div>
          <div>
            <div className="apr3-stat-num" style={{ color: "#16a34a" }}>{stats.approvedThisMonth ?? "—"}</div>
            <div className="apr3-stat-label">Approved this month</div>
          </div>
        </div>
        <div className="apr3-stat">
          <div className="apr3-stat-icon" style={{ background: "#fef2f2" }}>✗</div>
          <div>
            <div className="apr3-stat-num" style={{ color: "#dc2626" }}>{stats.rejectedThisMonth ?? "—"}</div>
            <div className="apr3-stat-label">Rejected this month</div>
          </div>
        </div>
        <div className="apr3-stat">
          <div className="apr3-stat-icon" style={{ background: "#f8fafc" }}>⌀</div>
          <div>
            <div className="apr3-stat-num">{stats.avgResponseHours != null ? `${stats.avgResponseHours}h` : "—"}</div>
            <div className="apr3-stat-label">Avg. response time</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="apr3-tabs">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            className={`apr3-tab${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
            <span className="apr3-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Card list */}
      <div className="apr3-list">
        {pendingCount === 0 && (
          <div className="apr3-empty">
            <div className="apr3-empty-icon">✓</div>
            <div style={{ fontWeight: 600 }}>All clear</div>
            <div style={{ fontSize: "0.85rem" }}>No pending approvals at this time.</div>
          </div>
        )}

        {/* Timesheet approval cards */}
        {showTs && tsPending.map((a) => (
          <div key={a.timesheetId} className="apr3-card" style={{ borderLeft: "3px solid var(--brand-500)" }}>
            <div className="apr3-card-inner">
              <div className="apr3-avatar" style={{ background: avatarColor(a.username) }}>
                {initials(a.username)}
              </div>
              <div className="apr3-meta">
                <div className="apr3-meta-title">{a.username} — Timesheet {a.workDate}</div>
                <div className="apr3-meta-sub">
                  {a.workDate} — <strong>{fmtHours(a.enteredMinutes)} logged</strong>
                  {a.mismatchReason && <> — <span style={{ color: "#d97706" }}>⚠ {a.mismatchReason}</span></>}
                </div>
              </div>
              <div className="apr3-right">
                <div className="apr3-type-metric">
                  <div className="apr3-type-label">Timesheet</div>
                  <div className="apr3-type-value">{fmtHours(a.enteredMinutes)}</div>
                </div>
                <div className="apr3-actions">
                  <button className="btn btn-outline-success btn-sm" onClick={() => void approveTs(a.timesheetId)}>
                    ✓ Approve
                  </button>
                  <button
                    className="btn btn-outline-reject btn-sm"
                    onClick={() => toggleReject(a.timesheetId, "ts")}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
            {rejectFor?.id === a.timesheetId && rejectFor.kind === "ts" && (
              <div className="apr3-reject-row">
                <input
                  className="input-field"
                  style={{ flex: 1, maxWidth: 420 }}
                  placeholder="Rejection comment (required)"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-danger btn-sm" onClick={() => void confirmRejectTs(a.timesheetId)}>
                  Confirm Reject
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setRejectFor(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}

        {/* Leave approval cards */}
        {showLeave && leavePending.map((l) => (
          <div key={l.id} className="apr3-card" style={{ borderLeft: "3px solid #f59e0b" }}>
            <div className="apr3-card-inner">
              <div className="apr3-avatar" style={{ background: avatarColor(l.username) }}>
                {initials(l.username)}
              </div>
              <div className="apr3-meta">
                <div className="apr3-meta-title">{l.username} — {l.leaveTypeName} Request</div>
                <div className="apr3-meta-sub">
                  {l.leaveDate} — <strong>{l.isHalfDay ? "Half day" : "1 day"}</strong>
                  {l.comment && <> — {l.comment}</>}
                </div>
              </div>
              <div className="apr3-right">
                <div className="apr3-type-metric">
                  <div className="apr3-type-label">Leave</div>
                  <div className="apr3-type-value">{l.isHalfDay ? "0.5d" : "1d"}</div>
                </div>
                <div className="apr3-actions">
                  <button className="btn btn-outline-success btn-sm" onClick={() => void approveLeave(l.id)}>
                    ✓ Approve
                  </button>
                  <button
                    className="btn btn-outline-reject btn-sm"
                    onClick={() => toggleReject(l.id, "leave")}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
            {rejectFor?.id === l.id && rejectFor.kind === "leave" && (
              <div className="apr3-reject-row">
                <input
                  className="input-field"
                  style={{ flex: 1, maxWidth: 420 }}
                  placeholder="Rejection comment (required)"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-danger btn-sm" onClick={() => void confirmRejectLeave(l.id)}>
                  Confirm Reject
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setRejectFor(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
