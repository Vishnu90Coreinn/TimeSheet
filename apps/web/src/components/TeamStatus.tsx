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

// ── Custom Date Picker (H1) ───────────────────────────────────────────────────

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
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
        onClick={() => setOpen(v => !v)}
        aria-label={`Selected date: ${fmtDateDisplay(value)}. Click to change`}
      >
        <CalendarIcon />
        {fmtDateDisplay(value)}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
          background: "var(--surface)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
          padding: "var(--space-3)", display: "flex", flexDirection: "column",
          gap: "var(--space-2)", minWidth: 220,
        }}>
          <input
            type="date"
            className="input-field"
            value={value}
            style={{ width: "100%" }}
            onChange={e => { onChange(e.target.value); setOpen(false); }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: "100%" }}
            onClick={() => { onChange(todayIso()); setOpen(false); }}
          >
            Today
          </button>
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

// ── Week progress bar (H3) ─────────────────────────────────────────────────────

function WeekBar({ logged, expected }: { logged: number; expected: number }) {
  const pct = expected > 0 ? Math.min(100, Math.round((logged / expected) * 100)) : 0;
  // H3: green ≥80%, yellow 40–79%, red <40%
  const color = pct >= 80 ? "#10b981" : pct >= 40 ? "#f59e0b" : pct > 0 ? "#ef4444" : "#e5e7eb";
  const loggedH = (logged / 60).toFixed(1);
  const expectedH = (expected / 60).toFixed(1);
  const tooltip = `${loggedH}h logged of ${expectedH}h weekly target`;

  return (
    <div style={{ minWidth: 110 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3,
      }}>
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
        style={{ height: 5, borderRadius: 3, background: "var(--n-100)", overflow: "hidden" }}
      >
        <div style={{
          height: "100%", borderRadius: 3, background: color,
          width: `${pct}%`, transition: "width 0.3s",
        }} />
      </div>
      {/* H3: percentage label */}
      <div style={{
        textAlign: "right", fontSize: 10,
        color: pct === 0 ? "var(--text-tertiary)" : color,
        fontWeight: 600, marginTop: 2,
      }}>
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
      style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

// ── Arrow right icon (H4) ─────────────────────────────────────────────────────

function ArrowRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ display: "inline", verticalAlign: "middle", marginLeft: 3 }}>
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
      style={{ display: "inline", verticalAlign: "middle" }}>
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

  const filtered = members.filter(m => {
    if (filter === "missing")          return m.todayTimesheetStatus === "missing";
    if (filter === "needs-approval")   return m.pendingApprovalCount > 0;
    if (filter === "on-leave")         return m.attendance === "onLeave";
    return true;
  });

  // M1 — Dynamic subtitle
  const subtitle = buildSubtitle(members.length, counts.missing, counts["needs-approval"]);

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

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

        {/* Page header */}
        <div className="page-header">
          <div>
            <div className="page-title">Team Status</div>
            {/* M1 — dynamic subtitle */}
            <div className="page-subtitle">{subtitle}</div>
          </div>
          {/* H1 — Custom date picker instead of native input */}
          <div className="page-actions">
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        {/* C3 — Filter bar with standardized badges */}
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {(Object.keys(FILTER_LABELS) as Filter[]).map(f => {
            const isActive = filter === f;
            // C3 — "on-leave" badge always shown; others only when > 0
            const showBadge = f === "on-leave" || counts[f] > 0;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
              >
                {FILTER_LABELS[f]}
                {showBadge && (
                  <span style={{
                    marginLeft: 6,
                    background: isActive ? "rgba(255,255,255,0.25)" : "var(--n-200)",
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    borderRadius: 10, padding: "1px 7px",
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {counts[f]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* M2 — Visual separator between filter bar and table */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: -4 }} />

        {/* Table */}
        <div className="card" style={{ overflow: "auto" }}>
          {loading ? (
            <div style={{ padding: "var(--space-8)", color: "var(--text-tertiary)", textAlign: "center" }}>
              Loading…
            </div>
          ) : filtered.length === 0 && members.length === 0 ? (
            /* H5 — Full empty state for 0 members */
            <div style={{
              padding: "var(--space-10) var(--space-6)",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: "var(--space-3)", textAlign: "center",
            }}>
              <EmptyTeamIcon />
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                No direct reports assigned
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", maxWidth: 320 }}>
                You don't have any team members yet. Ask your admin to assign employees to you.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "var(--space-8)", color: "var(--text-tertiary)", textAlign: "center" }}>
              No team members match this filter.
            </div>
          ) : (
            /* C2 — table-layout: fixed with balanced widths to prevent clip */
            <table
              className="data-table"
              style={{ tableLayout: "fixed", minWidth: 700 }}
              role="grid"
            >
              <thead>
                <tr>
                  {/* C1 — clear column headers */}
                  <th style={{ width: "22%" }}>Member</th>
                  <th style={{ width: "13%" }}>Attendance</th>
                  {/* H2 — renamed + clock icon */}
                  <th style={{ width: "11%" }}>
                    <ClockIcon />Check-in Time
                  </th>
                  <th style={{ width: "18%" }}>Week Progress</th>
                  <th style={{ width: "12%" }}>Timesheet</th>
                  {/* C1 — merged "Pending Actions" header */}
                  <th style={{ width: "24%" }}>Pending Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const isReminding = reminding.has(m.userId);
                  const tsStatus = toBadgeStatus(m.todayTimesheetStatus);
                  const attStatus = toBadgeStatus(
                    m.attendance === "onLeave" ? "on-leave" : m.attendance
                  );
                  return (
                    <tr key={m.userId}>
                      {/* Member — C1 title tooltip for truncated names */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <Avatar member={m} />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600, fontSize: "0.875rem",
                                color: "var(--text-primary)",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}
                              title={m.displayName || m.username}
                            >
                              {m.displayName || m.username}
                            </div>
                            {m.displayName && (
                              <div
                                style={{
                                  fontSize: "0.75rem", color: "var(--text-tertiary)",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}
                                title={`@${m.username}`}
                              >
                                @{m.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Attendance — M4 StatusBadge */}
                      <td><StatusBadge status={attStatus} /></td>

                      {/* Check-in / Check-out — H2 aria-label on empty */}
                      <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {m.checkInAtUtc ? (
                          <div>
                            <div>{fmtLocalTime(m.checkInAtUtc)}</div>
                            {m.checkOutAtUtc && (
                              <div style={{ color: "var(--text-tertiary)" }}>
                                {fmtLocalTime(m.checkOutAtUtc)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span aria-label="No check-in recorded">—</span>
                        )}
                      </td>

                      {/* Week progress — H3 with %, tooltip, new colors */}
                      <td>
                        <WeekBar logged={m.weekLoggedMinutes} expected={m.weekExpectedMinutes} />
                      </td>

                      {/* Timesheet — M4 StatusBadge */}
                      <td><StatusBadge status={tsStatus} /></td>

                      {/* Pending + Actions — C1 merged column, C2 no overflow */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                          {/* H4 — pending count as navigable link */}
                          {m.pendingApprovalCount > 0 && (
                            <button
                              type="button"
                              onClick={() => navigate("/approvals")}
                              style={{
                                background: "none", border: "none", padding: 0,
                                color: "var(--brand-600)", fontWeight: 600,
                                fontSize: "0.8rem", cursor: "pointer",
                                textDecoration: "none", display: "inline-flex",
                                alignItems: "center",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                              title={`View ${m.pendingApprovalCount} pending approval${m.pendingApprovalCount !== 1 ? "s" : ""}`}
                            >
                              {m.pendingApprovalCount} pending<ArrowRight />
                            </button>
                          )}

                          {/* M3 — Remind: secondary outlined button */}
                          {m.todayTimesheetStatus === "missing" && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                border: "1px solid var(--border-subtle)",
                                background: "var(--surface)",
                                color: "var(--text-secondary)",
                                fontSize: "0.72rem",
                              }}
                              disabled={isReminding}
                              onClick={() => void remind(m.userId, m.username)}
                              title="Send reminder notification"
                            >
                              {isReminding ? "…" : "Remind"}
                            </button>
                          )}

                          {/* M3 — Approve: primary purple button with checkmark */}
                          {m.pendingApprovalCount > 0 && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                              onClick={() => navigate("/approvals")}
                              title="Go to Approvals"
                            >
                              <CheckIcon /> Approve
                            </button>
                          )}

                          {/* No actions */}
                          {m.pendingApprovalCount === 0 && m.todayTimesheetStatus !== "missing" && (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* H5 — Contextual message for very small teams (1 member) */}
          {!loading && members.length === 1 && (
            <div style={{
              padding: "var(--space-3) var(--space-5)",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: "0.78rem", color: "var(--text-tertiary)",
              textAlign: "center",
            }}>
              You're viewing all 1 direct report. Add more team members to see richer data here.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
