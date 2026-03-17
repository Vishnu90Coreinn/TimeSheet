/**
 * TeamStatus.tsx — Manager Team Status Board (Sprint 15)
 * Manager + Admin only. Shows each direct report's daily attendance,
 * week progress, timesheet status, and pending approvals.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { TeamMemberStatus } from "../types";

type Filter = "all" | "missing" | "needs-approval" | "on-leave";

const FILTER_LABELS: Record<Filter, string> = {
  all:              "All",
  missing:          "Missing Today",
  "needs-approval": "Needs Approval",
  "on-leave":       "On Leave",
};

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

// ── Attendance badge ──────────────────────────────────────────────────────────

const ATTENDANCE_CONFIG = {
  checkedIn:  { label: "Checked In",  bg: "#dcfce7", color: "#15803d" },
  checkedOut: { label: "Checked Out", bg: "#f0fdf4", color: "#4ade80" },
  onLeave:    { label: "On Leave",    bg: "#fef9c3", color: "#a16207" },
  absent:     { label: "Absent",      bg: "#f9fafb", color: "#9ca3af" },
};

const TIMESHEET_CONFIG = {
  approved:  { label: "Approved",  bg: "#dcfce7", color: "#15803d" },
  submitted: { label: "Submitted", bg: "#dbeafe", color: "#1d4ed8" },
  draft:     { label: "Draft",     bg: "#f3f4f6", color: "#6b7280" },
  rejected:  { label: "Rejected",  bg: "#fee2e2", color: "#b91c1c" },
  missing:   { label: "Missing",   bg: "#fef3c7", color: "#d97706" },
};

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{
      background: bg, color, borderRadius: 6,
      padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ member }: { member: TeamMemberStatus }) {
  const initials = (member.displayName || member.username).slice(0, 2).toUpperCase();
  if (member.avatarDataUrl) {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: "var(--r-md)",
        backgroundImage: `url(${member.avatarDataUrl})`,
        backgroundSize: "cover", backgroundPosition: "center",
        border: "1px solid var(--border-subtle)", flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "var(--r-md)", flexShrink: 0,
      background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.75rem", fontWeight: 700, color: "#fff",
    }}>
      {initials}
    </div>
  );
}

// ── Week progress bar ─────────────────────────────────────────────────────────

function WeekBar({ logged, expected }: { logged: number; expected: number }) {
  const pct = expected > 0 ? Math.min(100, Math.round((logged / expected) * 100)) : 0;
  const color = pct >= 100 ? "#10b981" : pct > 0 ? "#6366f1" : "#e5e7eb";
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>
        <span>{fmtHours(logged)}</span>
        <span>{fmtHours(expected)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "var(--n-100)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width 0.3s" }} />
      </div>
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

  const filtered = members.filter(m => {
    if (filter === "missing")          return m.todayTimesheetStatus === "missing";
    if (filter === "needs-approval")   return m.pendingApprovalCount > 0;
    if (filter === "on-leave")         return m.attendance === "onLeave";
    return true;
  });

  // Summary counts for filter chips
  const counts: Record<Filter, number> = {
    all:              members.length,
    missing:          members.filter(m => m.todayTimesheetStatus === "missing").length,
    "needs-approval": members.filter(m => m.pendingApprovalCount > 0).length,
    "on-leave":       members.filter(m => m.attendance === "onLeave").length,
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#111827", color: "#fff", borderRadius: 8,
          padding: "10px 18px", fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>
          {toast}
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

        {/* Page header */}
        <div className="page-header">
          <div>
            <div className="page-title">Team Status</div>
            <div className="page-subtitle">Daily overview of your direct reports</div>
          </div>
          <div className="page-actions">
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: "auto" }}
            />
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
            >
              {FILTER_LABELS[f]}
              {counts[f] > 0 && (
                <span style={{
                  marginLeft: 6, background: filter === f ? "rgba(255,255,255,0.25)" : "var(--n-200)",
                  color: filter === f ? "#fff" : "var(--text-secondary)",
                  borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
                }}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: "visible" }}>
          {loading ? (
            <div style={{ padding: "var(--space-8)", color: "var(--text-tertiary)", textAlign: "center" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "var(--space-8)", color: "var(--text-tertiary)", textAlign: "center" }}>
              {members.length === 0 ? "No direct reports assigned to you." : "No team members match this filter."}
            </div>
          ) : (
            <table className="data-table" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Member</th>
                  <th style={{ width: "14%" }}>Attendance</th>
                  <th style={{ width: "10%" }}>Check In</th>
                  <th style={{ width: "18%" }}>Week Progress</th>
                  <th style={{ width: "13%" }}>Timesheet</th>
                  <th style={{ width: "10%" }}>Pending</th>
                  <th style={{ width: "13%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const attCfg = ATTENDANCE_CONFIG[m.attendance];
                  const tsCfg  = TIMESHEET_CONFIG[m.todayTimesheetStatus];
                  const isReminding = reminding.has(m.userId);
                  return (
                    <tr key={m.userId}>
                      {/* Member */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <Avatar member={m} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.displayName || m.username}
                            </div>
                            {m.displayName && (
                              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                @{m.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Attendance */}
                      <td><Badge bg={attCfg.bg} color={attCfg.color} label={attCfg.label} /></td>

                      {/* Check in/out */}
                      <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {m.checkInAtUtc ? (
                          <div>
                            <div>{fmtLocalTime(m.checkInAtUtc)}</div>
                            {m.checkOutAtUtc && <div style={{ color: "var(--text-tertiary)" }}>{fmtLocalTime(m.checkOutAtUtc)}</div>}
                          </div>
                        ) : "—"}
                      </td>

                      {/* Week progress */}
                      <td><WeekBar logged={m.weekLoggedMinutes} expected={m.weekExpectedMinutes} /></td>

                      {/* Timesheet */}
                      <td><Badge bg={tsCfg.bg} color={tsCfg.color} label={tsCfg.label} /></td>

                      {/* Pending */}
                      <td style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: m.pendingApprovalCount > 0 ? 600 : 400 }}>
                        {m.pendingApprovalCount > 0 ? (
                          <span style={{ color: "var(--brand-600)" }}>{m.pendingApprovalCount} pending</span>
                        ) : "—"}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          {m.todayTimesheetStatus === "missing" && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={isReminding}
                              onClick={() => void remind(m.userId, m.username)}
                              title="Send reminder notification"
                            >
                              {isReminding ? "…" : "Remind"}
                            </button>
                          )}
                          {m.pendingApprovalCount > 0 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate("/approvals")}
                              title="Go to Approvals"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
