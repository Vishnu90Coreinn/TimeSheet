import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { AttendanceWidget } from "./AttendanceWidget";
import { useConfirm } from "../hooks/useConfirm";
import { SkeletonPage } from "./Skeleton";
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
interface AnomalyNotification { id: string; title: string; message: string; severity: "warning" | "critical"; createdAtUtc: string; }
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
/** H1 — Strip domain suffixes and capitalize for a friendly display name */
function formatDisplayName(username: string): string {
  // Remove common domain-style suffixes: .rs, .com, .local, etc.
  const clean = username.replace(/\.[a-z]{1,6}$/i, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
function greeting(name: string): string {
  const h = new Date().getHours();
  const displayName = formatDisplayName(name);
  return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${displayName}`;
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
function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Updated ${diffHr}h ago`;
  return `Updated ${date.toLocaleDateString()}`;
}

function anomalyRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
const IconDownload = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Bar chart for departments (fixes height=0 bug) ────────────────────────────
function BarChartDept({ data, maxVal }: { data: DeptRow[]; maxVal: number }) {
  return (
    <div className="dash-bar-chart-dept">
      {data.slice(0, 7).map((r, i) => {
        const barH = maxVal > 0 ? Math.max(4, Math.round((r.minutes / maxVal) * 100)) : 4;
        return (
          <div key={r.department} className="dash-bar-col">
            <div className="dash-bar-val">
              {fmtMinutes(r.minutes)}
            </div>
            <div
              className="dash-bar-seg"
              style={{
                height: `${barH}px`,
                background: PALETTE[i % PALETTE.length],
              }}
              title={`${r.department}: ${fmtMinutes(r.minutes)}`}
            />
            <div className="dash-bar-label" title={r.department}>
              {r.department}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Compliance 4-week heatmap ─────────────────────────────────────────────────
type ComplianceItem = { workDate?: string; date?: string; username?: string; isCompliant?: boolean; compliant?: boolean; rule?: string };
function ComplianceHeatmap({ data, onViewReport }: { data: ComplianceItem[]; onViewReport?: () => void }) {
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return d.toISOString().slice(0, 10);
  });
  const byDate: Record<string, boolean> = {};
  data.forEach(r => {
    const d = (r.workDate ?? r.date ?? "").slice(0, 10);
    if (d) byDate[d] = r.isCompliant ?? r.compliant ?? false;
  });
  const knownDays = days.filter(d => d in byDate);
  const compliantCount = knownDays.filter(d => byDate[d]).length;
  const ratio = compliantCount / (knownDays.length || 1);
  const statusClass = ratio >= 0.8 ? "trend-up" : ratio >= 0.5 ? "trend-flat" : "trend-down";
  const statusLabel = ratio >= 0.8 ? "Good" : ratio >= 0.5 ? "Fair" : "Poor";
  const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <span className="text-[0.82rem] font-semibold text-[var(--text-primary)]">
          {compliantCount}/{knownDays.length} days compliant
        </span>
        <span className={`stat-trend ${statusClass}`}>{statusLabel}</span>
      </div>
      {/* Column headers */}
      <div className="compliance-day-labels mb-[4px]">
        {DAY_NAMES.map((n, i) => <div key={i} className="compliance-day-label">{n}</div>)}
      </div>
      <div className="compliance-heatmap-grid">
        {days.map(d => {
          const val = byDate[d];
          const bg = d in byDate ? (val ? "var(--success)" : "var(--danger)") : "var(--n-150)";
          const opacity = d in byDate ? 1 : 0.4;
          const cellLabel = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const cellStatus = !(d in byDate) ? "No data" : val ? "Compliant" : "Non-compliant";
          const ariaLabel = `${cellLabel}: ${cellStatus}`;
          return (
            <div
              key={d}
              className="compliance-heatmap-cell"
              style={{ background: bg, opacity }}
              title={ariaLabel}
              aria-label={ariaLabel}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-[12px] mt-[8px] items-center flex-wrap">
        {[
          { color: "var(--success)", label: "Compliant" },
          { color: "var(--danger)", label: "Non-compliant" },
          { color: "var(--n-150)", label: "No data", opacity: 0.4 },
        ].map(({ color, label, opacity }) => (
          <div key={label} className="flex items-center gap-[4px] text-[0.7rem] text-[var(--text-tertiary)]">
            <div className="w-[10px] h-[10px] rounded-[2px]" style={{ background: color, opacity }} />
            {label}
          </div>
        ))}
      </div>
      {/* Footer CTA */}
      {onViewReport && (
        <div className="mt-[10px] border-t border-[var(--border-subtle)] pt-[8px]">
          <button onClick={onViewReport} className="card-footer-link">View compliance report →</button>
        </div>
      )}
    </div>
  );
}

// ── Horizontal bar chart for departments ─────────────────────────────────────
function HBarChartDept({ data }: { data: DeptRow[] }) {
  const max = Math.max(...data.map(r => r.minutes), 1);
  const avg = data.reduce((a, r) => a + r.minutes, 0) / Math.max(data.length, 1);
  const avgPct = (avg / max) * 100;
  return (
    <div className="flex flex-col gap-[8px]">
      {data.slice(0, 7).map((r, i) => {
        const pct = Math.max(2, (r.minutes / max) * 100);
        return (
          <div key={r.department} className="flex items-center gap-[8px]">
            <div className="dash-hbar-label" title={r.department}>
              {r.department}
            </div>
            <div className="relative flex-1 h-[18px] rounded-[var(--r-sm)] overflow-visible">
              <div className="absolute inset-0 bg-[var(--n-50)] rounded-[var(--r-sm)]" />
              <div
                className="absolute top-0 left-0 h-full rounded-[var(--r-sm)] [transition:width_0.5s_cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }}
              />
              <div
                className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-[var(--n-400)] opacity-70 pointer-events-none"
                style={{ left: `${avgPct}%` }}
                title={`Avg: ${fmtMinutes(Math.round(avg))}`}
              />
            </div>
            <div className="w-[36px] text-[0.7rem] text-[var(--text-tertiary)] text-right shrink-0">
              {fmtMinutes(r.minutes)}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-[4px] mt-[2px] text-[0.68rem] text-[var(--text-tertiary)] pl-[96px]">
        <div className="w-[12px] h-[1.5px] bg-[var(--n-400)] opacity-70" />
        Avg: {fmtMinutes(Math.round(avg))}
      </div>
    </div>
  );
}

// ── Single-department stat display ────────────────────────────────────────────
function SingleDeptStat({ dept }: { dept: DeptRow }) {
  return (
    <div className="flex flex-col items-center justify-center py-[var(--space-6)] gap-[var(--space-2)]">
      <div className="[font-family:var(--font-display)] text-[2.5rem] font-bold text-[var(--text-primary)] [letter-spacing:-0.04em] leading-none">
        {fmtMinutes(dept.minutes)}
      </div>
      <div className="text-[0.9rem] font-semibold text-[var(--text-secondary)] mt-[4px]">{dept.department}</div>
      <div className="text-[0.75rem] text-[var(--text-tertiary)]">Total effort this period</div>
    </div>
  );
}

// ── KPI progress list item ────────────────────────────────────────────────────
function KpiItem({ name, color, value, max, pctLabel, onView }: {
  name: string; color: string; value: number; max: number;
  pctLabel?: string; onView?: () => void;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className="kpi-item"
      onClick={onView}
      style={{ cursor: onView ? "pointer" : "default" }}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === "Enter" || e.key === " ") onView(); } : undefined}
    >
      <div className="kpi-header">
        <div className="kpi-name">
          <div className="kpi-dot" style={{ background: color }} />
          {name}
          {pctLabel && <span className="ml-[4px] text-[0.68rem] text-[var(--text-tertiary)]">{pctLabel}</span>}
        </div>
        <div className="kpi-val">{fmtMinutes(value)}</div>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name}: ${pct}%`}
      >
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const PALETTE = ["var(--brand-500)", "var(--info)", "var(--warning)", "var(--success)", "var(--n-300)"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Utilization mini bar ──────────────────────────────────────────────────────
function UtilBar({ minutes, status }: { minutes: number; status?: string }) {
  const barPct = Math.min(100, Math.round((minutes / 2400) * 100));
  const actualH = (minutes / 60).toFixed(1);
  let fillClass: string;
  let labelColor: string;
  let label: string;
  if (status === "overloaded") {
    fillClass = "progress-fill--critical"; labelColor = "var(--danger)"; label = "↓ Critical";
  } else if (status === "balanced") {
    fillClass = "progress-fill--success"; labelColor = "var(--success)"; label = "↑ On track";
  } else if (barPct < 10) {
    fillClass = "progress-fill--critical"; labelColor = "var(--danger)"; label = "↓ Critical";
  } else if (barPct < 60) {
    fillClass = "progress-fill--warning"; labelColor = "var(--warning)"; label = "↓ Below target";
  } else {
    fillClass = "progress-fill--caution"; labelColor = "#f97316"; label = "~ Near target";
  }
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex items-center gap-[6px]">
        <div
          className="progress-track flex-1 max-w-[60px] h-[4px]"
          role="progressbar"
          aria-valuenow={barPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Utilization: ${barPct}%`}
        >
          <div className={`progress-fill ${fillClass}`} style={{ width: `${barPct}%` }} />
        </div>
        <span className="text-[0.7rem] font-semibold min-w-[28px]" style={{ color: labelColor }}>{barPct}%</span>
        <span className="text-[0.68rem]" style={{ color: labelColor }}>{label}</span>
      </div>
      <div className="text-[0.65rem] text-[var(--text-tertiary)]">{actualH}h this week</div>
    </div>
  );
}

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function WeeklyBarChart({ days }: { days: WeekDayMeta[] }) {
  if (days.length === 0) {
    return (
      <div className="empty-state py-[var(--space-6)]">
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
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title w-[260px] h-[24px] mb-[8px]" />
          <div className="skeleton skeleton-text w-[200px]" />
        </div>
      </div>
      <div className="stat-grid-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card">
            <div className="stat-card-top">
              <div className="skeleton w-[36px] h-[36px] rounded-[var(--r-md)]" />
              <div className="skeleton skeleton-text w-[56px]" />
            </div>
            <div className="skeleton skeleton-title w-[80px] h-[28px] my-[16px]" />
            <div className="skeleton skeleton-text w-[110px]" />
          </div>
        ))}
      </div>
      <div className="dashboard-grid-2">
        {[1, 2].map(i => (
          <div key={i} className="card p-[var(--space-5)] min-h-[200px]">
            <div className="skeleton skeleton-title w-[140px] h-[16px] mb-[20px]" />
            <div className="skeleton w-full h-[120px] rounded-[var(--r-md)]" />
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
    <div className="flex flex-col gap-[var(--space-4)]">
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
          <div className="stat-value">{hoursThisWeek.toFixed(1)}<span className="text-[1rem] text-[var(--text-tertiary)]">h</span></div>
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
          <div className="stat-value">{approvalRate}<span className="text-[1rem] text-[var(--text-tertiary)]">%</span></div>
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
          <div className="stat-value">{annualLeave?.remainingDays ?? 0}<span className="text-[1rem] text-[var(--text-tertiary)]">d</span></div>
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
            <div className="chart-legend mt-[var(--space-3)]">
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
              <div className="empty-state py-[var(--space-8)]">
                <p className="empty-state__title">No entries yet</p>
                <p className="empty-state__sub">Log time to see your project split.</p>
              </div>
            ) : (
              <div className="flex items-center gap-[var(--space-5)]">
                <DonutChart segments={donutSegs} centerLabel={`${totalEffortH}h`} centerSub="Total" size={110} />
                <div className="kpi-list flex-1">
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

        <div className="flex flex-col">
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
              <div className="empty-state py-[var(--space-6)]">
                <p className="empty-state__title">No leave policy assigned</p>
              </div>
            ) : (
              <div className="kpi-list">
                {leaveBalances.map((lb, i) => {
                  const usedPct = lb.totalDays > 0 ? Math.round((lb.usedDays / lb.totalDays) * 100) : 0;
                  return (
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
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-valuenow={usedPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${lb.leaveTypeName}: ${lb.usedDays} of ${lb.totalDays} days used`}
                      >
                        <div className="progress-fill" style={{
                          width: `${usedPct}%`,
                          background: PALETTE[i % PALETTE.length],
                        }} />
                      </div>
                      <div className="text-[0.72rem] text-[var(--text-tertiary)] mt-[2px]">
                        {lb.usedDays}d used of {lb.totalDays}d
                      </div>
                    </div>
                  );
                })}
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
  const totalTeam = teamAttendance.present + teamAttendance.onLeave + teamAttendance.notCheckedIn;

  // H4 — only render donut when there are 2+ projects
  const donutSegs = contributions.slice(0, 4).map((r, i) => ({
    pct: totalContrib > 0 ? (r.minutes / totalContrib) * 100 : 0,
    color: PALETTE[i] ?? "var(--n-300)",
    label: r.project,
  }));

  const [pendingList, setPendingList] = useState<PendingApproval[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveToast, setApproveToast] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // H5 — inline approval confirmation
  const { confirming, payload: confirmPayload, request: requestConfirm, confirm: doConfirm, cancel: cancelConfirm } = useConfirm<PendingApproval>();

  const fetchPending = useCallback(async () => {
    const r = await apiFetch("/approvals/pending-timesheets").catch(() => null);
    if (r?.ok) { const d = await r.json(); setPendingList((d as PendingApproval[]).slice(0, 5)); }
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => { void fetchPending(); }, [fetchPending]);

  // M4 — auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => { void fetchPending(); }, 60_000);
    return () => clearInterval(id);
  }, [fetchPending]);

  function showApproveToast(msg: string) {
    setApproveToast(msg);
    setTimeout(() => setApproveToast(null), 3000);
  }

  // H5 — confirmed approval handler
  const executeApprove = async (item: PendingApproval) => {
    setApprovingId(item.timesheetId);
    const r = await apiFetch(`/approvals/${item.timesheetId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "" }),
    }).catch(() => null);
    if (r?.ok || r?.status === 204) {
      setPendingList(prev => prev.filter(a => a.timesheetId !== item.timesheetId));
      showApproveToast(`✓ Timesheet approved for ${formatDisplayName(item.username)}.`);
    }
    setApprovingId(null);
  };

  // C1 — "↑ All in" only on Present card when everyone is present
  const allPresent = teamAttendance.notCheckedIn === 0 && teamAttendance.onLeave === 0;

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {/* Approve toast */}
      {approveToast && (
        <div className="toast">{approveToast}</div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting(username)}</h1>
          <div className="page-subtitle">Here's what's happening with your team today — {todayStr()}</div>
        </div>
        {/* C2 — SVG icon instead of emoji; Reports accessible via sidebar nav too */}
        <div className="page-actions">
          <button className="btn btn-outline btn-sm flex items-center gap-[6px]" onClick={() => onNavigate?.("reports")}>
            <IconBarChart size={14} /> Reports
          </button>
        </div>
      </div>

      {/* M4 — Data freshness indicator */}
      <div className="dash-freshness-bar">
        <time dateTime={lastRefreshed.toISOString()} className="font-medium">{relativeTime(lastRefreshed)}</time>
        <button
          onClick={() => void fetchPending()}
          className="dash-refresh-btn"
          aria-label="Refresh dashboard"
        >
          <IconRefresh size={12} /> Refresh
        </button>
      </div>

      {/* H2 — Stat cards clickable with navigation and min-height */}
      <div className="stat-grid-4">
        {/* Present Today — C1: "↑ All in" only when allPresent */}
        <div
          className="stat-card cursor-pointer min-h-[140px] hover:shadow-md"
          onClick={() => onNavigate?.("team")}
          role="link"
          aria-label={`View ${teamAttendance.present} member${teamAttendance.present !== 1 ? "s" : ""} present today`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("team"); }}
        >
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)" }}><IconPeople color="#10b981" /></div>
            {/* C1 — "↑ All in" on Present card when all team is present */}
            <span className={`stat-trend ${allPresent ? "trend-up" : "trend-flat"}`}>
              {allPresent ? "↑ All in" : "Today"}
            </span>
          </div>
          <div className="stat-value">{teamAttendance.present}</div>
          <h2 className="stat-label">Present today</h2>
          <div className="stat-footer">Of {totalTeam} total team</div>
        </div>

        {/* On Leave Today */}
        <div
          className="stat-card cursor-pointer min-h-[140px] hover:shadow-md"
          onClick={() => onNavigate?.("team")}
          role="link"
          aria-label={`View ${teamAttendance.onLeave} member${teamAttendance.onLeave !== 1 ? "s" : ""} on leave today`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("team"); }}
        >
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}><IconLeaf color="#3b82f6" /></div>
            <span className="stat-trend trend-flat">{teamAttendance.onLeave > 0 ? `${teamAttendance.onLeave} away` : "None today"}</span>
          </div>
          <div className="stat-value">{teamAttendance.onLeave}</div>
          <h2 className="stat-label">On leave today</h2>
          <div className="stat-footer">Approved absences</div>
        </div>

        {/* Not Checked In — C1: no "↑ All in" here; neutral when 0 */}
        <div
          className="stat-card cursor-pointer min-h-[140px] hover:shadow-md"
          onClick={() => onNavigate?.("team")}
          role="link"
          aria-label={`View ${teamAttendance.notCheckedIn} member${teamAttendance.notCheckedIn !== 1 ? "s" : ""} not checked in`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("team"); }}
        >
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: teamAttendance.notCheckedIn > 0 ? "var(--warning-light)" : "var(--success-light)" }}>
              <IconClock color={teamAttendance.notCheckedIn > 0 ? "#f59e0b" : "#10b981"} />
            </div>
            {/* C1 — not checked in: neutral when 0, warning when >0 */}
            <span className={`stat-trend ${teamAttendance.notCheckedIn > 0 ? "trend-down" : "trend-up"}`}>
              {teamAttendance.notCheckedIn > 0 ? "↓ Attention" : "✓ None missing"}
            </span>
          </div>
          <div className="stat-value">{teamAttendance.notCheckedIn}</div>
          <h2 className="stat-label">Not checked in</h2>
          <div className="stat-footer">Expected but missing</div>
        </div>

        {/* Pending Approvals */}
        <div
          className="stat-card cursor-pointer min-h-[140px] hover:shadow-md"
          onClick={() => onNavigate?.("approvals")}
          role="link"
          aria-label={`View ${timesheetHealth.pendingApprovals} pending approval${timesheetHealth.pendingApprovals !== 1 ? "s" : ""}`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("approvals"); }}
        >
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
        {/* H3 — Team Attendance chart with Y-axis, tooltips, and accessibility */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Team Attendance</h2>
              <div className="card-subtitle">Today's status breakdown</div>
            </div>
          </div>
          <div className="card-body">
            {/* H3 — Small team (≤3): horizontal stat row instead of chart */}
            {totalTeam <= 3 ? (
              <div className="flex gap-[var(--space-4)] justify-around">
                {[
                  { label: "Present", value: teamAttendance.present, color: "var(--success)" },
                  { label: "On Leave", value: teamAttendance.onLeave, color: "var(--info)" },
                  { label: "Absent", value: teamAttendance.notCheckedIn, color: "var(--warning)" },
                ].map(b => (
                  <div key={b.label} className="text-center">
                    <div className="text-[1.8rem] font-bold leading-none" style={{ color: b.color }}>{b.value}</div>
                    <div className="text-[0.72rem] text-[var(--text-tertiary)] mt-[4px]">{b.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              /* H3 — Bar chart with Y-axis labels, tooltips, accessibility */
              <div
                role="img"
                aria-label={`Team attendance: ${teamAttendance.present} present, ${teamAttendance.onLeave} on leave, ${teamAttendance.notCheckedIn} absent`}
              >
                <div className="flex gap-[8px] items-end">
                  {/* Y-axis */}
                  <div className="flex flex-col justify-between h-[100px] pb-[22px] pt-[4px]">
                    {Array.from({ length: Math.min(totalTeam + 1, 5) }, (_, i) => {
                      const tick = Math.round((totalTeam / Math.min(totalTeam, 4)) * (Math.min(totalTeam, 4) - i));
                      return (
                        <div key={i} className="text-[0.6rem] text-[var(--text-tertiary)] text-right leading-none">
                          {tick}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 flex gap-[8px] items-end h-[100px] relative">
                    {/* Gridlines */}
                    {[25, 50, 75].map(pct => (
                      <div key={pct} className="absolute left-0 right-0 h-[1px] bg-[var(--border-subtle)] pointer-events-none" style={{ bottom: `${pct * 0.7}%` }} />
                    ))}
                    {[
                      { label: "Present", value: teamAttendance.present, color: "var(--success)" },
                      { label: "On Leave", value: teamAttendance.onLeave, color: "var(--info)" },
                      { label: "Absent", value: teamAttendance.notCheckedIn, color: "var(--warning)" },
                    ].map(b => {
                      const pct = totalTeam > 0 ? Math.round((b.value / totalTeam) * 100) : 0;
                      const barH = Math.max(4, Math.round(pct * 0.7));
                      return (
                        <div key={b.label} className="flex-1 flex flex-col items-center">
                          <div className="text-[0.65rem] text-[var(--text-tertiary)] mb-[3px]">{b.value}</div>
                          <div
                            className="w-full [border-radius:4px_4px_0_0] cursor-default"
                            style={{ height: `${barH}px`, background: b.color }}
                            title={`${b.label}: ${b.value} member${b.value !== 1 ? "s" : ""}`}
                          />
                          <div className="text-[0.7rem] text-[var(--text-tertiary)] mt-[4px]">{b.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="chart-legend mt-[var(--space-3)]">
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--success)" }} />Present ({teamAttendance.present})</div>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--info)" }} />On Leave ({teamAttendance.onLeave})</div>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--warning)" }} />Absent ({teamAttendance.notCheckedIn})</div>
            </div>
          </div>
        </div>

        {/* H4 — Project Contributions: single-project → stat display; 2+ → donut */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Project Contributions</h2>
              <div className="card-subtitle">This week</div>
            </div>
          </div>
          <div className="card-body">
            {contributions.length === 0 ? (
              <div className="empty-state py-[var(--space-6)]"><p className="empty-state__title">No data</p></div>
            ) : contributions.length === 1 ? (
              /* H4 — Single project: stat display instead of donut */
              <div className="py-[var(--space-4)]">
                <div className="text-[0.8rem] text-[var(--text-tertiary)] mb-[4px]" title={contributions[0].project}>
                  {contributions[0].project}
                </div>
                <div className="text-[1.8rem] font-bold text-[var(--text-primary)] leading-none">
                  {(contributions[0].minutes / 60).toFixed(1)}h
                </div>
                <div className="text-[0.72rem] text-[var(--text-tertiary)] mt-[4px]">this week</div>
              </div>
            ) : (
              <div className="flex items-center gap-[var(--space-5)]">
                <DonutChart segments={donutSegs} centerLabel={`${(totalContrib / 60).toFixed(0)}h`} centerSub="Team" size={110} />
                <div className="kpi-list flex-1">
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
        {/* C3 — Sanitized activity feed */}
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Recent Activity</h2><div className="card-subtitle">Team attendance & timesheet flags</div></div>
            {mismatches.length > 0 && <span className="badge badge-error">{mismatches.length}</span>}
          </div>
          <div className="card-body">
            {mismatches.length === 0 ? (
              <div className="empty-state py-[var(--space-8)]">
                <p className="empty-state__title">No mismatches</p>
                <p className="empty-state__sub">All timesheets match attendance.</p>
              </div>
            ) : (
              <div className="activity-list">
                {mismatches.slice(0, 5).map((r, i) => {
                  const MAX_NOTE = 60;
                  const note = r.mismatchReason ?? "";
                  const truncated = note.length > MAX_NOTE ? note.slice(0, MAX_NOTE) + "…" : note;
                  return (
                    <div key={i} className="activity-item cursor-pointer items-start" onClick={() => onNavigate?.("approvals")}>
                      <div className="activity-icon-wrap mt-[2px]" style={{ background: "var(--danger-light)" }}>⚠</div>
                      <div className="activity-body flex-1">
                        {/* C3 — structured sentence format */}
                        <div className="activity-text">
                          <strong>{formatDisplayName(r.username)}</strong> submitted a timesheet for{" "}
                          {fmtDateShort(r.workDate)} — flagged as mismatch
                        </div>
                        {note && (
                          <div className="text-[0.7rem] text-[var(--text-tertiary)] mt-[2px]">
                            <span className="font-semibold">Note:</span> <span title={note}>{truncated}</span>
                          </div>
                        )}
                        {/* C3 — review action link */}
                        <button
                          type="button"
                          className="mt-[4px] bg-none border-none p-0 text-[var(--brand-600)] text-[0.72rem] font-semibold cursor-pointer bg-transparent"
                          onClick={e => { e.stopPropagation(); onNavigate?.("approvals"); }}
                        >
                          Review →
                        </button>
                      </div>
                      <div className="activity-ts">{fmtDateShort(r.workDate)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* H5 — Pending Approvals with inline confirmation */}
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Pending Approvals</h2><div className="card-subtitle">Requires your action</div></div>
            {timesheetHealth.pendingApprovals > 0 && <span className="badge badge-danger">{timesheetHealth.pendingApprovals}</span>}
          </div>
          <div className="card-body">
            {pendingList.length === 0 && timesheetHealth.pendingApprovals === 0 ? (
              <div className="empty-state py-[var(--space-8)]">
                <p className="empty-state__title">All clear</p>
                <p className="empty-state__sub">No pending approvals.</p>
              </div>
            ) : (
              <div>
                {/* H5 — inline confirmation panel */}
                {confirming && confirmPayload && (
                  <div className="dash-confirm-panel">
                    <div className="font-semibold mb-[8px]">
                      Approve {formatDisplayName(confirmPayload.username)}'s timesheet for {fmtDateShort(confirmPayload.workDate)}?
                    </div>
                    <div className="flex gap-[var(--space-2)]">
                      <button
                        className="btn btn-primary btn-sm text-[0.75rem]"
                        onClick={() => { const item = doConfirm(); if (item) void executeApprove(item); }}
                      >Confirm</button>
                      <button
                        className="btn btn-ghost btn-sm text-[0.75rem]"
                        onClick={cancelConfirm}
                      >Cancel</button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-[var(--space-2)]">
                  {pendingList.map(a => (
                    <div key={a.timesheetId} className="dash-approval-row">
                      <div className="av" style={{ background: avatarColor(a.username), borderRadius: "var(--r-md)", flexShrink: 0 }}>
                        {a.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.8rem] font-semibold text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap" title={a.username}>
                          {formatDisplayName(a.username)}
                        </div>
                        <div className="text-[0.7rem] text-[var(--text-tertiary)]">{fmtDateShort(a.workDate)} · {fmtMinutes(a.enteredMinutes)}</div>
                      </div>
                      {/* H5 — requests confirmation instead of immediate approve */}
                      <button
                        className="btn btn-outline-success btn-sm [padding:3px_8px] h-[26px] text-[0.72rem] min-w-[28px]"
                        onClick={() => requestConfirm(a)}
                        disabled={approvingId === a.timesheetId || (confirming && confirmPayload?.timesheetId !== a.timesheetId)}
                        title={`Approve ${formatDisplayName(a.username)}'s timesheet`}
                        aria-label={`Approve ${formatDisplayName(a.username)}'s timesheet for ${fmtDateShort(a.workDate)}`}
                      >✓</button>
                    </div>
                  ))}
                </div>

                {/* M1 — Fix grammatically awkward pending CTA */}
                {timesheetHealth.pendingApprovals > 0 && (
                  <div className="mt-[var(--space-3)]">
                    <button className="btn btn-outline w-full btn-sm" onClick={() => onNavigate?.("approvals")}>
                      {timesheetHealth.pendingApprovals === 1
                        ? "View 1 pending approval →"
                        : `View all ${timesheetHealth.pendingApprovals} pending approvals →`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* H6 — Budget Health with thresholds and graceful no-budget state */}
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Budget Health</h2><div className="card-subtitle">Project effort this week</div></div>
          </div>
          <div className="card-body">
            {contributions.length === 0 ? (
              <div className="empty-state py-[var(--space-6)]"><p className="empty-state__title">No data</p></div>
            ) : (
              <div className="kpi-list">
                {contributions.slice(0, 5).map((r, i) => {
                  // H6 — no budget cap available from this endpoint; show effort with neutral bar
                  return (
                    <div key={r.project} className="kpi-item">
                      <div className="kpi-header">
                        <div className="kpi-name" title={r.project}>
                          <div className="kpi-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                          {r.project}
                        </div>
                        <div className="kpi-val">{fmtMinutes(r.minutes)}</div>
                      </div>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-valuenow={maxContrib > 0 ? Math.round((r.minutes / maxContrib) * 100) : 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${r.project}: ${fmtMinutes(r.minutes)}`}
                      >
                        <div className="progress-fill" style={{ width: `${maxContrib > 0 ? Math.round((r.minutes / maxContrib) * 100) : 0}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                      {/* H6 — No budget cap indicator */}
                      <div className="text-[0.68rem] text-[var(--text-tertiary)] italic mt-[2px]">
                        No budget cap set
                      </div>
                    </div>
                  );
                })}
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

  // Anomaly alerts state
  const [anomalies, setAnomalies] = useState<AnomalyNotification[]>([]);
  const [anomalyFilter, setAnomalyFilter] = useState<"all" | "warning" | "critical">("all");

  useEffect(() => {
    const fetchExtra = async () => {
      try {
        const [leaveRes, pendingRes, usersRes, anomalyRes] = await Promise.all([
          apiFetch("/leave/team-on-leave"),
          apiFetch("/approvals/pending-timesheets"),
          apiFetch("/users"),
          apiFetch("/admin/anomalies"),
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
        if (anomalyRes.ok) setAnomalies(await anomalyRes.json() as AnomalyNotification[]);
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
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-2)]">
        <div className="page-header">
          <div>
            <h1 className="page-title">{greeting(username)}</h1>
            <div className="page-subtitle">Organisation overview — {todayStr()}</div>
          </div>
          {/* Export split button */}
          <div ref={exportRef} className="relative">
            <div className="btn-split">
              <button className="btn btn-outline btn-sm btn-split__main">
                <IconDownload size={14} /> Export
              </button>
              <button
                className="btn btn-outline btn-sm btn-split__chevron"
                onClick={() => setShowExportMenu(v => !v)}
                aria-label="Export options"
              >
                <IconChevronDown />
              </button>
            </div>
            {showExportMenu && (
              <div className="dash-export-menu">
                {[["📄 PDF", "pdf"], ["📊 CSV", "csv"], ["🔗 Copy link", "link"]].map(([label, type]) => (
                  <button
                    key={type}
                    onClick={() => { setShowExportMenu(false); }}
                    className="dash-export-item"
                  >{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Period selector sub-row */}
        <div className="flex items-center gap-[8px]">
          <span className="text-[0.72rem] text-[var(--text-tertiary)] font-medium whitespace-nowrap">Viewing data for:</span>
          <div className="dash-period-selector">
            {(["today", "week", "30d", "quarter"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`dash-period-btn${period === p ? " dash-period-btn--active" : ""}`}
              >{PERIOD_LABELS[p]}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Freshness bar */}
      <div className="dash-freshness-bar">
        <time dateTime={lastRefreshed.toISOString()} className="font-medium">{relativeTime(lastRefreshed)}</time>
        <button
          onClick={() => window.location.reload()}
          className="dash-refresh-btn"
        >
          <IconRefresh size={12} /> Refresh
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
          <h2 className="stat-label">Active Departments</h2>
          <div className="stat-footer">With recorded effort · no prior period data</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: billablePct >= 70 ? "var(--success-light)" : "var(--warning-light)" }}>
              <IconBarChart color={billablePct >= 70 ? "#10b981" : "#f59e0b"} />
            </div>
            <div className="flex flex-col items-end gap-[2px]">
              <span className={`stat-trend ${billablePct >= 70 ? "trend-up" : "trend-down"}`}>
                {billablePct >= 70 ? "↑ On track" : "↓ Below target"}
              </span>
              <Sparkline values={sparklineValues} color={billablePct >= 70 ? "#10b981" : "#f59e0b"} width={52} height={16} />
            </div>
          </div>
          <div className="stat-value">
            {billablePct}<span className="text-[0.875rem] font-semibold text-[var(--text-tertiary)] ml-[1px]">%</span>
          </div>
          <h2 className="stat-label">Billable ratio</h2>
          <div className="stat-footer">{fmtMinutes(billable.billableMinutes)} billable · {PERIOD_LABELS[period].toLowerCase()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)" }}><IconPeople color="#3b82f6" /></div>
            <span className="stat-trend trend-flat" title={`${consultantVsInternal.internal} Internal · ${consultantVsInternal.consultant} Consultants`}>
              {consultantVsInternal.internal} Internal · {consultantVsInternal.consultant} Consultants
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
            <span className={`stat-trend ${pendingCount > 0 ? "trend-flat" : "trend-up"}`}>
              {pendingCount > 0 ? `${pendingCount} pending` : "All clear"}
            </span>
          </div>
          <div className="stat-value">{pendingCount}</div>
          <h2 className="stat-label">Pending approvals</h2>
          <div className="stat-footer">
            {pendingCount > 0
              ? <button className="bg-transparent border-none text-[var(--brand-500)] cursor-pointer p-0 text-[0.72rem]" onClick={() => onNavigate?.("approvals")}>Review →</button>
              : "No action needed"
            }
          </div>
        </div>
      </div>

      {/* Anomaly Alerts panel — only shown when there are alerts */}
      {anomalies.length > 0 && (() => {
        const filtered = anomalyFilter === "all" ? anomalies : anomalies.filter(a => a.severity === anomalyFilter);
        const visible = filtered.slice(0, 10);
        const hiddenCount = filtered.length - visible.length;

        async function dismissAnomaly(id: string) {
          const r = await apiFetch(`/admin/anomalies/${id}/dismiss`, { method: "POST" }).catch(() => null);
          if (r?.ok || r?.status === 204) {
            setAnomalies(prev => prev.filter(a => a.id !== id));
          }
        }

        return (
          <div className="dash-anomaly-panel">
            {/* Header */}
            <div className="flex items-center justify-between mb-[14px] flex-wrap gap-[8px]">
              <span className="font-bold text-[0.9rem] text-[var(--text-primary)] flex items-center gap-[6px]">
                🔔 Anomaly Alerts
                {anomalies.some(a => a.severity === "critical") && (
                  <span className="bg-[#fee2e2] text-[#ef4444] rounded-[8px] px-[8px] py-[2px] text-[0.72rem] font-bold">
                    {anomalies.filter(a => a.severity === "critical").length} critical
                  </span>
                )}
              </span>
              <div className="flex gap-[4px]">
                {(["all", "warning", "critical"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setAnomalyFilter(f)}
                    className={`dash-anomaly-filter-btn${anomalyFilter === f ? ` dash-anomaly-filter-btn--${f}` : ""}`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert rows */}
            {visible.length === 0 ? (
              <div className="text-[0.8rem] text-[var(--text-tertiary)] py-[12px] text-center">
                No {anomalyFilter === "all" ? "" : anomalyFilter + " "}alerts.
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {visible.map((a, idx) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-[10px] py-[10px] border-t border-[var(--border-subtle)]"
                  >
                    {/* Severity icon */}
                    <div className="shrink-0 mt-[1px] text-[1rem] leading-none">
                      {a.severity === "critical"
                        ? <span className="text-[#ef4444]">🔴</span>
                        : <span className="text-[#f59e0b]">⚠️</span>
                      }
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-bold mb-[2px] overflow-hidden text-ellipsis whitespace-nowrap ${a.severity === "critical" ? "text-[#ef4444]" : "text-[#b45309]"}`}>
                        {a.title}
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden mb-[4px]">
                        {a.message}
                      </div>
                      <div className="text-[0.68rem] text-[var(--text-tertiary)]">
                        {anomalyRelativeTime(a.createdAtUtc)}
                      </div>
                    </div>
                    {/* Dismiss button */}
                    <button
                      onClick={() => void dismissAnomaly(a.id)}
                      className="dash-dismiss-btn"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <div
                    className="text-[0.75rem] text-[var(--brand-600)] font-semibold pt-[8px] text-center cursor-pointer"
                    onClick={() => setAnomalyFilter("all")}
                  >
                    Show {hiddenCount} more
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Row 2: Dept Effort + Billable vs Non-Billable */}
      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Department Effort</h2><div className="card-subtitle">{PERIOD_LABELS[period]}</div></div>
          </div>
          <div className="card-body">
            {effortByDepartment.length === 0 ? (
              <div className="empty-state py-[var(--space-6)]">
                <div className="empty-state__icon">🏢</div>
                <p className="empty-state__title">No department data</p>
                <p className="empty-state__sub">No effort recorded for this period.</p>
              </div>
            ) : effortByDepartment.length === 1 ? (
              <SingleDeptStat dept={effortByDepartment[0]} />
            ) : (
              <HBarChartDept data={effortByDepartment} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Billable vs Non-Billable</h2><div className="card-subtitle">{PERIOD_LABELS[period]}</div></div>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-[var(--space-5)]">
              {donutSegs.length > 0 && (
                <DonutChart
                  segments={donutSegs}
                  centerLabel={`${billablePct}%`}
                  centerSub="of total"
                  size={130}
                />
              )}
              <div className="kpi-list flex-1">
                {billable.billableMinutes > 0 && <KpiItem name="Billable" color="var(--success)" value={billable.billableMinutes} max={totalBillable} />}
                {billable.nonBillableMinutes > 0 && <KpiItem name="Non-Billable" color="var(--n-300)" value={billable.nonBillableMinutes} max={totalBillable} />}
                {billable.billableMinutes === 0 && billable.nonBillableMinutes === 0 && (
                  <div className="text-[0.78rem] text-[var(--text-tertiary)] py-[var(--space-4)]">No billable data for this period.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Utilization + Compliance + Effort by Project + Who's on Leave */}
      <div className="dashboard-grid-4">
        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Utilization</h2><div className="card-subtitle">Hours logged this week</div></div>
          </div>
          <div className="card-body">
            {underOver.length === 0 ? (
              <div className="empty-state py-[var(--space-6)]">
                <div className="empty-state__icon">📊</div>
                <p className="empty-state__title">No utilization data</p>
              </div>
            ) : (
              <div className="activity-list">
                {underOver.slice(0, 6).map((r) => (
                  <div key={r.username} className="activity-item">
                    <div className="activity-body gap-[2px]">
                      <div className="activity-text text-[rgb(16,16,26)] font-medium mb-[3px]">{r.username}</div>
                      <UtilBar minutes={r.minutes} status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Compliance Trend</h2><div className="card-subtitle">Last 28 days</div></div>
          </div>
          <div className="card-body">
            {complianceList.length === 0 ? (
              <div className="empty-state py-[var(--space-6)]">
                <div className="empty-state__icon">📋</div>
                <p className="empty-state__title">No compliance data</p>
              </div>
            ) : (
              <ComplianceHeatmap data={complianceList} onViewReport={() => onNavigate?.("reports")} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">Effort by Project</h2><div className="card-subtitle">{PERIOD_LABELS[period]}</div></div>
          </div>
          <div className="card-body">
            {effortByProject.length === 0 ? (
              <div className="empty-state py-[var(--space-6)]"><p className="empty-state__title">No data</p></div>
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
                    />
                  );
                })}
              </div>
            )}
          </div>
          {effortByProject.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] px-[var(--space-5)] py-[var(--space-3)]">
              <button onClick={() => onNavigate?.("projects")} className="card-footer-link">View all projects →</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2 className="card-title">On Leave Today</h2><div className="card-subtitle">Approved absences</div></div>
          </div>
          <div className="card-body min-h-[120px]">
            {leaveToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[100px] gap-[6px] text-center">
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--n-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-70">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="text-[0.82rem] font-semibold text-[var(--text-secondary)]">No one on leave today</p>
                <p className="text-[0.72rem] text-[var(--text-tertiary)]">Full team is in.</p>
              </div>
            ) : (
              <div className="activity-list">
                {leaveToday.slice(0, 6).map((entry, i) => (
                  <div key={i} className="activity-item">
                    <div className="av shrink-0 w-[28px] h-[28px] flex items-center justify-center text-[0.65rem] font-bold text-white" style={{ background: avatarColor(entry.username), borderRadius: "var(--r-md)" }}>
                      {entry.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="activity-body">
                      <div className="activity-text text-[rgb(16,16,26)] font-medium">{entry.username}</div>
                      <div className="activity-meta">{entry.leaveTypeName}</div>
                    </div>
                    <div className="activity-ts whitespace-nowrap">
                      {fmtDateShort(entry.fromDate)}
                      {entry.toDate !== entry.fromDate && <> – {fmtDateShort(entry.toDate)}</>}
                    </div>
                  </div>
                ))}
                {leaveToday.length > 6 && (
                  <div className="text-[0.72rem] text-[var(--text-tertiary)] text-center pt-[4px]">
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
        </div>
        <div className="card-body">
          <div
            className="progress-track h-[8px]"
            role="progressbar"
            aria-valuenow={totalStaff > 0 ? Math.round((submittedCount / totalStaff) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Submission rate: ${totalStaff > 0 ? Math.round((submittedCount / totalStaff) * 100) : 0}%`}
          >
            <div className="progress-fill" style={{
              width: totalStaff > 0 ? `${Math.round((submittedCount / totalStaff) * 100)}%` : "0%",
              background: "var(--brand-500)",
            }} />
          </div>
          <div className="flex items-center justify-between mt-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-4)]">
              <div className="text-[0.85rem] font-semibold text-[var(--text-primary)]">
                {totalStaff > 0 ? `${Math.round((submittedCount / totalStaff) * 100)}%` : "—"}
              </div>
              <div className="text-[0.75rem] text-[var(--text-tertiary)]">
                {totalStaff > 0 ? `${totalStaff - submittedCount} not yet submitted` : ""}
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate?.("approvals")}>Send reminder →</button>
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
            week: week ?? { weekStartDate: "", weekEndDate: "", weekExpectedMinutes: 0, weekEnteredMinutes: 0, weekAttendanceNetMinutes: 0, days: [] },
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

  if (loading) return <SkeletonPage kpis={4} rows={5} cols={5} />;

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
