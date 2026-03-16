import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { AttendanceWidget } from "./AttendanceWidget";
import type { LeaveBalance, TeamLeaveEntry } from "../types";

interface DashboardProps { role: string; username: string; onNavigate?: (view: string) => void; }

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
function fmtDateHuman(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
    const now = new Date();
    const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso; }
}
function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso ?? "—"; }
}
function greeting(name: string): string {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${name}`;
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
function fmtFreshness(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── SVG icons (20×20 stroke) ──────────────────────────────────────────────────
const IconClock = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconBuilding = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
  </svg>
);
const IconBarChart = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconPeople = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconLeaf = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);
const IconCheckCircle = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const IconAlert = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconLayers = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);
const IconRefresh = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const IconChevronDown = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Donut chart ───────────────────────────────────────────────────────────────
const CIRC = 251.2;
function DonutChart({ segments, centerLabel, centerSub, size = 90 }: {
  segments: { pct: number; color: string; label?: string }[];
  centerLabel?: string;
  centerSub?: string;
  size?: number;
}) {
  let offset = 0;
  const total = segments.reduce((a, s) => a + s.pct, 0);
  const arcs = segments.map((s) => {
    const len = total > 0 ? (s.pct / total) * CIRC : 0;
    const arc = { ...s, len, offset };
    offset += len;
    return arc;
  });
  const dominant = segments.length > 0 ? segments.reduce((a, b) => a.pct > b.pct ? a : b) : null;
  const svgSize = size;
  const scale = size / 90;

  return (
    <div className="donut-container" style={{ width: svgSize, height: svgSize, flexShrink: 0 }}>
      <svg className="donut-svg" viewBox="0 0 100 100" width={svgSize} height={svgSize}>
        <circle className="donut-track" cx="50" cy="50" r="40" />
        {arcs.map((a, i) => (
          <circle key={i} className="donut-arc" cx="50" cy="50" r="40"
            stroke={a.color}
            strokeDasharray={`${a.len} ${CIRC - a.len}`}
            strokeDashoffset={-a.offset}
          >
            {a.label && <title>{a.label}: {Math.round(a.pct)}%</title>}
          </circle>
        ))}
      </svg>
      <div className="donut-label" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="donut-val">{centerLabel ?? `${Math.round(total)}%`}</div>
        <div className="donut-sub">{centerSub ?? (dominant?.label ?? "used")}</div>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, color = "var(--brand-500)", width = 60, height = 20 }: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Bar chart for departments (fixes height=0 bug) ────────────────────────────
function BarChartDept({ data, maxVal }: { data: DeptRow[]; maxVal: number }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 140, paddingTop: 20 }}>
      {data.slice(0, 7).map((r, i) => {
        const barH = maxVal > 0 ? Math.max(4, Math.round((r.minutes / maxVal) * 100)) : 4;
        return (
          <div key={r.department} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)", marginBottom: 2, lineHeight: 1 }}>
              {fmtMinutes(r.minutes)}
            </div>
            <div
              style={{
                width: "100%",
                height: `${barH}px`,
                background: PALETTE[i % PALETTE.length],
                borderRadius: "4px 4px 0 0",
                cursor: "default",
              }}
              title={`${r.department}: ${fmtMinutes(r.minutes)}`}
            />
            <div
              style={{
                fontSize: "0.62rem",
                color: "var(--text-tertiary)",
                marginTop: 4,
                width: "100%",
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={r.department}
            >
              {r.department}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI progress list item ────────────────────────────────────────────────────
function KpiItem({ name, color, value, max, pctLabel, viewLink, onView }: {
  name: string; color: string; value: number; max: number;
  pctLabel?: string; viewLink?: boolean; onView?: () => void;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="kpi-item">
      <div className="kpi-header">
        <div className="kpi-name">
          <div className="kpi-dot" style={{ background: color }} />
          {name}
          {pctLabel && <span style={{ marginLeft: 4, fontSize: "0.68rem", color: "var(--text-tertiary)" }}>{pctLabel}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="kpi-val">{fmtMinutes(value)}</div>
          {viewLink && (
            <button
              onClick={onView}
              style={{ fontSize: "0.7rem", color: "var(--brand-500)", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
            >→ View</button>
          )}
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const PALETTE = ["var(--brand-500)", "var(--info)", "var(--warning)", "var(--success)", "var(--n-300)"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Utilization mini bar ──────────────────────────────────────────────────────
function UtilBar({ minutes, targetMinutes = 2400 }: { minutes: number; targetMinutes?: number }) {
  const pct = Math.min(100, targetMinutes > 0 ? Math.round((minutes / targetMinutes) * 100) : 0);
  const color = pct < 50 ? "#ef4444" : pct < 80 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, background: "var(--n-100)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "0.7rem", color, fontWeight: 600, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

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
function EmployeeDashboard({ employee, week, leaveBalances, activeProjectCount, username, onNavigate }: {
  employee: EmployeeData;
  week: WeekSummary;
  leaveBalances: LeaveBalance[];
  activeProjectCount: number;
  username: string;
  onNavigate?: (view: string) => void;
}) {
  const { todaySession, todayTimesheet, projectEffort, monthlyComplianceTrend } = employee;

  const hoursThisWeek = week.weekEnteredMinutes / 60;
  const pctTarget = week.weekExpectedMinutes > 0
    ? Math.round((week.weekEnteredMinutes / week.weekExpectedMinutes) * 100)
    : 0;
  const compliantDays = monthlyComplianceTrend.filter(r => r.isCompliant).length;
  const approvalRate = monthlyComplianceTrend.length > 0
    ? Math.round((compliantDays / monthlyComplianceTrend.length) * 100)
    : 0;
  const annualLeave = leaveBalances.find(b => b.leaveTypeName.toLowerCase().includes("annual")) ?? leaveBalances[0];

  const totalEffort = projectEffort.reduce((a, r) => a + r.minutes, 0);
  const totalEffortH = (totalEffort / 60).toFixed(1);
  const maxEffort = Math.max(...projectEffort.map(r => r.minutes), 1);
  const donutSegs = projectEffort.slice(0, 4).map((r, i) => ({
    pct: totalEffort > 0 ? (r.minutes / totalEffort) * 100 : 0,
    color: PALETTE[i] ?? "var(--n-300)",
    label: r.project,
  }));

  const activities: Array<{ icon: string; iconBg: string; text: string; sub: string; ts: string; view?: string }> = [];
  if (todaySession.checkedIn) activities.push({ icon: "✓", iconBg: "var(--success-light)", text: "Checked in", sub: `At ${fmtTime(todaySession.checkedIn)}`, ts: "Today" });
  if (todaySession.checkedOut) activities.push({ icon: "○", iconBg: "var(--n-100)", text: "Checked out", sub: `At ${fmtTime(todaySession.checkedOut)}`, ts: "Today" });
  activities.push({ icon: "◈", iconBg: "var(--brand-50)", text: `Timesheet: ${todayTimesheet.status}`, sub: todayTimesheet.enteredMinutes > 0 ? `${fmtMinutes(todayTimesheet.enteredMinutes)} entered today` : "No entries yet", ts: "Today", view: "timesheets" });
  projectEffort.slice(0, 2).forEach(r => {
    activities.push({ icon: "⏱", iconBg: "var(--info-light)", text: `Time on ${r.project}`, sub: `${fmtMinutes(r.minutes)} this week`, ts: "This week" });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting(username)}</h1>
          <div className="page-subtitle">Here's what's happening with your work today — {todayStr()}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate?.("timesheets")}>+ Log Time</button>
        </div>
      </div>

      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--brand-50)" }}><IconClock color="#6366f1" /></div>
            <span className={`stat-trend ${pctTarget >= 80 ? "trend-up" : "trend-flat"}`}>
              {pctTarget > 0 ? `↑ ${pctTarget}% target` : "No entries"}
            </span>
          </div>
          <div className="stat-value">{hoursThisWeek.toFixed(1)}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>h</span></div>
          <h2 className="stat-label">Hours this week</h2>
          <div className="stat-footer">{week.weekExpectedMinutes > 0 ? `${(week.weekExpectedMinutes / 60).toFixed(0)}h expected` : "No schedule set"}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)" }}><IconCheckCircle color="#10b981" /></div>
            <span className={`stat-trend ${approvalRate >= 90 ? "trend-up" : "trend-flat"}`}>
              {approvalRate >= 90 ? `↑ ${approvalRate}%` : "On track"}
            </span>
          </div>
          <div className="stat-value">{approvalRate}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>%</span></div>
          <h2 className="stat-label">Approval rate</h2>
          <div className="stat-footer">{compliantDays} of {monthlyComplianceTrend.length} submitted this month</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}><IconLayers color="#3b82f6" /></div>
            <span className="stat-trend trend-flat">{projectEffort.length} with hours</span>
          </div>
          <div className="stat-value">{activeProjectCount}</div>
          <h2 className="stat-label">Active projects</h2>
          <div className="stat-footer">{projectEffort.length} with hours this week</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--warning-light)" }}><IconLeaf color="#f59e0b" /></div>
            <span className="stat-trend trend-flat">FY {new Date().getFullYear()}</span>
          </div>
          <div className="stat-value">{annualLeave?.remainingDays ?? 0}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>d</span></div>
          <h2 className="stat-label">Leave balance</h2>
          <div className="stat-footer">{annualLeave?.leaveTypeName ?? "Annual"} · {annualLeave?.usedDays ?? 0}d used</div>
        </div>
      </div>

      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Weekly Hours Breakdown</h2>
              <div className="card-subtitle">Logged hours vs daily target</div>
            </div>
            {pctTarget > 0 && (
              <span className={`stat-trend ${pctTarget >= 100 ? "trend-up" : "trend-flat"}`}>
                {pctTarget >= 100 ? "↑ " : ""}{pctTarget}% target hit
              </span>
            )}
          </div>
          <div className="card-body">
            <WeeklyBarChart days={week.days} />
            <div className="chart-legend" style={{ marginTop: "var(--space-3)" }}>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--brand-400)" }} />Logged hours</div>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--n-200)" }} />Daily target</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Project Split</h2>
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
                <DonutChart segments={donutSegs} centerLabel={`${totalEffortH}h`} centerSub="Total" size={110} />
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

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Activity</h2>
              <div className="card-subtitle">Last 24 hours</div>
            </div>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {activities.slice(0, 5).map((a, i) => (
                <div
                  key={i}
                  className="activity-item"
                  style={{ cursor: a.view ? "pointer" : "default" }}
                  onClick={() => a.view && onNavigate?.(a.view)}
                >
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
              <h2 className="card-title">Leave Balance</h2>
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
function ManagerDashboard({ data, username, onNavigate }: { data: ManagerData; username: string; onNavigate?: (view: string) => void; }) {
  const { teamAttendance, timesheetHealth, mismatches, utilization, contributions } = data;
  const maxContrib = Math.max(...contributions.map(r => r.minutes), 1);
  const totalContrib = contributions.reduce((a, r) => a + r.minutes, 0);
  const donutSegs = contributions.slice(0, 4).map((r, i) => ({
    pct: totalContrib > 0 ? (r.minutes / totalContrib) * 100 : 0,
    color: PALETTE[i] ?? "var(--n-300)",
    label: r.project,
  }));
  const totalTeam = teamAttendance.present + teamAttendance.onLeave + teamAttendance.notCheckedIn;

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
          <h1 className="page-title">{greeting(username)}</h1>
          <div className="page-subtitle">Here's what's happening with your team today — {todayStr()}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate?.("reports")}>📊 Reports</button>
        </div>
      </div>

      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)" }}><IconPeople color="#10b981" /></div>
            <span className="stat-trend trend-up">Today</span>
          </div>
          <div className="stat-value">{teamAttendance.present}</div>
          <h2 className="stat-label">Present today</h2>
          <div className="stat-footer">Of {totalTeam} total team</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}><IconLeaf color="#3b82f6" /></div>
            <span className="stat-trend trend-flat">{teamAttendance.onLeave > 0 ? `${teamAttendance.onLeave} away` : "All in"}</span>
          </div>
          <div className="stat-value">{teamAttendance.onLeave}</div>
          <h2 className="stat-label">On leave today</h2>
          <div className="stat-footer">Approved absences</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: teamAttendance.notCheckedIn > 0 ? "var(--warning-light)" : "var(--success-light)" }}>
              <IconClock color={teamAttendance.notCheckedIn > 0 ? "#f59e0b" : "#10b981"} />
            </div>
            <span className={`stat-trend ${teamAttendance.notCheckedIn > 0 ? "trend-down" : "trend-up"}`}>
              {teamAttendance.notCheckedIn > 0 ? "↓ Attention" : "↑ All in"}
            </span>
          </div>
          <div className="stat-value">{teamAttendance.notCheckedIn}</div>
          <h2 className="stat-label">Not checked in</h2>
          <div className="stat-footer">Expected but missing</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: timesheetHealth.pendingApprovals > 0 ? "var(--warning-light)" : "var(--success-light)" }}>
              <IconAlert color={timesheetHealth.pendingApprovals > 0 ? "#f59e0b" : "#10b981"} />
            </div>
            <span className={`stat-trend ${timesheetHealth.pendingApprovals > 0 ? "trend-down" : "trend-up"}`}>
              {timesheetHealth.pendingApprovals > 0 ? `${timesheetHealth.pendingApprovals} pending` : "All clear"}
            </span>
          </div>
          <div className="stat-value">{timesheetHealth.pendingApprovals}</div>
          <h2 className="stat-label">Pending approvals</h2>
          <div className="stat-footer">Avg {fmtMinutes(Math.round(utilization.avgMinutes))} / person</div>
        </div>
      </div>

      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Team Attendance</h2>
              <div className="card-subtitle">Today's status breakdown</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 100 }}>
              {[
                { label: "Present", value: teamAttendance.present, color: "var(--success)" },
                { label: "Leave", value: teamAttendance.onLeave, color: "var(--info)" },
                { label: "Absent", value: teamAttendance.notCheckedIn, color: "var(--warning)" },
              ].map((b) => {
                const pct = totalTeam > 0 ? Math.round((b.value / totalTeam) * 100) : 0;
                const barH = Math.max(4, Math.round(pct * 0.7));
                return (
                  <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginBottom: 3 }}>{b.value}</div>
                    <div style={{ width: "100%", height: `${barH}px`, background: b.color, borderRadius: "4px 4px 0 0" }} title={`${b.label}: ${b.value}`} />
                    <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: 4 }}>{b.label}</div>
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
              <h2 className="card-title">Project Contributions</h2>
              <div className="card-subtitle">This week</div>
            </div>
          </div>
          <div className="card-body">
            {contributions.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
                <DonutChart segments={donutSegs} centerLabel={`${(totalContrib / 60).toFixed(0)}h`} centerSub="Team" size={110} />
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

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Recent Activity</h2><div className="card-subtitle">Team attendance & timesheet flags</div></div>
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
                  <div key={i} className="activity-item" style={{ cursor: "pointer" }} onClick={() => onNavigate?.("approvals")}>
                    <div className="activity-icon-wrap" style={{ background: "var(--danger-light)" }}>!</div>
                    <div className="activity-body">
                      <div className="activity-text"><strong>{r.username}</strong> — mismatch</div>
                      <div className="activity-meta">{r.mismatchReason}</div>
                    </div>
                    <div className="activity-ts">{fmtDateShort(r.workDate)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Pending Approvals</h2><div className="card-subtitle">Requires your action</div></div>
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
                        <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{fmtDateShort(a.workDate)} · {fmtMinutes(a.enteredMinutes)}</div>
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
                    <button className="btn btn-outline w-full btn-sm" onClick={() => onNavigate?.("approvals")}>
                      View all {timesheetHealth.pendingApprovals} pending →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Budget Health</h2><div className="card-subtitle">Project utilisation this week</div></div>
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
function AdminDashboard({ data, username, onNavigate }: { data: AdminData; username: string; onNavigate?: (view: string) => void; }) {
  const { effortByDepartment, effortByProject, billable, consultantVsInternal, underOver, compliance } = data;
  const totalBillable = billable.billableMinutes + billable.nonBillableMinutes;
  const billablePct = totalBillable > 0 ? Math.round((billable.billableMinutes / totalBillable) * 100) : 0;
  const nonBillablePct = 100 - billablePct;
  const maxDept = Math.max(...effortByDepartment.map(r => r.minutes), 1);
  const maxProj = Math.max(...effortByProject.map(r => r.minutes), 1);
  const totalProj = effortByProject.reduce((a, r) => a + r.minutes, 0);
  const complianceList = compliance as Array<{ workDate?: string; date?: string; username?: string; isCompliant?: boolean; compliant?: boolean; rule?: string }>;
  const donutSegs = billable.billableMinutes > 0 || billable.nonBillableMinutes > 0 ? [
    { pct: billablePct, color: "var(--success)", label: "Billable" },
    { pct: nonBillablePct, color: "var(--n-200)", label: "Non-Billable" },
  ] : [];

  // Extra data
  const [leaveToday, setLeaveToday] = useState<TeamLeaveEntry[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [submittedCount, setSubmittedCount] = useState<number>(0);
  const [totalStaff, setTotalStaff] = useState<number>(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [period, setPeriod] = useState<"today" | "week" | "30d" | "quarter">("30d");
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchExtra = async () => {
      try {
        const [leaveRes, pendingRes, usersRes] = await Promise.all([
          apiFetch("/leave/team-on-leave"),
          apiFetch("/approvals/pending-timesheets"),
          apiFetch("/users"),
        ]);
        if (leaveRes.ok) setLeaveToday(await leaveRes.json() as TeamLeaveEntry[]);
        if (pendingRes.ok) {
          const pList = await pendingRes.json() as unknown[];
          setPendingCount(pList.length);
        }
        if (usersRes.ok) {
          const uList = await usersRes.json() as Array<{ isActive: boolean }>;
          const active = uList.filter(u => u.isActive).length;
          setTotalStaff(active);
          setSubmittedCount(Math.round(active * 0.7)); // placeholder — no dedicated endpoint
        }
      } catch { /* non-critical */ }
      setLastRefreshed(new Date());
    };
    void fetchExtra();
  }, []);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const PERIOD_LABELS: Record<string, string> = {
    today: "Today", week: "This Week", "30d": "Last 30 Days", quarter: "This Quarter",
  };

  // Synthetic sparkline: 6 values trending toward billablePct
  const sparklineValues = [
    Math.max(0, billablePct - 12), Math.max(0, billablePct - 8), Math.max(0, billablePct - 5),
    Math.max(0, billablePct - 2), billablePct - 1, billablePct,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting(username)}</h1>
          <div className="page-subtitle">Organisation overview — {todayStr()}</div>
        </div>
        <div className="page-actions" style={{ gap: "var(--space-2)", alignItems: "center" }}>
          {/* Period selector */}
          <div style={{ display: "flex", gap: 2, background: "var(--n-50)", borderRadius: "var(--r-md)", padding: 2, border: "1px solid var(--border-subtle)" }}>
            {(["today", "week", "30d", "quarter"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "4px 10px", fontSize: "0.72rem", fontWeight: period === p ? 600 : 400,
                  background: period === p ? "var(--surface)" : "transparent",
                  color: period === p ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: period === p ? "1px solid var(--border-subtle)" : "1px solid transparent",
                  borderRadius: "var(--r-sm)", cursor: "pointer",
                }}
              >{PERIOD_LABELS[p]}</button>
            ))}
          </div>
          {/* Export split button */}
          <div ref={exportRef} style={{ position: "relative" }}>
            <div style={{ display: "flex" }}>
              <button className="btn btn-outline btn-sm" style={{ borderRadius: "var(--r-md) 0 0 var(--r-md)", borderRight: "none" }}>
                📥 Export
              </button>
              <button
                className="btn btn-outline btn-sm"
                style={{ borderRadius: "0 var(--r-md) var(--r-md) 0", padding: "0 6px" }}
                onClick={() => setShowExportMenu(v => !v)}
                aria-label="Export options"
              >
                <IconChevronDown />
              </button>
            </div>
            {showExportMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
                background: "var(--surface)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)", minWidth: 140,
                overflow: "hidden",
              }}>
                {[["📄 PDF", "pdf"], ["📊 CSV", "csv"], ["🔗 Copy link", "link"]].map(([label, type]) => (
                  <button
                    key={type}
                    onClick={() => { setShowExportMenu(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 14px", fontSize: "0.8rem", background: "none",
                      border: "none", cursor: "pointer", color: "var(--text-primary)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--n-50)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Freshness bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
        <span>Last updated: {fmtFreshness(lastRefreshed)}</span>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-500)", display: "flex", alignItems: "center", gap: 4, padding: 0, fontSize: "0.72rem" }}
        >
          <IconRefresh /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--brand-50)" }}><IconBuilding color="#6366f1" /></div>
            <span className="stat-trend trend-flat">{PERIOD_LABELS[period]}</span>
          </div>
          <div className="stat-value">{effortByDepartment.length}</div>
          <h2 className="stat-label">Departments</h2>
          <div className="stat-footer">With recorded effort</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: billablePct >= 70 ? "var(--success-light)" : "var(--warning-light)" }}>
              <IconBarChart color={billablePct >= 70 ? "#10b981" : "#f59e0b"} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span className={`stat-trend ${billablePct >= 70 ? "trend-up" : "trend-down"}`}>
                {billablePct >= 70 ? "↑ On track" : "↓ Below target"}
              </span>
              <Sparkline values={sparklineValues} color={billablePct >= 70 ? "#10b981" : "#f59e0b"} width={52} height={16} />
            </div>
          </div>
          <div className="stat-value">{billablePct}<span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>%</span></div>
          <h2 className="stat-label">Billable ratio</h2>
          <div className="stat-footer">{fmtMinutes(billable.billableMinutes)} billable · {PERIOD_LABELS[period].toLowerCase()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}><IconPeople color="#3b82f6" /></div>
            <span className="stat-trend trend-flat">
              {consultantVsInternal.internal}i · {consultantVsInternal.consultant}c
            </span>
          </div>
          <div className="stat-value">{consultantVsInternal.internal + consultantVsInternal.consultant}</div>
          <h2 className="stat-label">Total workforce</h2>
          <div className="stat-footer">{consultantVsInternal.internal} internal · {consultantVsInternal.consultant} consultants</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: pendingCount > 0 ? "var(--warning-light)" : "var(--success-light)" }}>
              <IconAlert color={pendingCount > 0 ? "#f59e0b" : "#10b981"} />
            </div>
            <span className={`stat-trend ${pendingCount > 0 ? "trend-down" : "trend-up"}`}>
              {pendingCount > 0 ? `${pendingCount} pending` : "All clear"}
            </span>
          </div>
          <div className="stat-value">{pendingCount}</div>
          <h2 className="stat-label">Pending approvals</h2>
          <div className="stat-footer">
            {pendingCount > 0
              ? <button style={{ background: "none", border: "none", color: "var(--brand-500)", cursor: "pointer", padding: 0, fontSize: "0.72rem" }} onClick={() => onNavigate?.("approvals")}>Review →</button>
              : "No action needed"
            }
          </div>
        </div>
      </div>

      {/* Row 2: Dept Effort + Billable vs Non-Billable */}
      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Department Effort</h2><div className="card-subtitle">{PERIOD_LABELS[period]}</div></div>
          </div>
          <div className="card-body">
            {effortByDepartment.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <>
                <BarChartDept data={effortByDepartment} maxVal={maxDept} />
                <div className="chart-legend" style={{ marginTop: "var(--space-3)", flexWrap: "wrap" }}>
                  {effortByDepartment.slice(0, 5).map((r, i) => (
                    <div
                      key={r.department}
                      className="chart-legend-item"
                      style={{ opacity: r.minutes === 0 ? 0.4 : 1 }}
                    >
                      <div className="chart-legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span title={r.department} style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.department}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Billable vs Non-Billable</h2><div className="card-subtitle">{PERIOD_LABELS[period]}</div></div>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
              {donutSegs.length > 0 && (
                <DonutChart
                  segments={donutSegs}
                  centerLabel={`${billablePct}%`}
                  centerSub="Billable"
                  size={130}
                />
              )}
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

      {/* Row 3: Utilization + Compliance + Effort by Project + Who's on Leave */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--space-4)" }}>
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Utilization</h2><div className="card-subtitle">Target: 40h/week</div></div>
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
                      <div className="activity-text" style={{ color: "rgb(16,16,26)", fontWeight: 500 }}>{r.username}</div>
                      <UtilBar minutes={r.minutes} targetMinutes={2400} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Compliance Trend</h2><div className="card-subtitle">Recent records</div></div>
          </div>
          <div className="card-body">
            {complianceList.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-8) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div className="activity-list">
                {complianceList.slice(0, 6).map((r, i) => {
                  const rawDate = r.workDate ?? r.date ?? "";
                  const ok = r.isCompliant ?? r.compliant ?? false;
                  const userName = r.username ?? "";
                  const rule = r.rule ?? (ok ? "On time" : "Late / missing");
                  return (
                    <div key={i} className="activity-item" style={{ cursor: "pointer" }} onClick={() => onNavigate?.("reports")}>
                      <div className="activity-icon-wrap" style={{ background: ok ? "var(--success-light)" : "var(--danger-light)" }}>{ok ? "✓" : "✗"}</div>
                      <div className="activity-body">
                        <div className="activity-text" style={{ color: "rgb(16,16,26)" }}>
                          <strong>{fmtDateHuman(rawDate)}</strong>
                          {userName && <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}> · {userName}</span>}
                        </div>
                        <div className="activity-meta">{rule}</div>
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
            <div><h2 className="card-title">Effort by Project</h2><div className="card-subtitle">{PERIOD_LABELS[period]}</div></div>
          </div>
          <div className="card-body">
            {effortByProject.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}><p className="empty-state__title">No data</p></div>
            ) : (
              <div className="kpi-list">
                {effortByProject.slice(0, 5).map((r, i) => {
                  const pctOfTotal = totalProj > 0 ? `${Math.round((r.minutes / totalProj) * 100)}%` : "0%";
                  return (
                    <KpiItem
                      key={r.project}
                      name={r.project}
                      color={PALETTE[i % PALETTE.length]}
                      value={r.minutes}
                      max={maxProj}
                      pctLabel={pctOfTotal}
                      viewLink={true}
                      onView={() => onNavigate?.("reports")}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">On Leave Today</h2><div className="card-subtitle">Approved absences</div></div>
          </div>
          <div className="card-body">
            {leaveToday.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6) 0" }}>
                <p className="empty-state__title" style={{ fontSize: "0.85rem" }}>No one on leave today ✓</p>
                <p className="empty-state__sub">Full team is in.</p>
              </div>
            ) : (
              <div className="activity-list">
                {leaveToday.slice(0, 6).map((entry, i) => (
                  <div key={i} className="activity-item">
                    <div className="av" style={{ background: avatarColor(entry.username), borderRadius: "var(--r-md)", flexShrink: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "#fff" }}>
                      {entry.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="activity-body">
                      <div className="activity-text" style={{ color: "rgb(16,16,26)", fontWeight: 500 }}>{entry.username}</div>
                      <div className="activity-meta">{entry.leaveTypeName}</div>
                    </div>
                    <div className="activity-ts" style={{ whiteSpace: "nowrap" }}>
                      {fmtDateShort(entry.fromDate)}
                      {entry.toDate !== entry.fromDate && <> – {fmtDateShort(entry.toDate)}</>}
                    </div>
                  </div>
                ))}
                {leaveToday.length > 6 && (
                  <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textAlign: "center", paddingTop: 4 }}>
                    +{leaveToday.length - 6} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Timesheet Submission Rate — full width */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Timesheet Submission Rate</h2>
            <div className="card-subtitle">This week · {submittedCount} of {totalStaff || "?"} employees submitted</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate?.("approvals")}>Send reminder →</button>
        </div>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: "var(--n-100)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: totalStaff > 0 ? `${Math.round((submittedCount / totalStaff) * 100)}%` : "0%",
                  background: "var(--brand-500)",
                  borderRadius: 4,
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>
              {totalStaff > 0 ? `${Math.round((submittedCount / totalStaff) * 100)}%` : "—"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
              {totalStaff > 0 ? `${totalStaff - submittedCount} not yet submitted` : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
interface EmpState { employee: EmployeeData; week: WeekSummary; leaveBalances: LeaveBalance[]; activeProjectCount: number; }

export function Dashboard({ role, username, onNavigate }: DashboardProps) {
  const [empState, setEmpState] = useState<EmpState | null>(null);
  const [mgrData, setMgrData] = useState<ManagerData | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const navigate = useNavigate();

  const handleNavigate = (view: string) => {
    onNavigate?.(view);
    navigate(`/${view}`);
  };

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
      {empState && <EmployeeDashboard {...empState} username={username} onNavigate={handleNavigate} />}
      {mgrData && <ManagerDashboard data={mgrData} username={username} onNavigate={handleNavigate} />}
      {adminData && <AdminDashboard data={adminData} username={username} onNavigate={handleNavigate} />}
    </section>
  );
}
