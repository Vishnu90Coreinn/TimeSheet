import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { AttendanceWidget } from "./AttendanceWidget";

interface DashboardProps {
  role: string;
}

// ── Employee ──────────────────────────────────────────────────────────────────

interface EmployeeSession {
  workDate: string;
  checkedIn: string | null;
  checkedOut: string | null;
  breakMinutes: number;
  attendanceMinutes: number;
}
interface EmployeeTimesheet {
  status: string;
  mismatchReason: string | null;
  enteredMinutes: number;
  pendingActions: number;
}
interface EmployeeWeekly {
  entered: number;
  breaks: number;
}
interface ProjectEffortRow {
  project: string;
  minutes: number;
}
interface ComplianceRow {
  workDate: string;
  isCompliant: boolean;
}
interface EmployeeData {
  todaySession: EmployeeSession;
  todayTimesheet: EmployeeTimesheet;
  weeklyHours: EmployeeWeekly;
  projectEffort: ProjectEffortRow[];
  monthlyComplianceTrend: ComplianceRow[];
}

// ── Manager ───────────────────────────────────────────────────────────────────

interface TeamAttendance {
  present: number;
  onLeave: number;
  notCheckedIn: number;
}
interface TimesheetHealth {
  missing: number;
  pendingApprovals: number;
}
interface MismatchRow {
  username: string;
  workDate: string;
  mismatchReason: string;
}
interface Utilization {
  avgMinutes: number;
}
interface ContributionRow {
  project: string;
  minutes: number;
}
interface ManagerData {
  teamAttendance: TeamAttendance;
  timesheetHealth: TimesheetHealth;
  mismatches: MismatchRow[];
  utilization: Utilization;
  contributions: ContributionRow[];
}

// ── Admin ─────────────────────────────────────────────────────────────────────

interface DeptRow {
  department: string;
  minutes: number;
}
interface ProjectRow {
  project: string;
  minutes: number;
}
interface Billable {
  billableMinutes: number;
  nonBillableMinutes: number;
}
interface ConsultantInternal {
  consultant: number;
  internal: number;
}
interface UserLoad {
  username: string;
  status: "underutilized" | "balanced" | "overloaded";
  minutes: number;
}
interface AdminData {
  effortByDepartment: DeptRow[];
  effortByProject: ProjectRow[];
  billable: Billable;
  consultantVsInternal: ConsultantInternal;
  underOver: UserLoad[];
  compliance: unknown[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  return min === 0 ? `${h}h` : `${h}h ${min}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "badge badge-warning",
    submitted: "badge badge-info",
    approved: "badge badge-success",
    rejected: "badge badge-error",
  };
  return <span className={map[status.toLowerCase()] ?? "badge badge-neutral"}>{status}</span>;
}

function loadBadge(status: string) {
  const map: Record<string, string> = {
    underutilized: "badge badge-warning",
    balanced: "badge badge-success",
    overloaded: "badge badge-error",
  };
  return <span className={map[status] ?? "badge badge-neutral"}>{status}</span>;
}

// ── KPI Stat Card ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  accentColor?: string;
  icon?: React.ReactNode;
  trendDir?: "up" | "down";
}

function StatCard({ label, value, sub, accent, accentColor, icon, trendDir }: StatCardProps) {
  const color = accentColor ?? (accent ? "var(--color-accent-indigo)" : "var(--color-text-muted)");
  const iconBg = accentColor ? `${accentColor}18` : accent ? "var(--color-primary-subtle)" : "var(--color-surface-raised)";
  return (
    <div
      className="card kpi-card"
      style={{ flex: 1, minWidth: 150, padding: "var(--space-5) var(--space-6)", "--kpi-accent": color } as React.CSSProperties}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.4 }}>{label}</div>
        {icon && (
          <div className="kpi-icon" style={{ "--kpi-accent": color, "--kpi-icon-bg": iconBg } as React.CSSProperties}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || accentColor ? color : "var(--color-text-primary)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && (
        <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          {trendDir === "up" && <span className="trend-up">▲ {sub}</span>}
          {trendDir === "down" && <span className="trend-down">▼ {sub}</span>}
          {!trendDir && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ── Dashboard skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        {[160, 140, 140, 140, 140].map((w, i) => (
          <div key={i} className="card skeleton-card skeleton" style={{ flex: 1, minWidth: w, height: 100 }} />
        ))}
      </div>
      <div className="card skeleton-card skeleton" style={{ height: 180 }} />
    </div>
  );
}

// ── Employee View ─────────────────────────────────────────────────────────────

function EmployeeDashboard({ data }: { data: EmployeeData }) {
  const { todaySession, todayTimesheet, weeklyHours, projectEffort, monthlyComplianceTrend } = data;
  const compliantDays = monthlyComplianceTrend.filter((r) => r.isCompliant).length;
  const compliancePct = monthlyComplianceTrend.length > 0 ? Math.round((compliantDays / monthlyComplianceTrend.length) * 100) : 0;
  const maxProjectMinutes = Math.max(...projectEffort.map((r) => r.minutes), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Stat row */}
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <StatCard
          label="Check-in"
          value={fmtTime(todaySession.checkedIn)}
          sub={todaySession.checkedOut ? `Out: ${fmtTime(todaySession.checkedOut)}` : todaySession.checkedIn ? "Still checked in" : "Not checked in"}
          icon={<ClockSvg />}
        />
        <StatCard
          label="Attendance today"
          value={fmtMinutes(todaySession.attendanceMinutes)}
          sub={todaySession.breakMinutes ? `Break: ${fmtMinutes(todaySession.breakMinutes)}` : "No breaks"}
          accent
          accentColor="var(--color-accent-emerald)"
          icon={<CheckCircleSvg />}
        />
        <StatCard
          label="Hours this week"
          value={fmtMinutes(weeklyHours.entered)}
          sub="logged this week"
          accent
          accentColor="var(--color-accent-indigo)"
          icon={<TrendSvg />}
        />
        <div
          className="card kpi-card"
          style={{ flex: 1, minWidth: 150, padding: "var(--space-5) var(--space-6)", "--kpi-accent": "var(--color-accent-sky)" } as React.CSSProperties}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>Timesheet today</div>
          <div>{statusBadge(todayTimesheet.status)}</div>
          {todayTimesheet.mismatchReason && (
            <div style={{ fontSize: 12, color: "var(--color-error)", marginTop: "var(--space-2)" }}>{todayTimesheet.mismatchReason}</div>
          )}
        </div>
        <StatCard
          label="Compliance (month)"
          value={`${compliancePct}%`}
          sub={`${compliantDays}/${monthlyComplianceTrend.length} days`}
          accent={compliancePct === 100}
          accentColor={compliancePct === 100 ? "var(--color-accent-emerald)" : compliancePct >= 80 ? "var(--color-accent-amber)" : "var(--color-error)"}
          icon={<ShieldSvg />}
        />
      </div>

      {/* Project effort with progress bars */}
      {projectEffort.length > 0 && (
        <div className="card" style={{ padding: "var(--space-5) var(--space-6)" }}>
          <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>This week by project</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {projectEffort.map((r) => (
              <div key={r.project} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div style={{ width: 160, fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.project}</div>
                <div className="progress-bar" style={{ "--kpi-accent": "var(--color-accent-indigo)" } as React.CSSProperties}>
                  <div className="progress-bar__fill" style={{ width: `${Math.round((r.minutes / maxProjectMinutes) * 100)}%` }} />
                </div>
                <div style={{ width: 56, fontSize: 13, color: "var(--color-text-muted)", textAlign: "right", flexShrink: 0 }}>{fmtMinutes(r.minutes)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Manager View ──────────────────────────────────────────────────────────────

function ManagerDashboard({ data }: { data: ManagerData }) {
  const { teamAttendance, timesheetHealth, mismatches, utilization, contributions } = data;
  const maxContribMinutes = Math.max(...contributions.map((r) => r.minutes), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Team attendance */}
      <div>
        <div className="section-title" style={{ marginBottom: "var(--space-3)" }}>Team attendance today</div>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <StatCard label="Present" value={teamAttendance.present} accent accentColor="var(--color-accent-emerald)" icon={<CheckCircleSvg />} />
          <StatCard label="On leave" value={teamAttendance.onLeave} accentColor="var(--color-accent-sky)" icon={<CalendarSmSvg />} />
          <StatCard label="Not checked in" value={teamAttendance.notCheckedIn} accentColor={teamAttendance.notCheckedIn > 0 ? "var(--color-accent-rose)" : "var(--color-text-muted)"} icon={<AlertSvg />} />
        </div>
      </div>

      {/* Timesheet health */}
      <div>
        <div className="section-title" style={{ marginBottom: "var(--space-3)" }}>Timesheet health</div>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <StatCard label="Missing timesheets" value={timesheetHealth.missing} accentColor={timesheetHealth.missing > 0 ? "var(--color-accent-rose)" : "var(--color-text-muted)"} icon={<AlertSvg />} />
          <StatCard label="Pending approvals" value={timesheetHealth.pendingApprovals} accent={timesheetHealth.pendingApprovals > 0} accentColor="var(--color-accent-amber)" icon={<ClockSvg />} />
          <StatCard label="Avg hours (7d)" value={fmtMinutes(Math.round(utilization.avgMinutes))} accentColor="var(--color-accent-indigo)" icon={<TrendSvg />} />
        </div>
      </div>

      {/* Project contributions with progress bars */}
      {contributions.length > 0 && (
        <div className="card" style={{ padding: "var(--space-5) var(--space-6)" }}>
          <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>Project contributions (last 7 days)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {contributions.map((r) => (
              <div key={r.project} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div style={{ width: 160, fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.project}</div>
                <div className="progress-bar" style={{ "--kpi-accent": "var(--color-accent-emerald)" } as React.CSSProperties}>
                  <div className="progress-bar__fill" style={{ width: `${Math.round((r.minutes / maxContribMinutes) * 100)}%` }} />
                </div>
                <div style={{ width: 56, fontSize: 13, color: "var(--color-text-muted)", textAlign: "right", flexShrink: 0 }}>{fmtMinutes(r.minutes)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mismatches */}
      {mismatches.length > 0 && (
        <div className="card" style={{ padding: "var(--space-5) var(--space-6)" }}>
          <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>Recent mismatches</div>
          <table className="table-base">
            <thead>
              <tr><th>Employee</th><th>Date</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {mismatches.map((r, i) => (
                <tr key={i} className="row-status-warning">
                  <td>{r.username}</td>
                  <td>{r.workDate}</td>
                  <td style={{ color: "var(--color-error)", fontSize: 13 }}>{r.mismatchReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Admin View ────────────────────────────────────────────────────────────────

function AdminDashboard({ data }: { data: AdminData }) {
  const { effortByDepartment, effortByProject, billable, consultantVsInternal, underOver } = data;
  const totalBillable = billable.billableMinutes + billable.nonBillableMinutes;
  const billablePct = totalBillable > 0 ? Math.round((billable.billableMinutes / totalBillable) * 100) : 0;
  const maxDeptMinutes = Math.max(...effortByDepartment.map((r) => r.minutes), 1);
  const maxProjMinutes = Math.max(...effortByProject.map((r) => r.minutes), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Top stats */}
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <StatCard label="Billable hours (30d)" value={fmtMinutes(billable.billableMinutes)} sub={`${billablePct}% of total`} accent accentColor="var(--color-accent-emerald)" icon={<TrendSvg />} />
        <StatCard label="Non-billable (30d)" value={fmtMinutes(billable.nonBillableMinutes)} sub={`${100 - billablePct}% of total`} accentColor="var(--color-accent-amber)" icon={<ClockSvg />} />
        <StatCard label="Internal staff" value={consultantVsInternal.internal} accentColor="var(--color-accent-indigo)" icon={<UsersSvg />} />
        <StatCard label="Consultants" value={consultantVsInternal.consultant} accentColor="var(--color-accent-sky)" icon={<UsersSvg />} />
      </div>

      {/* Billable vs non-billable progress */}
      <div className="card" style={{ padding: "var(--space-5) var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="section-title" style={{ margin: 0 }}>Billable ratio (30d)</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent-emerald)" }}>{billablePct}%</span>
        </div>
        <div className="progress-bar" style={{ height: 10, "--kpi-accent": billablePct >= 70 ? "var(--color-accent-emerald)" : billablePct >= 50 ? "var(--color-accent-amber)" : "var(--color-error)" } as React.CSSProperties}>
          <div className="progress-bar__fill" style={{ width: `${billablePct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)", fontSize: 12, color: "var(--color-text-muted)" }}>
          <span>Billable: {fmtMinutes(billable.billableMinutes)}</span>
          <span>Non-billable: {fmtMinutes(billable.nonBillableMinutes)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
        {/* Effort by department */}
        {effortByDepartment.length > 0 && (
          <div className="card" style={{ flex: 1, minWidth: 280, padding: "var(--space-5) var(--space-6)" }}>
            <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>Effort by department (30d)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {effortByDepartment.map((r) => (
                <div key={r.department} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{ width: 120, fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.department}</div>
                  <div className="progress-bar" style={{ "--kpi-accent": "var(--color-accent-sky)" } as React.CSSProperties}>
                    <div className="progress-bar__fill" style={{ width: `${Math.round((r.minutes / maxDeptMinutes) * 100)}%` }} />
                  </div>
                  <div style={{ width: 52, fontSize: 13, color: "var(--color-text-muted)", textAlign: "right", flexShrink: 0 }}>{fmtMinutes(r.minutes)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Effort by project */}
        {effortByProject.length > 0 && (
          <div className="card" style={{ flex: 1, minWidth: 280, padding: "var(--space-5) var(--space-6)" }}>
            <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>Effort by project (30d)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {effortByProject.map((r) => (
                <div key={r.project} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{ width: 120, fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.project}</div>
                  <div className="progress-bar" style={{ "--kpi-accent": "var(--color-accent-indigo)" } as React.CSSProperties}>
                    <div className="progress-bar__fill" style={{ width: `${Math.round((r.minutes / maxProjMinutes) * 100)}%` }} />
                  </div>
                  <div style={{ width: 52, fontSize: 13, color: "var(--color-text-muted)", textAlign: "right", flexShrink: 0 }}>{fmtMinutes(r.minutes)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User load */}
      {underOver.length > 0 && (
        <div className="card" style={{ padding: "var(--space-5) var(--space-6)" }}>
          <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>User utilization (30d)</div>
          <table className="table-base">
            <thead>
              <tr><th>Employee</th><th>Hours logged</th><th>Status</th></tr>
            </thead>
            <tbody>
              {underOver.map((r) => (
                <tr
                  key={r.username}
                  className={r.status === "balanced" ? "row-status-success" : r.status === "underutilized" ? "row-status-warning" : "row-status-error"}
                >
                  <td>{r.username}</td>
                  <td>{fmtMinutes(r.minutes)}</td>
                  <td>{loadBadge(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function Dashboard({ role }: DashboardProps) {
  const [data, setData] = useState<EmployeeData | ManagerData | AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path =
      role === "admin" ? "/dashboard/management" :
      role === "manager" ? "/dashboard/manager" :
      "/dashboard/employee";

    apiFetch(path).then(async (r) => {
      if (r.ok) setData(await r.json());
    }).finally(() => setLoading(false));
  }, [role]);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <AttendanceWidget />

      <h2 className="page-title">Dashboard</h2>

      {loading && <DashboardSkeleton />}

      {!loading && !data && (
        <div className="empty-state">
          <div className="empty-state__icon"><AlertSvg size={48} /></div>
          <p className="empty-state__title">Failed to load dashboard</p>
          <p className="empty-state__sub">Could not fetch your data. Please refresh the page.</p>
        </div>
      )}

      {!loading && data && role === "employee" && <EmployeeDashboard data={data as EmployeeData} />}
      {!loading && data && role === "manager" && <ManagerDashboard data={data as ManagerData} />}
      {!loading && data && role === "admin" && <AdminDashboard data={data as AdminData} />}
    </section>
  );
}

// ── Inline SVG icons for KPI cards ────────────────────────────────────────────
function ClockSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function CheckCircleSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
function TrendSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
}
function ShieldSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function CalendarSmSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function AlertSvg({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function UsersSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
