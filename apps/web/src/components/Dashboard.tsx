import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { AttendanceWidget } from "./AttendanceWidget";

interface DashboardProps {
  role: string;
  username: string;
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
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

// ── Shared layout pieces ───────────────────────────────────────────────────────

function Eyebrow({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9a84c" }}>
      <span style={{ display: "block", width: 24, height: 1, background: "#c9a84c" }} />
      {label}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "block", width: 20, height: 1, background: "#c9a84c" }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c9a84c" }}>{label}</span>
    </div>
  );
}

interface ActivityRowData {
  name: string;
  sub: string;
  status: string;
  value: string;
}

function ActivityList({ rows }: { rows: ActivityRowData[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 0", color: "var(--color-text-muted)", fontSize: "0.875rem", textAlign: "center" }}>
        No data available
      </div>
    );
  }
  const badgeMap: Record<string, string> = {
    draft: "warning", submitted: "info", approved: "success", rejected: "error",
    underutilized: "warning", balanced: "success", overloaded: "error",
  };
  return (
    <div style={{ borderTop: "1px solid rgba(14,14,15,0.1)" }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", alignItems: "center", gap: 16, padding: "18px 0", borderBottom: "1px solid rgba(14,14,15,0.1)" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
            {String(i + 1).padStart(2, "0")}
          </div>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--color-ink)" }}>{row.name}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: 2 }}>{row.sub}</div>
          </div>
          <span className={`badge badge-${badgeMap[row.status.toLowerCase()] ?? "neutral"}`}>{row.status}</span>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", color: "var(--color-ink)", textAlign: "right", minWidth: 52 }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton skeleton-text" style={{ width: 120, height: 11 }} />
        <div className="skeleton skeleton-title" style={{ width: 280, height: 40 }} />
      </div>
      <div style={{ display: "flex", gap: 48, paddingBottom: 28, borderBottom: "1px solid rgba(14,14,15,0.1)" }}>
        {[80, 100, 90].map((w, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton skeleton-title" style={{ width: w, height: 32 }} />
            <div className="skeleton skeleton-text" style={{ width: 70, height: 11 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", gap: 16, padding: "18px 0", borderBottom: "1px solid rgba(14,14,15,0.1)" }}>
            <div className="skeleton skeleton-text" style={{ width: 24, height: 14 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="skeleton skeleton-text" style={{ width: "60%", height: 14 }} />
              <div className="skeleton skeleton-text" style={{ width: "40%", height: 11 }} />
            </div>
            <div className="skeleton skeleton-text" style={{ width: 60, height: 20, borderRadius: 999 }} />
            <div className="skeleton skeleton-text" style={{ width: 48, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Employee View ─────────────────────────────────────────────────────────────

function EmployeeDashboard({ data, username }: { data: EmployeeData; username: string }) {
  const { todaySession, todayTimesheet, weeklyHours, projectEffort, monthlyComplianceTrend } = data;
  const compliantDays = monthlyComplianceTrend.filter((r) => r.isCompliant).length;
  const compliancePct = monthlyComplianceTrend.length > 0 ? Math.round((compliantDays / monthlyComplianceTrend.length) * 100) : 0;

  const projectRows: ActivityRowData[] = projectEffort.map((r) => ({
    name: r.project,
    sub: "this week",
    status: "submitted",
    value: fmtMinutes(r.minutes),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Page header */}
      <div style={{ borderBottom: "1px solid rgba(14,14,15,0.1)", paddingBottom: 32 }}>
        <Eyebrow label="DASHBOARD" />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Good {getGreeting()},<br /><em style={{ fontStyle: "italic", color: "var(--color-primary)" }}>{username}</em>
          </h1>
          <div style={{ display: "flex", gap: 36, paddingLeft: 16, borderLeft: "1px solid rgba(14,14,15,0.1)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtTime(todaySession.checkedIn)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Check-in</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMinutes(weeklyHours.entered)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Weekly hours</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: todayTimesheet.pendingActions > 0 ? "var(--color-error)" : "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{todayTimesheet.pendingActions}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 48, paddingBottom: 28, borderBottom: "1px solid rgba(14,14,15,0.1)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMinutes(todaySession.attendanceMinutes)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Attendance today</div>
        </div>
        <div style={{ width: 1, background: "rgba(14,14,15,0.1)", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{statusBadge(todayTimesheet.status)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Timesheet today</div>
        </div>
        <div style={{ width: 1, background: "rgba(14,14,15,0.1)", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: compliancePct === 100 ? "var(--color-success)" : compliancePct >= 80 ? "var(--color-primary)" : "var(--color-error)", letterSpacing: "-0.02em", lineHeight: 1 }}>{compliancePct}%</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Monthly compliance</div>
        </div>
      </div>

      {/* Two-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48 }}>
        <div>
          <SectionHeader label="PROJECT EFFORT THIS WEEK" />
          <ActivityList rows={projectRows} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <AttendanceWidget />
          {monthlyComplianceTrend.length > 0 && (
            <div>
              <SectionHeader label="MONTHLY COMPLIANCE" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {monthlyComplianceTrend.map((r) => (
                  <div
                    key={r.workDate}
                    title={r.workDate}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: r.isCompliant ? "var(--color-success-light)" : "var(--color-error-light)",
                      border: `1px solid ${r.isCompliant ? "rgba(90,122,94,0.25)" : "rgba(192,82,43,0.25)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: r.isCompliant ? "var(--color-success)" : "var(--color-error)",
                      fontWeight: 600,
                    }}
                  >
                    {r.isCompliant ? "✓" : "✗"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Manager View ──────────────────────────────────────────────────────────────

function ManagerDashboard({ data, username }: { data: ManagerData; username: string }) {
  const { teamAttendance, timesheetHealth, mismatches, utilization, contributions } = data;
  const maxContribMinutes = Math.max(...contributions.map((r) => r.minutes), 1);

  const mismatchRows: ActivityRowData[] = mismatches.map((r) => ({
    name: r.username,
    sub: r.workDate,
    status: "rejected",
    value: r.mismatchReason.slice(0, 12),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Page header */}
      <div style={{ borderBottom: "1px solid rgba(14,14,15,0.1)", paddingBottom: 32 }}>
        <Eyebrow label="TEAM OVERVIEW" />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Good {getGreeting()},<br /><em style={{ fontStyle: "italic", color: "var(--color-primary)" }}>{username}</em>
          </h1>
          <div style={{ display: "flex", gap: 36, paddingLeft: 16, borderLeft: "1px solid rgba(14,14,15,0.1)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{teamAttendance.present}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Present</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: timesheetHealth.missing > 0 ? "var(--color-error)" : "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{timesheetHealth.missing}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Missing</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMinutes(Math.round(utilization.avgMinutes))}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Avg hours</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 48, paddingBottom: 28, borderBottom: "1px solid rgba(14,14,15,0.1)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--color-success)", letterSpacing: "-0.02em", lineHeight: 1 }}>{teamAttendance.present}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Present today</div>
        </div>
        <div style={{ width: 1, background: "rgba(14,14,15,0.1)", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: teamAttendance.notCheckedIn > 0 ? "var(--color-error)" : "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{teamAttendance.notCheckedIn}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Not checked in</div>
        </div>
        <div style={{ width: 1, background: "rgba(14,14,15,0.1)", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: timesheetHealth.pendingApprovals > 0 ? "var(--color-primary)" : "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{timesheetHealth.pendingApprovals}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pending approvals</div>
        </div>
      </div>

      {/* Two-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48 }}>
        <div>
          <SectionHeader label="THIS WEEK'S MISMATCHES" />
          <ActivityList rows={mismatchRows} />
        </div>
        <div>
          <SectionHeader label="PROJECT CONTRIBUTIONS" />
          {contributions.length === 0 ? (
            <div style={{ padding: "32px 0", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No data available</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {contributions.map((r) => (
                <div key={r.project}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{r.project}</span>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>{fmtMinutes(r.minutes)}</span>
                  </div>
                  <div className="progress-bar" style={{ "--kpi-accent": "var(--color-primary)" } as React.CSSProperties}>
                    <div className="progress-bar__fill" style={{ width: `${Math.round((r.minutes / maxContribMinutes) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
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

  const underOverRows: ActivityRowData[] = underOver.map((r) => ({
    name: r.username,
    sub: fmtMinutes(r.minutes),
    status: r.status,
    value: fmtMinutes(r.minutes),
  }));

  const deptRows: ActivityRowData[] = effortByDepartment.map((r) => ({
    name: r.department,
    sub: "last 30 days",
    status: "submitted",
    value: fmtMinutes(r.minutes),
  }));

  const complianceList = compliance as Array<{ workDate?: string; date?: string; isCompliant?: boolean; compliant?: boolean }>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Page header */}
      <div style={{ borderBottom: "1px solid rgba(14,14,15,0.1)", paddingBottom: 32 }}>
        <Eyebrow label="MANAGEMENT VIEW" />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Good {getGreeting()},<br /><em style={{ fontStyle: "italic", color: "var(--color-primary)" }}>{username}</em>
          </h1>
          <div style={{ display: "flex", gap: 36, paddingLeft: 16, borderLeft: "1px solid rgba(14,14,15,0.1)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{effortByDepartment.length}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Departments</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: billablePct >= 70 ? "var(--color-success)" : billablePct >= 50 ? "var(--color-primary)" : "var(--color-error)", letterSpacing: "-0.02em", lineHeight: 1 }}>{billablePct}%</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Billable</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{consultantVsInternal.internal + consultantVsInternal.consultant}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Staff</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 48, paddingBottom: 28, borderBottom: "1px solid rgba(14,14,15,0.1)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--color-success)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMinutes(billable.billableMinutes)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Billable (30d)</div>
        </div>
        <div style={{ width: 1, background: "rgba(14,14,15,0.1)", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{fmtMinutes(billable.nonBillableMinutes)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Non-billable (30d)</div>
        </div>
        <div style={{ width: 1, background: "rgba(14,14,15,0.1)", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{consultantVsInternal.internal}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Internal staff</div>
        </div>
        <div style={{ width: 1, background: "rgba(14,14,15,0.1)", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{consultantVsInternal.consultant}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Consultants</div>
        </div>
      </div>

      {/* Department effort — full width */}
      {effortByDepartment.length > 0 && (
        <div>
          <SectionHeader label="DEPARTMENT EFFORT (30D)" />
          <ActivityList rows={deptRows} />
        </div>
      )}

      {/* Two-column: under/over + compliance */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48 }}>
        <div>
          <SectionHeader label="UNDER / OVER UTILIZED" />
          <ActivityList rows={underOverRows} />
        </div>
        <div>
          <SectionHeader label="COMPLIANCE TREND" />
          {complianceList.length === 0 ? (
            <div style={{ padding: "32px 0", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No data available</div>
          ) : (
            <div style={{ borderTop: "1px solid rgba(14,14,15,0.1)" }}>
              {complianceList.slice(0, 10).map((r, i) => {
                const date = r.workDate ?? r.date ?? String(i);
                const ok = r.isCompliant ?? r.compliant ?? false;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(14,14,15,0.1)" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{date}</span>
                    <span style={{ fontSize: "1rem", color: ok ? "var(--color-success)" : "var(--color-error)" }}>{ok ? "✓" : "✗"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Project effort */}
      {effortByProject.length > 0 && (
        <div>
          <SectionHeader label="EFFORT BY PROJECT (30D)" />
          <ActivityList rows={effortByProject.map((r) => ({ name: r.project, sub: "last 30 days", status: "approved", value: fmtMinutes(r.minutes) }))} />
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function Dashboard({ role, username }: DashboardProps) {
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
      {loading && <DashboardSkeleton />}

      {!loading && !data && (
        <div className="empty-state">
          <div className="empty-state__icon"><AlertSvg size={48} /></div>
          <p className="empty-state__title">Failed to load dashboard</p>
          <p className="empty-state__sub">Could not fetch your data. Please refresh the page.</p>
        </div>
      )}

      {!loading && data && role === "employee" && <EmployeeDashboard data={data as EmployeeData} username={username} />}
      {!loading && data && role === "manager" && <ManagerDashboard data={data as ManagerData} username={username} />}
      {!loading && data && role === "admin" && <AdminDashboard data={data as AdminData} username={username} />}
    </section>
  );
}

// ── Inline SVG icons ───────────────────────────────────────────────────────────
function AlertSvg({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
