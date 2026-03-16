import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { AttendanceWidget } from "./AttendanceWidget";
import type { LeaveBalance } from "../types";

interface DashboardProps { role: string; username: string; }

// ── Employee interfaces ───────────────────────────────────────────────────────
interface EmployeeSession { workDate: string; checkedIn: string | null; checkedOut: string | null; breakMinutes: number; attendanceMinutes: number; }
interface EmployeeTimesheet { status: string; mismatchReason: string | null; enteredMinutes: number; pendingActions: number; }
interface EmployeeWeekly { entered: number; breaks: number; }
interface ProjectEffortRow { project: string; minutes: number; }
interface ComplianceRow { workDate: string; isCompliant: boolean; }
interface EmployeeData {
  todaySession: EmployeeSession;
  todayTimesheet: EmployeeTimesheet;
  weeklyHours: EmployeeWeekly;
  projectEffort: ProjectEffortRow[];
  monthlyComplianceTrend: ComplianceRow[];
}

// ── Week summary ──────────────────────────────────────────────────────────────
interface WeekDayMeta { workDate: string; status: string; enteredMinutes: number; expectedMinutes: number; attendanceNetMinutes: number; hasMismatch: boolean; }
interface WeekSummary { weekStartDate: string; weekEndDate: string; weekEnteredMinutes: number; weekExpectedMinutes: number; weekAttendanceNetMinutes: number; days: WeekDayMeta[]; }

// ── Manager interfaces ────────────────────────────────────────────────────────
interface TeamAttendance { present: number; onLeave: number; notCheckedIn: number; }
interface TimesheetHealth { missing: number; pendingApprovals: number; }
interface MismatchRow { username: string; workDate: string; mismatchReason: string; }
interface Utilization { avgMinutes: number; }
interface ContributionRow { project: string; minutes: number; }
interface ManagerData { teamAttendance: TeamAttendance; timesheetHealth: TimesheetHealth; mismatches: MismatchRow[]; utilization: Utilization; contributions: ContributionRow[]; }

// ── Admin interfaces ──────────────────────────────────────────────────────────
interface DeptRow { department: string; minutes: number; }
interface ProjectRow { project: string; minutes: number; }
interface Billable { billableMinutes: number; nonBillableMinutes: number; }
interface ConsultantInternal { consultant: number; internal: number; }
interface UserLoad { username: string; status: "underutilized" | "balanced" | "overloaded"; minutes: number; }
interface AdminData { effortByDepartment: DeptRow[]; effortByProject: ProjectRow[]; billable: Billable; consultantVsInternal: ConsultantInternal; underOver: UserLoad[]; compliance: unknown[]; }

// ── Pending approval ──────────────────────────────────────────────────────────
interface PendingApproval { timesheetId: string; username: string; workDate: string; enteredMinutes: number; status: string; hasMismatch: boolean; }

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
  const m: Record<string, string> = { draft: "badge badge-warning", submitted: "badge badge-info", approved: "badge badge-success", rejected: "badge badge-error" };
  return <span className={m[s?.toLowerCase()] ?? "badge badge-neutral"}>{s}</span>;
}
function loadBadge(s: string) {
  const m: Record<string, string> = { underutilized: "badge badge-warning", balanced: "badge badge-success", overloaded: "badge badge-error" };
  return <span className={m[s] ?? "badge badge-neutral"}>{s}</span>;
}
function avatarColor(name: string): string {
  const colors = [
    "linear-gradient(135deg,#6366f1,#4338ca)",
    "linear-gradient(135deg,#10b981,#065f46)",
    "linear-gradient(135deg,#f59e0b,#b45309)",
    "linear-gradient(135deg,#3b82f6,#1e40af)",
    "linear-gradient(135deg,#ec4899,#be185d)",
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
}

// ── Donut chart ───────────────────────────────────────────────────────────────
const CIRC = 251.2;
function DonutChart({ segments, centerLabel, centerSub }: { segments: { pct: number; color: string }[]; centerLabel?: string; centerSub?: string }) {
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
        <div className="donut-val">{centerLabel ?? `${Math.round(total)}%`}</div>
        <div className="donut-sub">{centerSub ?? "used"}</div>
      </div>
    </div>
  );
}

// ── KPI progress list item ────────────────────────────────────────────────────
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

const PALETTE = ["var(--brand-500)", "var(--info)", "var(--warning)", "var(--success)", "var(--n-300)"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function WeeklyBarChart({ days }: { days: WeekDayMeta[] }) {
  if (days.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "var(--space-6) 0" }}>
        <p className="empty-state__title">No data this week</p>
      </div>
    );
  }
  const maxMinutes = Math.max(...days.map(d => Math.max(d.enteredMinutes, d.expectedMinutes > 0 ? d.expectedMinutes : 480)), 1);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="wbc-wrap">
      {days.map((day, i) => {
        const target = day.expectedMinutes > 0 ? day.expectedMinutes : 480;
        const logged = day.enteredMinutes;
        const targetPct = Math.min(100, (target / maxMinutes) * 100);
        const loggedPct = Math.min(100, (logged / maxMinutes) * 100);
        const isToday = day.workDate === todayIso;
        return (
          <div key={day.workDate} className="wbc-col">
            <div className="wbc-val">{logged > 0 ? `${(logged / 60).toFixed(1)}h` : ""}</div>
            <div className="wbc-tracks">
              <div className="wbc-target" style={{ height: `${targetPct}%` }} />
              {logged > 0 && (
                <div className="wbc-bar" style={{
                  height: `${loggedPct}%`,
                  background: isToday ? "var(--brand-500)" : "var(--brand-400)",
                }} />
              )}
            </div>
            <div className={`wbc-day${isToday ? " wbc-day--today" : ""}`}>{DAY_LABELS[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 260, height: 24, marginBottom: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: 200 }} />
        </div>
      </div>
      <div className="stat-grid-4">
        {[1, 2, 3, 4].map(i => (
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
        {[1, 2].map(i => (
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
function EmployeeDashboard({ employee, week, leaveBalances, activeProjectCount, username }: {
  employee: EmployeeData;
  week: WeekSummary;
  leaveBalances: LeaveBalance[];
  activeProjectCount: number;
  username: string;
}) {
  const { todaySession, todayTimesheet, projectEffort, monthlyComplianceTrend } = employee;

  // KPI computations
  const hoursThisWeek = week.weekEnteredMinutes / 60;
  const pctTarget = week.weekExpectedMinutes > 0
    ? Math.round((week.weekEnteredMinutes / week.weekExpectedMinutes) * 100)
    : 0;
  const compliantDays = monthlyComplianceTrend.filter(r => r.isCompliant).length;
  const approvalRate = monthlyComplianceTrend.length > 0
    ? Math.round((compliantDays / monthlyComplianceTrend.length) * 100)
    : 0;
  const annualLeave = leaveBalances.find(b => b.leaveTypeName.toLowerCase().includes("annual")) ?? leaveBalances[0];

  // Project split
  const totalEffort = projectEffort.reduce((a, r) => a + r.minutes, 0);
  const totalEffortH = (totalEffort / 60).toFixed(1);
  const maxEffort = Math.max(...projectEffort.map(r => r.minutes), 1);
  const donutSegs = projectEffort.slice(0, 4).map((r, i) => ({
    pct: totalEffort > 0 ? (r.minutes / totalEffort) * 100 : 0,
    color: PALETTE[i] ?? "var(--n-300)",
  }));

  // Recent activity (synthesised from available data)
  const activities: Array<{ icon: string; iconBg: string; text: string; sub: string; ts: string }> = [];
  if (todaySession.checkedIn) activities.push({ icon: "✓", iconBg: "var(--success-light)", text: "Checked in", sub: `At ${fmtTime(todaySession.checkedIn)}`, ts: "Today" });
  if (todaySession.checkedOut) activities.push({ icon: "○", iconBg: "var(--n-100)", text: "Checked out", sub: `At ${fmtTime(todaySession.checkedOut)}`, ts: "Today" });
  activities.push({ icon: "◈", iconBg: "var(--brand-50)", text: `Timesheet: ${todayTimesheet.status}`, sub: todayTimesheet.enteredMinutes > 0 ? `${fmtMinutes(todayTimesheet.enteredMinutes)} entered today` : "No entries yet", ts: "Today" });
  projectEffort.slice(0, 2).forEach(r => {
    activities.push({ icon: "⏱", iconBg: "var(--info-light)", text: `Time on ${r.project}`, sub: `${fmtMinutes(r.minutes)} this week`, ts: "This week" });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{greeting(username)}</div>
          <div className="page-subtitle">Here's what's happening with your work today — {todayStr()}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm">📥 Export</button>
          <button className="btn btn-primary btn-sm">+ Log Time</button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--brand-50)" }}>⏱</div>
            <span className={`stat-trend ${pctTarget >= 80 ? "trend-up" : "trend-flat"}`}>
              {pctTarget > 0 ? `↑${pctTarget}% target` : "No entries"}
            </span>
          </div>
          <div className="stat-value">{hoursThisWeek.toFixed(1)}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>h</span></div>
          <div className="stat-label">Hours this week</div>
          <div className="stat-footer">{week.weekExpectedMinutes > 0 ? `${(week.weekExpectedMinutes / 60).toFixed(0)}h expected this week` : "No schedule set"}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)" }}>✓</div>
            <span className={`stat-trend ${approvalRate >= 90 ? "trend-up" : "trend-flat"}`}>
              {approvalRate >= 90 ? `↑${approvalRate - 90}%` : "On track"}
            </span>
          </div>
          <div className="stat-value">{approvalRate}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>%</span></div>
          <div className="stat-label">Approval rate</div>
          <div className="stat-footer">{compliantDays} of {monthlyComplianceTrend.length} submitted this month</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}>◈</div>
            <span className="stat-trend trend-flat">Assigned</span>
          </div>
          <div className="stat-value">{activeProjectCount}</div>
          <div className="stat-label">Active projects</div>
          <div className="stat-footer">{projectEffort.length} with hours this week</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--warning-light)" }}>🌿</div>
            <span className="stat-trend trend-flat">FY {new Date().getFullYear()}</span>
          </div>
          <div className="stat-value">{annualLeave?.remainingDays ?? 0}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>d</span></div>
          <div className="stat-label">Leave balance</div>
          <div className="stat-footer">{annualLeave?.leaveTypeName ?? "Annual"} · FY {new Date().getFullYear()}</div>
        </div>
      </div>

      {/* Row 2: Weekly Hours Breakdown + Project Split */}
      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Weekly Hours Breakdown</div>
              <div className="card-subtitle">Logged hours vs daily target</div>
            </div>
            {pctTarget > 0 && (
              <span className={`stat-trend ${pctTarget >= 100 ? "trend-up" : "trend-flat"}`}>
                {pctTarget >= 100 ? "↑" : ""}{pctTarget}% target hit
              </span>
            )}
          </div>
          <div className="card-body">
            <WeeklyBarChart days={week.days} />
            <div className="chart-legend" style={{ marginTop: "var(--space-3)" }}>
              <div className="chart-legend-item">
                <div className="chart-legend-dot" style={{ background: "var(--brand-400)" }} />
                Logged hours
              </div>
              <div className="chart-legend-item">
                <div className="chart-legend-dot" style={{ background: "var(--n-200)" }} />
                Daily target
              </div>
            </div>
          </div>
        </div>

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
                <p className="empty-state__title">No entries yet</p>
                <p className="empty-state__sub">Log time to see your project split.</p>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
                <DonutChart segments={donutSegs} centerLabel={`${totalEffortH}h`} centerSub="Total" />
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

      {/* Row 3: Recent Activity + Attendance Widget + Leave Balance */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Activity</div>
              <div className="card-subtitle">Last 24 hours</div>
            </div>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {activities.slice(0, 5).map((a, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-icon-wrap" style={{ background: a.iconBg }}>{a.icon}</div>
                  <div className="activity-body">
                    <div className="activity-text">{a.text}</div>
                    <div className="activity-meta">{a.sub}</div>
                  </div>
                  <div className="activity-ts">{a.ts}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <AttendanceWidget />
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Leave Balance</div>
              <div className="card-subtitle">FY {new Date().getFullYear()}</div>
            </div>
          </div>
          <div className="card-body">
            {leaveBalances.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}>
                <p className="empty-state__title">No leave policy assigned</p>
              </div>
            ) : (
              <div className="kpi-list">
                {leaveBalances.map((lb, i) => (
                  <div key={lb.leaveTypeId} className="kpi-item">
                    <div className="kpi-header">
                      <div className="kpi-name">
                        <div className="kpi-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {lb.leaveTypeName}
                      </div>
                      <div className="kpi-val" style={{ color: lb.remainingDays <= 2 ? "var(--danger)" : "var(--text-primary)" }}>
                        {lb.remainingDays}d
                      </div>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{
                        width: `${lb.totalDays > 0 ? Math.round((lb.usedDays / lb.totalDays) * 100) : 0}%`,
                        background: PALETTE[i % PALETTE.length],
                      }} />
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                      {lb.usedDays}d used of {lb.totalDays}d
                    </div>
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

  // Inline pending approvals
  const [pendingList, setPendingList] = useState<PendingApproval[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  useEffect(() => {
    apiFetch("/approvals/pending-timesheets").then(async r => {
      if (r.ok) { const d = await r.json(); setPendingList((d as PendingApproval[]).slice(0, 5)); }
    }).catch(() => {});
  }, []);

  const quickApprove = async (id: string) => {
    setApprovingId(id);
    await apiFetch(`/approvals/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "" }),
    }).catch(() => {});
    setPendingList(prev => prev.filter(a => a.timesheetId !== id));
    setApprovingId(null);
  };

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

      <div className="stat-grid-4">
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

      {/* Row 2: Team Attendance bar + Project Contributions donut */}
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
                <DonutChart segments={donutSegs} centerLabel={`${(totalContrib / 60).toFixed(0)}h`} centerSub="Team" />
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

      {/* Row 3: Recent Activity | Pending Approvals | Budget Health */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Recent Activity</div><div className="card-subtitle">Team attendance & timesheet flags</div></div>
            {mismatches.length > 0 && <span className="badge badge-error">{mismatches.length}</span>}
          </div>
          <div className="card-body">
            {mismatches.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}>
                <p className="empty-state__title">No mismatches</p>
                <p className="empty-state__sub">All timesheets match attendance.</p>
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
            {pendingList.length === 0 && timesheetHealth.pendingApprovals === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}>
                <p className="empty-state__title">All clear</p>
                <p className="empty-state__sub">No pending approvals.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {pendingList.map(a => (
                    <div key={a.timesheetId} style={{
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      padding: "var(--space-2)", background: "var(--n-25)",
                      borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)",
                    }}>
                      <div className="av" style={{ background: avatarColor(a.username), borderRadius: "var(--r-md)", flexShrink: 0 }}>
                        {a.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.username}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{a.workDate} · {fmtMinutes(a.enteredMinutes)}</div>
                      </div>
                      <button
                        className="btn btn-outline-success btn-sm"
                        style={{ padding: "3px 8px", height: 26, fontSize: "0.72rem", minWidth: 28 }}
                        onClick={() => quickApprove(a.timesheetId)}
                        disabled={approvingId === a.timesheetId}
                        title="Approve"
                      >✓</button>
                    </div>
                  ))}
                </div>
                {timesheetHealth.pendingApprovals > 0 && (
                  <div style={{ marginTop: "var(--space-3)" }}>
                    <button className="btn btn-outline w-full btn-sm">View all {timesheetHealth.pendingApprovals} pending →</button>
                  </div>
                )}
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

      <div className="stat-grid-4">
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
interface EmpState { employee: EmployeeData; week: WeekSummary; leaveBalances: LeaveBalance[]; activeProjectCount: number; }

export function Dashboard({ role, username }: DashboardProps) {
  const [empState, setEmpState] = useState<EmpState | null>(null);
  const [mgrData, setMgrData] = useState<ManagerData | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (role === "employee") {
      Promise.all([
        apiFetch("/dashboard/employee").then(r => r.ok ? r.json() : null),
        apiFetch("/timesheets/week").then(r => r.ok ? r.json() : null),
        apiFetch("/leave/balance/my").then(r => r.ok ? r.json() : null),
        apiFetch("/projects").then(r => r.ok ? r.json() : null),
      ]).then(([employee, week, leaveBalances, projects]) => {
        if (employee) {
          const activeProjectCount = Array.isArray(projects)
            ? (projects as Array<{ isActive: boolean }>).filter(p => p.isActive).length
            : 0;
          setEmpState({
            employee,
            week: week ?? { weekStartDate: "", weekEndDate: "", weekEnteredMinutes: 0, weekExpectedMinutes: 0, weekAttendanceNetMinutes: 0, days: [] },
            leaveBalances: Array.isArray(leaveBalances) ? leaveBalances : [],
            activeProjectCount,
          });
        } else {
          setError(true);
        }
      }).catch(() => setError(true)).finally(() => setLoading(false));
    } else if (role === "manager") {
      apiFetch("/dashboard/manager")
        .then(async r => { if (r.ok) setMgrData(await r.json()); else setError(true); })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    } else {
      apiFetch("/dashboard/management")
        .then(async r => { if (r.ok) setAdminData(await r.json()); else setError(true); })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }
  }, [role]);

  if (loading) return <DashboardSkeleton />;

  if (error || (!empState && !mgrData && !adminData)) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">⚠</div>
        <p className="empty-state__title">Failed to load dashboard</p>
        <p className="empty-state__sub">Could not fetch your data. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <section>
      {empState && <EmployeeDashboard {...empState} username={username} />}
      {mgrData && <ManagerDashboard data={mgrData} username={username} />}
      {adminData && <AdminDashboard data={adminData} username={username} />}
    </section>
  );
}
