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

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 140, padding: "var(--space-5) var(--space-6)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ? "var(--color-primary)" : "var(--color-text-primary)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>{sub}</div>}
    </div>
  );
}

// ── Employee View ─────────────────────────────────────────────────────────────

function EmployeeDashboard({ data }: { data: EmployeeData }) {
  const { todaySession, todayTimesheet, weeklyHours, projectEffort, monthlyComplianceTrend } = data;
  const compliantDays = monthlyComplianceTrend.filter((r) => r.isCompliant).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Stat row */}
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <StatCard
          label="Check-in"
          value={fmtTime(todaySession.checkedIn)}
          sub={todaySession.checkedOut ? `Out: ${fmtTime(todaySession.checkedOut)}` : todaySession.checkedIn ? "Still checked in" : "Not checked in"}
        />
        <StatCard
          label="Attendance today"
          value={fmtMinutes(todaySession.attendanceMinutes)}
          sub={todaySession.breakMinutes ? `Break: ${fmtMinutes(todaySession.breakMinutes)}` : undefined}
          accent
        />
        <StatCard
          label="Hours this week"
          value={fmtMinutes(weeklyHours.entered)}
          sub="logged"
          accent
        />
        <div className="card" style={{ flex: 1, minWidth: 140, padding: "var(--space-5) var(--space-6)" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>Timesheet today</div>
          <div style={{ marginTop: 4 }}>{statusBadge(todayTimesheet.status)}</div>
          {todayTimesheet.mismatchReason && (
            <div style={{ fontSize: 12, color: "var(--color-danger)", marginTop: "var(--space-2)" }}>{todayTimesheet.mismatchReason}</div>
          )}
        </div>
        <StatCard
          label="Compliance (month)"
          value={`${compliantDays}/${monthlyComplianceTrend.length}`}
          sub="compliant days"
          accent={compliantDays === monthlyComplianceTrend.length}
        />
      </div>

      {/* Project effort */}
      {projectEffort.length > 0 && (
        <div className="card" style={{ padding: "var(--space-5) var(--space-6)" }}>
          <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>This week by project</div>
          <table className="table-base">
            <thead>
              <tr><th>Project</th><th>Hours</th></tr>
            </thead>
            <tbody>
              {projectEffort.map((r) => (
                <tr key={r.project}>
                  <td>{r.project}</td>
                  <td>{fmtMinutes(r.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Manager View ──────────────────────────────────────────────────────────────

function ManagerDashboard({ data }: { data: ManagerData }) {
  const { teamAttendance, timesheetHealth, mismatches, utilization, contributions } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Team attendance */}
      <div>
        <div className="section-title" style={{ marginBottom: "var(--space-3)" }}>Team attendance today</div>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <StatCard label="Present" value={teamAttendance.present} accent />
          <StatCard label="On leave" value={teamAttendance.onLeave} />
          <StatCard label="Not checked in" value={teamAttendance.notCheckedIn} />
        </div>
      </div>

      {/* Timesheet health */}
      <div>
        <div className="section-title" style={{ marginBottom: "var(--space-3)" }}>Timesheet health</div>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <StatCard label="Missing timesheets" value={timesheetHealth.missing} />
          <StatCard label="Pending approvals" value={timesheetHealth.pendingApprovals} accent={timesheetHealth.pendingApprovals > 0} />
          <StatCard label="Avg hours (7d)" value={fmtMinutes(Math.round(utilization.avgMinutes))} />
        </div>
      </div>

      {/* Project contributions */}
      {contributions.length > 0 && (
        <div className="card" style={{ padding: "var(--space-5) var(--space-6)" }}>
          <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>Project contributions (last 7 days)</div>
          <table className="table-base">
            <thead>
              <tr><th>Project</th><th>Hours</th></tr>
            </thead>
            <tbody>
              {contributions.map((r) => (
                <tr key={r.project}>
                  <td>{r.project}</td>
                  <td>{fmtMinutes(r.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <tr key={i}>
                  <td>{r.username}</td>
                  <td>{r.workDate}</td>
                  <td style={{ color: "var(--color-danger)", fontSize: 13 }}>{r.mismatchReason}</td>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Top stats */}
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <StatCard label="Billable hours (30d)" value={fmtMinutes(billable.billableMinutes)} sub={`${billablePct}% of total`} accent />
        <StatCard label="Non-billable (30d)" value={fmtMinutes(billable.nonBillableMinutes)} sub={`${100 - billablePct}% of total`} />
        <StatCard label="Internal staff" value={consultantVsInternal.internal} />
        <StatCard label="Consultants" value={consultantVsInternal.consultant} />
      </div>

      <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
        {/* Effort by department */}
        {effortByDepartment.length > 0 && (
          <div className="card" style={{ flex: 1, minWidth: 280, padding: "var(--space-5) var(--space-6)" }}>
            <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>Effort by department (30d)</div>
            <table className="table-base">
              <thead>
                <tr><th>Department</th><th>Hours</th></tr>
              </thead>
              <tbody>
                {effortByDepartment.map((r) => (
                  <tr key={r.department}>
                    <td>{r.department}</td>
                    <td>{fmtMinutes(r.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Effort by project */}
        {effortByProject.length > 0 && (
          <div className="card" style={{ flex: 1, minWidth: 280, padding: "var(--space-5) var(--space-6)" }}>
            <div className="section-title" style={{ marginBottom: "var(--space-4)" }}>Effort by project (30d)</div>
            <table className="table-base">
              <thead>
                <tr><th>Project</th><th>Hours</th></tr>
              </thead>
              <tbody>
                {effortByProject.map((r) => (
                  <tr key={r.project}>
                    <td>{r.project}</td>
                    <td>{fmtMinutes(r.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <tr key={r.username}>
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

      {loading && (
        <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Loading…</div>
      )}

      {!loading && !data && (
        <div className="alert alert-error">Failed to load dashboard data.</div>
      )}

      {!loading && data && role === "employee" && <EmployeeDashboard data={data as EmployeeData} />}
      {!loading && data && role === "manager" && <ManagerDashboard data={data as ManagerData} />}
      {!loading && data && role === "admin" && <AdminDashboard data={data as AdminData} />}
    </section>
  );
}
