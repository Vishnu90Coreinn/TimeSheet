import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { AttendanceWidget } from "./AttendanceWidget";

interface DashboardProps { role: string; username: string; }

// ── Interfaces ────────────────────────────────────────────────────────────────
interface EmployeeSession { workDate: string; checkedIn: string | null; checkedOut: string | null; breakMinutes: number; attendanceMinutes: number; }
interface EmployeeTimesheet { status: string; mismatchReason: string | null; enteredMinutes: number; pendingActions: number; }
interface EmployeeWeekly { entered: number; breaks: number; }
interface ProjectEffortRow { project: string; minutes: number; }
interface ComplianceRow { workDate: string; isCompliant: boolean; }
interface EmployeeData { todaySession: EmployeeSession; todayTimesheet: EmployeeTimesheet; weeklyHours: EmployeeWeekly; projectEffort: ProjectEffortRow[]; monthlyComplianceTrend: ComplianceRow[]; }

interface TeamAttendance { present: number; onLeave: number; notCheckedIn: number; }
interface TimesheetHealth { missing: number; pendingApprovals: number; }
interface MismatchRow { username: string; workDate: string; mismatchReason: string; }
interface Utilization { avgMinutes: number; }
interface ContributionRow { project: string; minutes: number; }
interface ManagerData { teamAttendance: TeamAttendance; timesheetHealth: TimesheetHealth; mismatches: MismatchRow[]; utilization: Utilization; contributions: ContributionRow[]; }

interface DeptRow { department: string; minutes: number; }
interface ProjectRow { project: string; minutes: number; }
interface Billable { billableMinutes: number; nonBillableMinutes: number; }
interface ConsultantInternal { consultant: number; internal: number; }
interface UserLoad { username: string; status: "underutilized" | "balanced" | "overloaded"; minutes: number; }
interface AdminData { effortByDepartment: DeptRow[]; effortByProject: ProjectRow[]; billable: Billable; consultantVsInternal: ConsultantInternal; underOver: UserLoad[]; compliance: unknown[]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60), min = m % 60;
  if (h === 0) return `${min}m`;
  return min === 0 ? `${h}h` : `${h}h ${min}m`;
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function greeting(name: string): string {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${name} 👋`;
}
function todayStr(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}
function statusBadge(s: string) {
  const m: Record<string,string> = { draft:"badge badge-warning", submitted:"badge badge-info", approved:"badge badge-success", rejected:"badge badge-error" };
  return <span className={m[s?.toLowerCase()] ?? "badge badge-neutral"}>{s}</span>;
}
function loadBadge(s: string) {
  const m: Record<string,string> = { underutilized:"badge badge-warning", balanced:"badge badge-success", overloaded:"badge badge-error" };
  return <span className={m[s] ?? "badge badge-neutral"}>{s}</span>;
}

// Donut chart helper — circumference of r=40 circle ≈ 251.2
const CIRC = 251.2;
function DonutChart({ segments }: { segments: { pct: number; color: string }[] }) {
  let offset = 0;
  const arcs = segments.map((s) => {
    const len = (s.pct / 100) * CIRC;
    const arc = { ...s, len, offset };
    offset += len;
    return arc;
  });
  const total = segments.reduce((a, s) => a + s.pct, 0);
  return (
    <div className="donut-container">
      <svg className="donut-svg" viewBox="0 0 100 100">
        <circle className="donut-track" cx="50" cy="50" r="40" />
        {arcs.map((a, i) => (
          <circle key={i} className="donut-arc" cx="50" cy="50" r="40"
            stroke={a.color}
            strokeDasharray={`${a.len} ${CIRC - a.len}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>
      <div className="donut-label">
        <div className="donut-val">{Math.round(total)}%</div>
        <div className="donut-sub">used</div>
      </div>
    </div>
  );
}

// KPI list item
function KpiItem({ name, color, value, max }: { name: string; color: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="kpi-item">
      <div className="kpi-header">
        <div className="kpi-name">
          <div className="kpi-dot" style={{ background: color }} />
          {name}
        </div>
        <div className="kpi-val">{fmtMinutes(value)}</div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Palette for projects
const PALETTE = ["var(--brand-500)", "var(--info)", "var(--warning)", "var(--success)", "var(--n-300)"];

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 260, height: 24, marginBottom: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: 200 }} />
        </div>
      </div>
      <div className="stat-grid-4 mb-5">
        {[1,2,3,4].map(i => (
          <div key={i} className="stat-card">
            <div className="stat-card-top">
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "var(--r-md)" }} />
              <div className="skeleton skeleton-text" style={{ width: 56 }} />
            </div>
            <div className="skeleton skeleton-title" style={{ width: 80, height: 28, margin: "16px 0 6px" }} />
            <div className="skeleton skeleton-text" style={{ width: 110 }} />
          </div>
        ))}
      </div>
      <div className="dashboard-grid-2">
        {[1,2].map(i => (
          <div key={i} className="card" style={{ padding: "var(--space-5)", minHeight: 200 }}>
            <div className="skeleton skeleton-title" style={{ width: 140, height: 16, marginBottom: 20 }} />
            <div className="skeleton" style={{ width: "100%", height: 120, borderRadius: "var(--r-md)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Employee View ─────────────────────────────────────────────────────────────
function EmployeeDashboard({ data, username }: { data: EmployeeData; username: string }) {
  const { todaySession, todayTimesheet, weeklyHours, projectEffort, monthlyComplianceTrend } = data;
  const compliantDays = monthlyComplianceTrend.filter(r => r.isCompliant).length;
  const compliancePct = monthlyComplianceTrend.length > 0 ? Math.round((compliantDays / monthlyComplianceTrend.length) * 100) : 0;
  const maxEffort = Math.max(...projectEffort.map(r => r.minutes), 1);

  // Donut segments for project split
  const totalEffort = projectEffort.reduce((a, r) => a + r.minutes, 0);
  const donutSegs = projectEffort.slice(0, 4).map((r, i) => ({
    pct: totalEffort > 0 ? (r.minutes / totalEffort) * 100 : 0,
    color: PALETTE[i] ?? "var(--n-300)",
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">{greeting(username)}</div>
          <div className="page-subtitle">Here's what's happening with your work today — {todayStr()}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm">📥 Export</button>
        </div>
      </div>

      {/* Stat grid */}
      <div className="stat-grid-4 mb-5">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--brand-50)" }}>⏱</div>
            <span className={`stat-trend ${todaySession.checkedIn ? "trend-up" : "trend-flat"}`}>
              {todaySession.checkedIn ? "● Checked in" : "○ Not started"}
            </span>
          </div>
          <div className="stat-value">{fmtMinutes(todaySession.attendanceMinutes)}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}></span></div>
          <div className="stat-label">Attendance today</div>
          <div className="stat-footer">{todaySession.checkedIn ? `In at ${fmtTime(todaySession.checkedIn)}` : "Clock in to start tracking"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)" }}>✓</div>
            <span className="stat-trend trend-flat">This week</span>
          </div>
          <div className="stat-value">{fmtMinutes(weeklyHours.entered)}</div>
          <div className="stat-label">Hours logged</div>
          <div className="stat-footer">{weeklyHours.breaks > 0 ? `${fmtMinutes(weeklyHours.breaks)} break time` : "No breaks recorded"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: todayTimesheet.pendingActions > 0 ? "var(--warning-light)" : "var(--info-light)" }}>◈</div>
            {statusBadge(todayTimesheet.status)}
          </div>
          <div className="stat-value">{todayTimesheet.pendingActions}</div>
          <div className="stat-label">Pending actions</div>
          <div className="stat-footer">Today's timesheet: {todayTimesheet.status}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--warning-light)" }}>🛡</div>
            <span className={`stat-trend ${compliancePct >= 80 ? "trend-up" : "trend-down"}`}>
              {compliantDays}/{monthlyComplianceTrend.length} days
            </span>
          </div>
          <div className="stat-value">{compliancePct}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>%</span></div>
          <div className="stat-label">Monthly compliance</div>
          <div className="stat-footer">Last {monthlyComplianceTrend.length} working days</div>
        </div>
      </div>

      {/* Row 2: Project hours bar chart + Project split donut */}
      <div className="dashboard-grid-2">
        {/* Bar chart — project effort */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Project Hours This Week</div>
              <div className="card-subtitle">Hours logged per project vs. others</div>
            </div>
          </div>
          <div className="card-body">
            {projectEffort.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}>
                <p className="empty-state__title">No entries yet</p>
                <p className="empty-state__sub">Log time on the Timesheets page to see effort here.</p>
              </div>
            ) : (
              <>
                <div className="bar-chart">
                  {projectEffort.slice(0, 7).map((r, i) => {
                    const pct = Math.round((r.minutes / maxEffort) * 100);
                    return (
                      <div key={r.project} className="bar-col">
                        <div className="bar-tracks">
                          <div className="bar-seg" style={{ height: "100%", background: "var(--n-100)" }} title="Max" />
                          <div className="bar-seg" style={{ height: `${pct}%`, background: PALETTE[i % PALETTE.length] }} title={`${r.project}: ${fmtMinutes(r.minutes)}`} />
                        </div>
                        <div className="bar-day">{r.project.slice(0, 4)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="chart-legend">
                  {projectEffort.slice(0, 4).map((r, i) => (
                    <div key={r.project} className="chart-legend-item">
                      <div className="chart-legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                      {r.project.length > 12 ? r.project.slice(0, 12) + "…" : r.project}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Project split donut */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Project Split</div>
              <div className="card-subtitle">This week</div>
            </div>
          </div>
          <div className="card-body">
            {projectEffort.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}>
                <p className="empty-state__title">No data</p>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
                <DonutChart segments={donutSegs} />
                <div className="kpi-list" style={{ flex: 1 }}>
                  {projectEffort.slice(0, 4).map((r, i) => (
                    <KpiItem key={r.project} name={r.project} color={PALETTE[i % PALETTE.length]} value={r.minutes} max={maxEffort} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Activity + Attendance Widget + Compliance */}
      <div className="dashboard-grid">
        {/* Activity feed */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Today's Status</div>
              <div className="card-subtitle">Your timesheet activity</div>
            </div>
          </div>
          <div className="card-body">
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon-wrap" style={{ background: todaySession.checkedIn ? "var(--success-light)" : "var(--n-100)" }}>
                  {todaySession.checkedIn ? "✓" : "○"}
                </div>
                <div className="activity-body">
                  <div className="activity-text">
                    {todaySession.checkedIn ? <><strong>Checked in</strong> successfully</> : "Not checked in yet"}
                  </div>
                  <div className="activity-meta">{todaySession.checkedIn ? `At ${fmtTime(todaySession.checkedIn)}` : "Use the widget to check in"}</div>
                </div>
                <div className="activity-ts">Today</div>
              </div>
              <div className="activity-item">
                <div className="activity-icon-wrap" style={{ background: "var(--brand-50)" }}>◈</div>
                <div className="activity-body">
                  <div className="activity-text">Timesheet status: <strong>{todayTimesheet.status}</strong></div>
                  <div className="activity-meta">{todayTimesheet.enteredMinutes > 0 ? `${fmtMinutes(todayTimesheet.enteredMinutes)} entered` : "No entries yet"}</div>
                </div>
                <div className="activity-ts">Today</div>
              </div>
              {projectEffort.slice(0, 2).map((r) => (
                <div key={r.project} className="activity-item">
                  <div className="activity-icon-wrap" style={{ background: "var(--info-light)" }}>⏱</div>
                  <div className="activity-body">
                    <div className="activity-text">Time logged on <strong>{r.project}</strong></div>
                    <div className="activity-meta">{fmtMinutes(r.minutes)} this week</div>
                  </div>
                  <div className="activity-ts">This week</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attendance Widget */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <AttendanceWidget />
        </div>

        {/* Monthly compliance calendar */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Compliance Calendar</div>
              <div className="card-subtitle">{compliantDays}/{monthlyComplianceTrend.length} days compliant</div>
            </div>
            <span className={`badge ${compliancePct >= 80 ? "badge-success" : "badge-error"}`}>{compliancePct}%</span>
          </div>
          <div className="card-body">
            {monthlyComplianceTrend.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}>
                <p className="empty-state__title">No data</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {monthlyComplianceTrend.map(r => (
                  <div key={r.workDate} title={r.workDate} style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: r.isCompliant ? "var(--success-light)" : "var(--danger-light)",
                    border: `1px solid ${r.isCompliant ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                    color: r.isCompliant ? "var(--success-dark)" : "var(--danger-dark)",
                  }}>
                    {r.isCompliant ? "✓" : "✗"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Manager View ──────────────────────────────────────────────────────────────
function ManagerDashboard({ data, username }: { data: ManagerData; username: string }) {
  const { teamAttendance, timesheetHealth, mismatches, utilization, contributions } = data;
  const maxContrib = Math.max(...contributions.map(r => r.minutes), 1);
  const totalContrib = contributions.reduce((a, r) => a + r.minutes, 0);
  const donutSegs = contributions.slice(0, 4).map((r, i) => ({
    pct: totalContrib > 0 ? (r.minutes / totalContrib) * 100 : 0,
    color: PALETTE[i] ?? "var(--n-300)",
  }));
  const totalTeam = teamAttendance.present + teamAttendance.onLeave + teamAttendance.notCheckedIn;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="page-header">
        <div>
          <div className="page-title">{greeting(username)}</div>
          <div className="page-subtitle">Here's what's happening with your team today — {todayStr()}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm">📥 Export</button>
        </div>
      </div>

      <div className="stat-grid-4 mb-5">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)" }}>👥</div>
            <span className="stat-trend trend-up">Today</span>
          </div>
          <div className="stat-value">{teamAttendance.present}</div>
          <div className="stat-label">Present today</div>
          <div className="stat-footer">Of {totalTeam} total team</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}>🌿</div>
            <span className="stat-trend trend-flat">On leave</span>
          </div>
          <div className="stat-value">{teamAttendance.onLeave}</div>
          <div className="stat-label">On leave today</div>
          <div className="stat-footer">Approved absences</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: teamAttendance.notCheckedIn > 0 ? "var(--warning-light)" : "var(--success-light)" }}>⏱</div>
            <span className={`stat-trend ${teamAttendance.notCheckedIn > 0 ? "trend-down" : "trend-up"}`}>
              {teamAttendance.notCheckedIn > 0 ? "Attention" : "All in"}
            </span>
          </div>
          <div className="stat-value">{teamAttendance.notCheckedIn}</div>
          <div className="stat-label">Not checked in</div>
          <div className="stat-footer">Expected but missing</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: timesheetHealth.pendingApprovals > 0 ? "var(--brand-50)" : "var(--success-light)" }}>✦</div>
            <span className={`stat-trend ${timesheetHealth.pendingApprovals > 0 ? "trend-down" : "trend-up"}`}>
              {timesheetHealth.missing > 0 ? `${timesheetHealth.missing} missing` : "No missing"}
            </span>
          </div>
          <div className="stat-value">{timesheetHealth.pendingApprovals}</div>
          <div className="stat-label">Pending approvals</div>
          <div className="stat-footer">Avg {fmtMinutes(Math.round(utilization.avgMinutes))} / person</div>
        </div>
      </div>

      {/* Row 2: Mismatches bar + contributions donut */}
      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Team Attendance</div>
              <div className="card-subtitle">Today's status breakdown</div>
            </div>
          </div>
          <div className="card-body">
            <div className="bar-chart" style={{ height: 80 }}>
              {[
                { label: "Present", value: teamAttendance.present, color: "var(--success)" },
                { label: "Leave", value: teamAttendance.onLeave, color: "var(--info)" },
                { label: "Absent", value: teamAttendance.notCheckedIn, color: "var(--warning)" },
              ].map((b) => {
                const pct = totalTeam > 0 ? Math.round((b.value / totalTeam) * 100) : 0;
                return (
                  <div key={b.label} className="bar-col">
                    <div className="bar-tracks" style={{ height: 60 }}>
                      <div className="bar-seg" style={{ height: "100%", background: "var(--n-100)" }} />
                      <div className="bar-seg" style={{ height: `${pct}%`, background: b.color }} title={`${b.label}: ${b.value}`} />
                    </div>
                    <div className="bar-day">{b.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="chart-legend" style={{ marginTop: "var(--space-3)" }}>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--success)" }} />Present ({teamAttendance.present})</div>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--info)" }} />On Leave ({teamAttendance.onLeave})</div>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--warning)" }} />Absent ({teamAttendance.notCheckedIn})</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Project Contributions</div>
              <div className="card-subtitle">This week</div>
            </div>
          </div>
          <div className="card-body">
            {contributions.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
                <DonutChart segments={donutSegs} />
                <div className="kpi-list" style={{ flex: 1 }}>
                  {contributions.slice(0, 4).map((r, i) => (
                    <KpiItem key={r.project} name={r.project} color={PALETTE[i % PALETTE.length]} value={r.minutes} max={maxContrib} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Mismatches activity + quick-approvals style + KPI */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Recent Mismatches</div><div className="card-subtitle">Attendance vs. timesheet discrepancies</div></div>
            {mismatches.length > 0 && <span className="badge badge-error">{mismatches.length}</span>}
          </div>
          <div className="card-body">
            {mismatches.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}>
                <p className="empty-state__title">No mismatches</p>
                <p className="empty-state__sub">All timesheets match attendance records.</p>
              </div>
            ) : (
              <div className="activity-list">
                {mismatches.slice(0, 5).map((r, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-icon-wrap" style={{ background: "var(--danger-light)" }}>!</div>
                    <div className="activity-body">
                      <div className="activity-text"><strong>{r.username}</strong> — mismatch</div>
                      <div className="activity-meta">{r.mismatchReason}</div>
                    </div>
                    <div className="activity-ts">{r.workDate}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Pending Approvals</div><div className="card-subtitle">Requires your action</div></div>
            {timesheetHealth.pendingApprovals > 0 && <span className="badge badge-danger">{timesheetHealth.pendingApprovals}</span>}
          </div>
          <div className="card-body">
            {timesheetHealth.pendingApprovals === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}>
                <p className="empty-state__title">All clear</p>
                <p className="empty-state__sub">No approvals pending.</p>
              </div>
            ) : (
              <div>
                <div className="quick-approve-list">
                  <div className="qa-item">
                    <div className="av av-lg" style={{ background: "linear-gradient(135deg,var(--brand-400),var(--brand-700))", borderRadius: "var(--r-md)", marginLeft: 0 }}>T</div>
                    <div className="qa-info">
                      <div className="qa-name">Timesheets pending</div>
                      <div className="qa-detail">{timesheetHealth.pendingApprovals} submissions · review required</div>
                    </div>
                  </div>
                  {timesheetHealth.missing > 0 && (
                    <div className="qa-item">
                      <div className="av av-lg" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: "var(--r-md)", marginLeft: 0 }}>!</div>
                      <div className="qa-info">
                        <div className="qa-name">Missing timesheets</div>
                        <div className="qa-detail">{timesheetHealth.missing} employees have not submitted</div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: "var(--space-4)" }}>
                  <button className="btn btn-outline w-full btn-sm">View all {timesheetHealth.pendingApprovals} pending →</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Budget Health</div><div className="card-subtitle">Project utilisation this week</div></div>
          </div>
          <div className="card-body">
            {contributions.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div className="kpi-list">
                {contributions.slice(0, 5).map((r, i) => (
                  <KpiItem key={r.project} name={r.project} color={PALETTE[i % PALETTE.length]} value={r.minutes} max={maxContrib} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin View ────────────────────────────────────────────────────────────────
function AdminDashboard({ data, username }: { data: AdminData; username: string }) {
  const { effortByDepartment, effortByProject, billable, consultantVsInternal, underOver, compliance } = data;
  const totalBillable = billable.billableMinutes + billable.nonBillableMinutes;
  const billablePct = totalBillable > 0 ? Math.round((billable.billableMinutes / totalBillable) * 100) : 0;
  const maxDept = Math.max(...effortByDepartment.map(r => r.minutes), 1);
  const maxProj = Math.max(...effortByProject.map(r => r.minutes), 1);
  const complianceList = compliance as Array<{ workDate?: string; date?: string; isCompliant?: boolean; compliant?: boolean }>;
  const donutSegs = billable.billableMinutes > 0 || billable.nonBillableMinutes > 0 ? [
    { pct: billablePct, color: "var(--success)" },
    { pct: 100 - billablePct, color: "var(--n-200)" },
  ] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="page-header">
        <div>
          <div className="page-title">{greeting(username)}</div>
          <div className="page-subtitle">Organisation overview — {todayStr()}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm">📥 Export</button>
        </div>
      </div>

      <div className="stat-grid-4 mb-5">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--brand-50)" }}>◈</div>
            <span className="stat-trend trend-flat">Active</span>
          </div>
          <div className="stat-value">{effortByDepartment.length}</div>
          <div className="stat-label">Departments</div>
          <div className="stat-footer">With recorded effort</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: billablePct >= 70 ? "var(--success-light)" : "var(--warning-light)" }}>📊</div>
            <span className={`stat-trend ${billablePct >= 70 ? "trend-up" : "trend-down"}`}>{billablePct >= 70 ? "↑ On track" : "↓ Below target"}</span>
          </div>
          <div className="stat-value">{billablePct}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>%</span></div>
          <div className="stat-label">Billable ratio (30d)</div>
          <div className="stat-footer">{fmtMinutes(billable.billableMinutes)} billable</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}>👥</div>
            <span className="stat-trend trend-flat">Staff</span>
          </div>
          <div className="stat-value">{consultantVsInternal.internal + consultantVsInternal.consultant}</div>
          <div className="stat-label">Total workforce</div>
          <div className="stat-footer">{consultantVsInternal.internal} internal · {consultantVsInternal.consultant} consultants</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)" }}>⏱</div>
            <span className="stat-trend trend-flat">Non-billable</span>
          </div>
          <div className="stat-value">{fmtMinutes(billable.nonBillableMinutes)}</div>
          <div className="stat-label">Non-billable (30d)</div>
          <div className="stat-footer">{effortByProject.length} active projects</div>
        </div>
      </div>

      {/* Row 2: Dept bar chart + billable donut */}
      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Department Effort — Last 30 Days</div><div className="card-subtitle">Hours per department</div></div>
          </div>
          <div className="card-body">
            {effortByDepartment.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <>
                <div className="bar-chart">
                  {effortByDepartment.slice(0, 7).map((r, i) => {
                    const pct = Math.round((r.minutes / maxDept) * 100);
                    return (
                      <div key={r.department} className="bar-col">
                        <div className="bar-tracks">
                          <div className="bar-seg" style={{ height: "100%", background: "var(--n-100)" }} />
                          <div className="bar-seg" style={{ height: `${pct}%`, background: PALETTE[i % PALETTE.length] }} title={`${r.department}: ${fmtMinutes(r.minutes)}`} />
                        </div>
                        <div className="bar-day">{r.department.slice(0, 4)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="chart-legend">
                  {effortByDepartment.slice(0, 4).map((r, i) => (
                    <div key={r.department} className="chart-legend-item">
                      <div className="chart-legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                      {r.department.length > 12 ? r.department.slice(0, 12) + "…" : r.department}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Billable vs Non-Billable</div><div className="card-subtitle">Last 30 days</div></div>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
              {donutSegs.length > 0 && <DonutChart segments={donutSegs} />}
              <div className="kpi-list" style={{ flex: 1 }}>
                <KpiItem name="Billable" color="var(--success)" value={billable.billableMinutes} max={totalBillable} />
                <KpiItem name="Non-Billable" color="var(--n-300)" value={billable.nonBillableMinutes} max={totalBillable} />
                <KpiItem name="Internal Staff" color="var(--brand-500)" value={consultantVsInternal.internal} max={consultantVsInternal.internal + consultantVsInternal.consultant} />
                <KpiItem name="Consultants" color="var(--info)" value={consultantVsInternal.consultant} max={consultantVsInternal.internal + consultantVsInternal.consultant} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Under/over + Compliance + Project KPI */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Utilization</div><div className="card-subtitle">Under / over utilized staff</div></div>
          </div>
          <div className="card-body">
            {underOver.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div className="activity-list">
                {underOver.slice(0, 6).map((r) => (
                  <div key={r.username} className="activity-item">
                    <div className="activity-icon-wrap" style={{ background: r.status === "overloaded" ? "var(--danger-light)" : r.status === "balanced" ? "var(--success-light)" : "var(--warning-light)" }}>
                      {r.status === "overloaded" ? "↑" : r.status === "balanced" ? "✓" : "↓"}
                    </div>
                    <div className="activity-body">
                      <div className="activity-text"><strong>{r.username}</strong></div>
                      <div className="activity-meta">{fmtMinutes(r.minutes)}</div>
                    </div>
                    <div className="activity-ts">{loadBadge(r.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Compliance Trend</div><div className="card-subtitle">Recent records</div></div>
          </div>
          <div className="card-body">
            {complianceList.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div className="activity-list">
                {complianceList.slice(0, 6).map((r, i) => {
                  const date = r.workDate ?? r.date ?? String(i);
                  const ok = r.isCompliant ?? r.compliant ?? false;
                  return (
                    <div key={i} className="activity-item">
                      <div className="activity-icon-wrap" style={{ background: ok ? "var(--success-light)" : "var(--danger-light)" }}>{ok ? "✓" : "✗"}</div>
                      <div className="activity-body">
                        <div className="activity-text"><strong>{date}</strong></div>
                        <div className="activity-meta">{ok ? "Compliant" : "Non-compliant"}</div>
                      </div>
                      <span className={`badge ${ok ? "badge-success" : "badge-error"}`}>{ok ? "OK" : "Fail"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Effort by Project</div><div className="card-subtitle">Last 30 days</div></div>
          </div>
          <div className="card-body">
            {effortByProject.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div className="kpi-list">
                {effortByProject.slice(0, 5).map((r, i) => (
                  <KpiItem key={r.project} name={r.project} color={PALETTE[i % PALETTE.length]} value={r.minutes} max={maxProj} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export function Dashboard({ role, username }: DashboardProps) {
  const [data, setData] = useState<EmployeeData | ManagerData | AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = role === "admin" ? "/dashboard/management" : role === "manager" ? "/dashboard/manager" : "/dashboard/employee";
    apiFetch(path).then(async (r) => { if (r.ok) setData(await r.json()); }).finally(() => setLoading(false));
  }, [role]);

  return (
    <section>
      {loading && <DashboardSkeleton />}
      {!loading && !data && (
        <div className="empty-state">
          <div className="empty-state__icon">⚠</div>
          <p className="empty-state__title">Failed to load dashboard</p>
          <p className="empty-state__sub">Could not fetch your data. Please refresh the page.</p>
        </div>
      )}
      {!loading && data && role === "employee" && <EmployeeDashboard data={data as EmployeeData} username={username} />}
      {!loading && data && role === "manager"  && <ManagerDashboard  data={data as ManagerData}  username={username} />}
      {!loading && data && role === "admin"    && <AdminDashboard    data={data as AdminData}    username={username} />}
    </section>
  );
}
