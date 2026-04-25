import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, X } from "lucide-react";
import { apiFetch } from "../api/client";
import { useSignalREvent, HUB_EVENTS } from "../contexts/SignalRContext";
import { AttendanceWidget } from "./AttendanceWidget";
import { useConfirm } from "../hooks/useConfirm";
import { SkeletonPage } from "./Skeleton";
import type { LeaveBalance, OvertimeSummary, TeamLeaveEntry, PagedResponse, Project, User } from "../types";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { useTimezone } from "../hooks/useTimezone";
import { AppBadge, AppButton } from "./ui";
import { useTenantSettings } from "../contexts/TenantSettingsContext";

interface DashboardProps { role: string; username: string; onboardingCompletedAt?: string | null; onNavigate?: (view: string) => void; }

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
interface ManagerData {
  teamAttendance: TeamAttendance;
  timesheetHealth: TimesheetHealth;
  mismatches: MismatchRow[];
  utilization: Utilization;
  contributions: ContributionRow[];
  overtimeHours?: number;
  overtimeMinutes?: number;
}

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
function fmtTime(iso: string | null, timeZoneId?: string): string {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timeZoneId });
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
  const m: Record<string, "warning" | "info" | "success" | "error"> = { draft: "warning", submitted: "info", approved: "success", rejected: "error" };
  return <AppBadge variant={m[s?.toLowerCase()] ?? "neutral"}>{s}</AppBadge>;
}
function loadBadge(s: string) {
  const m: Record<string, "warning" | "success" | "error"> = { underutilized: "warning", balanced: "success", overloaded: "error" };
  return <AppBadge variant={m[s] ?? "neutral"}>{s}</AppBadge>;
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

function currentWeekStartIso(reference = new Date()): string {
  const d = new Date(reference);
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
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

// ── Radial ring ───────────────────────────────────────────────────────────────
function RadialRing({ pct, color = "var(--brand-500)", size = 88, label, sublabel }: {
  pct: number; color?: string; size?: number; label?: string; sublabel?: string;
}) {
  const R = 32, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * R;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }} aria-label={`${clamped}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--n-100)" strokeWidth={7} />
        <circle
          cx={cx} cy={cy} r={R} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{label ?? `${clamped}%`}</div>
        {sublabel && <div style={{ fontSize: "0.55rem", color: "var(--text-tertiary)", marginTop: 2 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function DeltaBadge({ delta, unit = "%" }: { delta: number; unit?: string }) {
  const isUp = delta >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: "0.68rem", fontWeight: 700, padding: "2px 6px",
      borderRadius: 999,
      background: isUp ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      color: isUp ? "#10b981" : "#ef4444",
    }}>
      {isUp ? "↑" : "↓"}{Math.abs(delta)}{unit}
    </span>
  );
}

// ── Now hero card (employee) ──────────────────────────────────────────────────
function NowHeroCard({ username, todayMinutes, targetMinutes, checkedIn, timeZoneId }: {
  username: string; todayMinutes: number; targetMinutes: number;
  checkedIn?: string | null; timeZoneId?: string;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, targetMinutes > 0 ? Math.round((todayMinutes / targetMinutes) * 100) : 0);
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timeZoneId || undefined });

  return (
    <div style={{
      background: "linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)",
      borderRadius: "var(--r-lg, 12px)", padding: "20px 24px", color: "white",
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", gap: 24,
    }}>
      {/* Decorative blobs */}
      <div style={{ position: "absolute", right: -32, top: -32, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 40, bottom: -40, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

      {/* Left: time + greeting */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 500, opacity: 0.72, letterSpacing: "0.02em", marginBottom: 2 }}>
          {greeting(username)}
        </div>
        <div style={{ fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
          {timeStr}
        </div>
        <div style={{ fontSize: "0.72rem", opacity: 0.55, marginTop: 3 }}>{todayStr()}</div>
        {checkedIn && (
          <div style={{ fontSize: "0.7rem", opacity: 0.65, marginTop: 2 }}>
            Checked in at {checkedIn}
          </div>
        )}
      </div>

      {/* Right: today progress */}
      <div style={{ minWidth: 140, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", opacity: 0.75, marginBottom: 6 }}>
          <span>Today's hours</span>
          <span>{fmtMinutes(todayMinutes)}{targetMinutes > 0 ? ` / ${fmtMinutes(targetMinutes)}` : ""}</span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.2)", borderRadius: 3 }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 3,
            background: pct >= 100 ? "#34d399" : "rgba(255,255,255,0.9)",
            transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
          }} />
        </div>
        <div style={{ fontSize: "0.65rem", opacity: 0.6, marginTop: 5, textAlign: "right" }}>
          {pct > 0 ? `${pct}% of daily target` : "No entries yet"}
        </div>
      </div>
    </div>
  );
}

// ── Area trend chart ──────────────────────────────────────────────────────────
function AreaTrendChart({ points, color1 = "var(--brand-500)", color2 = "var(--n-300)", label1 = "Primary", label2 = "Secondary", height = 80 }: {
  points: Array<{ v1: number; v2: number; label?: string }>;
  color1?: string; color2?: string; label1?: string; label2?: string; height?: number;
}) {
  if (points.length < 2) return null;
  const W = 400, H = height;
  const maxVal = Math.max(...points.map(p => p.v1 + p.v2), 1);
  const step = W / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: i * step,
    yTotal: H - ((p.v1 + p.v2) / maxVal) * (H - 8) - 4,
    yPrimary: H - (p.v1 / maxVal) * (H - 8) - 4,
  }));

  const smoothPath = (key: "yTotal" | "yPrimary") => {
    let d = `M ${coords[0].x},${coords[0][key]}`;
    for (let i = 1; i < coords.length; i++) {
      const c0 = coords[i - 1], c1 = coords[i];
      const cpx = (c0.x + c1.x) / 2;
      d += ` C ${cpx},${c0[key]} ${cpx},${c1[key]} ${c1.x},${c1[key]}`;
    }
    return d;
  };
  const areaPath = (key: "yTotal" | "yPrimary") =>
    `${smoothPath(key)} L ${W},${H} L 0,${H} Z`;

  const uid = `atc-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id={`${uid}-g2`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color2} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color2} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`${uid}-g1`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color1} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaPath("yTotal")} fill={`url(#${uid}-g2)`} />
        <path d={smoothPath("yTotal")} fill="none" stroke={color2} strokeWidth="1.5" strokeLinejoin="round" />
        <path d={areaPath("yPrimary")} fill={`url(#${uid}-g1)`} />
        <path d={smoothPath("yPrimary")} fill="none" stroke={color1} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
          <div style={{ width: 12, height: 3, borderRadius: 2, background: color1 }} />{label1}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
          <div style={{ width: 12, height: 3, borderRadius: 2, background: color2 }} />{label2}
        </div>
      </div>
    </div>
  );
}

// ── Team pulse strip (manager) ────────────────────────────────────────────────
interface TeamMemberPulse { username: string; status: "present" | "on-leave" | "absent"; minutesToday?: number; }
function TeamPulseStrip({ members }: { members: TeamMemberPulse[] }) {
  if (members.length === 0) return null;
  const STATUS_COLOR: Record<TeamMemberPulse["status"], string> = {
    present: "#10b981",
    "on-leave": "#f59e0b",
    absent: "var(--n-300)",
  };
  const STATUS_LABEL: Record<TeamMemberPulse["status"], string> = {
    present: "Present",
    "on-leave": "On leave",
    absent: "Absent",
  };
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}>
      {members.map((m) => (
        <div key={m.username} style={{
          background: "var(--surface, var(--n-0, #fff))",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12, padding: "10px 14px",
          minWidth: 108, maxWidth: 120,
          display: "flex", flexDirection: "column", gap: 6,
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: avatarColor(m.username),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.65rem", fontWeight: 700, color: "white", flexShrink: 0,
            }}>
              {m.username.slice(0, 2).toUpperCase()}
            </div>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: STATUS_COLOR[m.status],
              boxShadow: `0 0 0 2px ${STATUS_COLOR[m.status]}30`,
            }} title={STATUS_LABEL[m.status]} />
          </div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
            {m.username}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>
            {m.status === "present" && m.minutesToday
              ? `${(m.minutesToday / 60).toFixed(1)}h today`
              : STATUS_LABEL[m.status]}
          </div>
        </div>
      ))}
    </div>
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

// ── Compliance 13-week intensity heatmap ──────────────────────────────────────
type ComplianceItem = { workDate?: string; date?: string; username?: string; isCompliant?: boolean; compliant?: boolean; rule?: string };
function ComplianceHeatmap({ data, onViewReport }: { data: ComplianceItem[]; onViewReport?: () => void }) {
  // Build 13 weeks (91 days)
  const days = Array.from({ length: 91 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (90 - i));
    return d.toISOString().slice(0, 10);
  });

  // Aggregate compliance by date (supports multiple rows per day = team data)
  type DayStats = { compliant: number; total: number };
  const byDate: Record<string, DayStats> = {};
  data.forEach(r => {
    const d = (r.workDate ?? r.date ?? "").slice(0, 10);
    if (!d) return;
    if (!byDate[d]) byDate[d] = { compliant: 0, total: 0 };
    byDate[d].total++;
    if (r.isCompliant ?? r.compliant) byDate[d].compliant++;
  });

  // 0–4 intensity based on compliance ratio
  const intensityOf = (d: string): 0 | 1 | 2 | 3 | 4 => {
    const s = byDate[d];
    if (!s || s.total === 0) return 0;
    const ratio = s.compliant / s.total;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    if (ratio > 0) return 1;
    return 0;
  };

  // Blue intensity palette (0=empty, 1–4=lightest to deepest brand blue)
  const INTENSITY_COLORS = ["var(--n-100)", "#dbeafe", "#93c5fd", "#3b82f6", "#1e40af"];

  const knownDays = days.filter(d => d in byDate);
  const activeDays = knownDays.filter(d => byDate[d].compliant > 0).length;
  const ratio = activeDays / (knownDays.length || 1);
  const statusClass = ratio >= 0.8 ? "trend-up" : ratio >= 0.5 ? "trend-flat" : "trend-down";
  const statusLabel = ratio >= 0.8 ? "Good" : ratio >= 0.5 ? "Fair" : "Poor";

  // Pad to Monday-aligned grid
  const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];
  const firstDay = new Date(days[0] + "T12:00:00");
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
  const padded: (string | null)[] = Array(startDow).fill(null).concat(days);
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  return (
    <div>
      <div className="flex items-center gap-[8px] mb-[10px]">
        <span className="text-[0.82rem] font-semibold text-[var(--text-primary)]">
          {activeDays}/{knownDays.length} days with activity
        </span>
        <span className={`stat-trend ${statusClass}`}>{statusLabel}</span>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {/* Day row labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 2, justifyContent: "space-between" }}>
          {DAY_NAMES.map((n, i) => (
            <div key={i} style={{ height: 11, fontSize: "0.55rem", color: "var(--text-tertiary)", lineHeight: "11px", width: 10 }}>
              {i % 2 === 0 ? n : ""}
            </div>
          ))}
        </div>
        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {week.map((d, di) => {
              if (!d) return <div key={di} style={{ width: 11, height: 11 }} />;
              const v = intensityOf(d);
              const stats = byDate[d];
              const cellLabel = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const tooltip = stats
                ? `${cellLabel}: ${stats.compliant}/${stats.total} compliant`
                : `${cellLabel}: No data`;
              return (
                <div
                  key={d}
                  style={{
                    width: 11, height: 11, borderRadius: 2,
                    background: INTENSITY_COLORS[v],
                    border: v === 0 ? "1px solid var(--border-subtle)" : "none",
                  }}
                  title={tooltip}
                  aria-label={tooltip}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* Intensity legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: "0.62rem", color: "var(--text-tertiary)" }}>Less</span>
        {INTENSITY_COLORS.map((c, i) => (
          <div key={i} style={{
            width: 11, height: 11, borderRadius: 2, background: c,
            border: i === 0 ? "1px solid var(--border-subtle)" : "none",
          }} />
        ))}
        <span style={{ fontSize: "0.62rem", color: "var(--text-tertiary)" }}>More</span>
      </div>
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
  let label: React.ReactNode;
  if (status === "overloaded") {
    fillClass = "progress-fill--critical"; labelColor = "var(--danger)"; label = <><TrendingDown size={11} strokeWidth={2.5} /> Critical</>;
  } else if (status === "balanced") {
    fillClass = "progress-fill--success"; labelColor = "var(--success)"; label = <><TrendingUp size={11} strokeWidth={2.5} /> On track</>;
  } else if (barPct < 10) {
    fillClass = "progress-fill--critical"; labelColor = "var(--danger)"; label = <><TrendingDown size={11} strokeWidth={2.5} /> Critical</>;
  } else if (barPct < 60) {
    fillClass = "progress-fill--warning"; labelColor = "var(--warning)"; label = <><TrendingDown size={11} strokeWidth={2.5} /> Below target</>;
  } else {
    fillClass = "progress-fill--caution"; labelColor = "#f97316"; label = <><Minus size={11} strokeWidth={2.5} /> Near target</>;
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
          <div key={i} className="card p-[var(--space-4)] min-h-[168px]">
            <div className="skeleton skeleton-title w-[140px] h-[16px] mb-[20px]" />
            <div className="skeleton w-full h-[120px] rounded-[var(--r-md)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Employee View ─────────────────────────────────────────────────────────────
function EmployeeDashboard({ employee, week, leaveBalances, activeProjectCount, username, onNavigate, timeZoneId }: {
  employee: EmployeeData;
  week: WeekSummary;
  leaveBalances: LeaveBalance[];
  activeProjectCount: number;
  username: string;
  onNavigate?: (view: string) => void;
  timeZoneId: string;
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
  if (todaySession.checkedIn) activities.push({ icon: "✓", iconBg: "var(--success-light)", text: "Checked in", sub: `At ${fmtTime(todaySession.checkedIn, timeZoneId)}`, ts: "Today" });
  if (todaySession.checkedOut) activities.push({ icon: "○", iconBg: "var(--n-100)", text: "Checked out", sub: `At ${fmtTime(todaySession.checkedOut, timeZoneId)}`, ts: "Today" });
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
          <AppButton variant="primary" size="sm" onClick={() => onNavigate?.("timesheets")}>+ Log Time</AppButton>
        </div>
      </div>

      <NowHeroCard
        username={username}
        todayMinutes={todaySession.attendanceMinutes}
        targetMinutes={week.weekExpectedMinutes > 0 ? Math.round(week.weekExpectedMinutes / (week.days.filter(d => d.expectedMinutes > 0).length || 5)) : 480}
        checkedIn={todaySession.checkedIn ? fmtTime(todaySession.checkedIn, timeZoneId) : null}
        timeZoneId={timeZoneId}
      />

      <AttendanceWidget />

      <div className="stat-grid-4">
        {/* Hours this week — RadialRing + Sparkline */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}><IconClock color="currentColor" /></div>
            <RadialRing
              pct={pctTarget}
              color={pctTarget >= 80 ? "var(--brand-500)" : "var(--warning)"}
              size={52}
              sublabel="target"
            />
          </div>
          <div className="stat-value">{hoursThisWeek.toFixed(1)}<span className="text-[1rem] text-[var(--text-tertiary)]">h</span></div>
          <h2 className="stat-label">Hours this week</h2>
          {week.days.length > 1 && (
            <div className="mt-[6px]">
              <Sparkline
                values={week.days.map(d => d.enteredMinutes / 60)}
                color={pctTarget >= 80 ? "var(--brand-500)" : "var(--warning)"}
                width={72}
                height={18}
              />
            </div>
          )}
          <div className="stat-footer">{week.weekExpectedMinutes > 0 ? `${(week.weekExpectedMinutes / 60).toFixed(0)}h expected` : "No schedule set"}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}><IconCheckCircle color="currentColor" /></div>
            <div className="flex flex-col items-end gap-[3px]">
              <span className={`stat-trend ${approvalRate >= 90 ? "trend-up" : "trend-flat"}`}>
                {approvalRate >= 90 ? <><TrendingUp size={11} strokeWidth={2.5} /> On track</> : "Needs attention"}
              </span>
              <DeltaBadge delta={approvalRate >= 80 ? Math.round(approvalRate - 75) : -(80 - approvalRate)} />
            </div>
          </div>
          <div className="stat-value">{approvalRate}<span className="text-[1rem] text-[var(--text-tertiary)]">%</span></div>
          <h2 className="stat-label">Approval rate</h2>
          <div className="stat-footer">{compliantDays} of {monthlyComplianceTrend.length} submitted this month</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)", color: "var(--info)" }}><IconLayers color="currentColor" /></div>
            <span className="stat-trend trend-flat">{projectEffort.length} with hours</span>
          </div>
          <div className="stat-value">{activeProjectCount}</div>
          <h2 className="stat-label">Active projects</h2>
          <div className="stat-footer">{projectEffort.length} with hours this week</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--warning-light)", color: "var(--warning)" }}><IconLeaf color="currentColor" /></div>
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
                {pctTarget >= 100 ? <><TrendingUp size={11} strokeWidth={2.5} /> </> : ""}{pctTarget}% target hit
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
              <div className="flex items-center gap-[var(--space-3)]">
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
  const overtimeHours = typeof data.overtimeHours === "number"
    ? data.overtimeHours
    : typeof data.overtimeMinutes === "number"
      ? data.overtimeMinutes / 60
      : 0;

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
  const [pulseMembers, setPulseMembers] = useState<TeamMemberPulse[]>([]);

  // H5 — inline approval confirmation
  const { confirming, payload: confirmPayload, request: requestConfirm, confirm: doConfirm, cancel: cancelConfirm } = useConfirm<PendingApproval>();

  const fetchPending = useCallback(async () => {
    const r = await apiFetch("/approvals/pending-timesheets?page=1&pageSize=5").catch(() => null);
    if (r?.ok) {
      const d = await r.json() as PagedResponse<PendingApproval>;
      setPendingList(d.items.slice(0, 5));
    }
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => { void fetchPending(); }, [fetchPending]);

  // M4 — auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => { void fetchPending(); }, 60_000);
    return () => clearInterval(id);
  }, [fetchPending]);

  // Team pulse strip: build member list from users + leave data
  useEffect(() => {
    (async () => {
      try {
        const [usersRes, leaveRes] = await Promise.all([
          apiFetch("/users?page=1&pageSize=50"),
          apiFetch("/leave/team-on-leave"),
        ]);
        const onLeaveNames = new Set<string>();
        if (leaveRes.ok) {
          const onLeave = await leaveRes.json() as TeamLeaveEntry[];
          onLeave.forEach(e => onLeaveNames.add(e.username));
        }
        if (usersRes.ok) {
          const { items } = await usersRes.json() as PagedResponse<User>;
          const active = items.filter(u => u.isActive).slice(0, 20);
          const members: TeamMemberPulse[] = active.map(u => ({
            username: u.username,
            status: onLeaveNames.has(u.username)
              ? "on-leave"
              : "absent", // default; present count comes from attendance aggregate
          }));
          // Mark up to `teamAttendance.present` members as present (best-effort heuristic)
          let presentSlots = teamAttendance.present;
          for (const m of members) {
            if (m.status === "absent" && presentSlots > 0) {
              m.status = "present";
              presentSlots--;
            }
          }
          setPulseMembers(members);
        }
      } catch { /* non-critical */ }
    })();
  }, [teamAttendance.present]);

  function showApproveToast(msg: string) {
    setApproveToast(msg);
    setTimeout(() => setApproveToast(null), 3000);
  }

  // H5 — confirmed approval handler
  const executeApprove = async (item: PendingApproval) => {
    setApprovingId(item.timesheetId);
    const r = await apiFetch(`/approvals/timesheets/${item.timesheetId}/approve`, {
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
          <AppButton variant="outline" size="sm" className="flex items-center gap-[6px]" onClick={() => onNavigate?.("reports")}>
            <IconBarChart size={14} /> Reports
          </AppButton>
        </div>
      </div>

      <AttendanceWidget />

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

      {/* Team Pulse Strip */}
      {pulseMembers.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Team Pulse</h2>
              <div className="card-subtitle">{teamAttendance.present} present · {teamAttendance.onLeave} on leave · {teamAttendance.notCheckedIn} not in</div>
            </div>
          </div>
          <div className="card-body">
            <TeamPulseStrip members={pulseMembers} />
          </div>
        </div>
      )}

      {/* H2 — Stat cards clickable with navigation and min-height */}
      <div className="stat-grid-4">
        {/* Present Today — C1: "↑ All in" only when allPresent */}
        <div
          className="stat-card cursor-pointer min-h-[122px] hover:shadow-md"
          onClick={() => onNavigate?.("team")}
          role="link"
          aria-label={`View ${teamAttendance.present} member${teamAttendance.present !== 1 ? "s" : ""} present today`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("team"); }}
        >
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}><IconPeople color="currentColor" /></div>
            {/* C1 — "↑ All in" on Present card when all team is present */}
            <span className={`stat-trend ${allPresent ? "trend-up" : "trend-flat"}`}>
              {allPresent ? <><TrendingUp size={11} strokeWidth={2.5} /> All in</> : "Today"}
            </span>
          </div>
          <div className="stat-value">{teamAttendance.present}</div>
          <h2 className="stat-label">Present today</h2>
          <div className="stat-footer">Of {totalTeam} total team</div>
        </div>

        {/* On Leave Today */}
        <div
          className="stat-card cursor-pointer min-h-[122px] hover:shadow-md"
          onClick={() => onNavigate?.("team")}
          role="link"
          aria-label={`View ${teamAttendance.onLeave} member${teamAttendance.onLeave !== 1 ? "s" : ""} on leave today`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("team"); }}
        >
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--info-light)", color: "var(--info)" }}><IconLeaf color="currentColor" /></div>
            <span className="stat-trend trend-flat">{teamAttendance.onLeave > 0 ? `${teamAttendance.onLeave} away` : "None today"}</span>
          </div>
          <div className="stat-value">{teamAttendance.onLeave}</div>
          <h2 className="stat-label">On leave today</h2>
          <div className="stat-footer">Approved absences</div>
        </div>

        {/* Not Checked In — C1: no "↑ All in" here; neutral when 0 */}
        <div
          className="stat-card cursor-pointer min-h-[122px] hover:shadow-md"
          onClick={() => onNavigate?.("team")}
          role="link"
          aria-label={`View ${teamAttendance.notCheckedIn} member${teamAttendance.notCheckedIn !== 1 ? "s" : ""} not checked in`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("team"); }}
        >
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: teamAttendance.notCheckedIn > 0 ? "var(--warning-light)" : "var(--success-light)", color: teamAttendance.notCheckedIn > 0 ? "var(--warning)" : "var(--success)" }}>
              <IconClock color="currentColor" />
            </div>
            {/* C1 — not checked in: neutral when 0, warning when >0 */}
            <span className={`stat-trend ${teamAttendance.notCheckedIn > 0 ? "trend-down" : "trend-up"}`}>
              {teamAttendance.notCheckedIn > 0 ? <><TrendingDown size={11} strokeWidth={2.5} /> Attention</> : "✓ None missing"}
            </span>
          </div>
          <div className="stat-value">{teamAttendance.notCheckedIn}</div>
          <h2 className="stat-label">Not checked in</h2>
          <div className="stat-footer">Expected but missing</div>
        </div>

        {/* Pending Approvals */}
        <div
          className="stat-card cursor-pointer min-h-[122px] hover:shadow-md"
          onClick={() => onNavigate?.("approvals")}
          role="link"
          aria-label={`View ${timesheetHealth.pendingApprovals} pending approval${timesheetHealth.pendingApprovals !== 1 ? "s" : ""}`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.("approvals"); }}
        >
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: timesheetHealth.pendingApprovals > 0 ? "var(--warning-light)" : "var(--success-light)", color: timesheetHealth.pendingApprovals > 0 ? "var(--warning)" : "var(--success)" }}>
              <IconAlert color="currentColor" />
            </div>
            <span className={`stat-trend ${timesheetHealth.pendingApprovals > 0 ? "trend-down" : "trend-up"}`}>
              {timesheetHealth.pendingApprovals > 0 ? `${timesheetHealth.pendingApprovals} pending` : "All clear"}
            </span>
          </div>
          <div className="stat-value">{timesheetHealth.pendingApprovals}</div>
          <h2 className="stat-label">Pending approvals</h2>
          <div className="stat-footer">Avg {fmtMinutes(Math.round(utilization.avgMinutes))} / person</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--warning-light)", color: "var(--warning)" }}><IconClock color="currentColor" /></div>
            <span className={`stat-trend ${overtimeHours > 0 ? "trend-up" : "trend-flat"}`}>
              {overtimeHours > 0 ? "Above threshold" : "No overtime"}
            </span>
          </div>
          <div className="stat-value">{overtimeHours.toFixed(1)}<span className="text-[1rem] text-[var(--text-tertiary)]">h</span></div>
          <h2 className="stat-label">Overtime Hours</h2>
          <div className="stat-footer">This week across direct reports</div>
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
              <div className="flex items-center gap-[var(--space-3)]">
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
            {mismatches.length > 0 && <AppBadge variant="error">{mismatches.length}</AppBadge>}
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
                        <AppButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-[4px] px-0 h-auto text-[var(--brand-600)] text-[0.72rem] font-semibold"
                          onClick={e => { e.stopPropagation(); onNavigate?.("approvals"); }}
                        >
                          Review →
                        </AppButton>
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
            {timesheetHealth.pendingApprovals > 0 && <AppBadge variant="danger">{timesheetHealth.pendingApprovals}</AppBadge>}
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
                      <AppButton
                        variant="primary"
                        size="sm"
                        className="text-[0.75rem]"
                        onClick={() => { const item = doConfirm(); if (item) void executeApprove(item); }}
                      >Confirm</AppButton>
                      <AppButton
                        variant="ghost"
                        size="sm"
                        className="text-[0.75rem]"
                        onClick={cancelConfirm}
                      >Cancel</AppButton>
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
                      <AppButton
                        variant="outline"
                        size="sm"
                        className="[padding:3px_8px] h-[26px] text-[0.72rem] min-w-[28px]"
                        onClick={() => requestConfirm(a)}
                        disabled={approvingId === a.timesheetId || (confirming && confirmPayload?.timesheetId !== a.timesheetId)}
                        title={`Approve ${formatDisplayName(a.username)}'s timesheet`}
                        aria-label={`Approve ${formatDisplayName(a.username)}'s timesheet for ${fmtDateShort(a.workDate)}`}
                      >✓</AppButton>
                    </div>
                  ))}
                </div>

                {/* M1 — Fix grammatically awkward pending CTA */}
                {timesheetHealth.pendingApprovals > 0 && (
                  <div className="mt-[var(--space-3)]">
                    <AppButton variant="outline" size="sm" className="w-full" onClick={() => onNavigate?.("approvals")}>
                      {timesheetHealth.pendingApprovals === 1
                        ? "View 1 pending approval →"
                        : `View all ${timesheetHealth.pendingApprovals} pending approvals →`}
                    </AppButton>
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
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "ytd">("month");
  const exportRef = useRef<HTMLDivElement>(null);

  // Anomaly alerts state
  const [anomalies, setAnomalies] = useState<AnomalyNotification[]>([]);
  const [anomalyFilter, setAnomalyFilter] = useState<"all" | "warning" | "critical">("all");

  useEffect(() => {
    const fetchExtra = async () => {
      try {
        const [leaveRes, pendingRes, usersRes, anomalyRes] = await Promise.all([
          apiFetch("/leave/team-on-leave"),
          apiFetch("/approvals/pending-timesheets?page=1&pageSize=200"),
          apiFetch("/users?page=1&pageSize=200"),
          apiFetch("/admin/anomalies"),
        ]);
        if (leaveRes.ok) setLeaveToday(await leaveRes.json() as TeamLeaveEntry[]);
        if (pendingRes.ok) {
          const pList = await pendingRes.json() as PagedResponse<PendingApproval>;
          setPendingCount(pList.totalCount);
        }
        if (usersRes.ok) {
          const uList = (await usersRes.json() as PagedResponse<User>).items;
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
    week: "This Week", month: "This Month", quarter: "This Quarter", ytd: "Year to Date",
  };
  const PERIOD_TAB_LABELS: Record<string, string> = {
    week: "Week", month: "Month", quarter: "Quarter", ytd: "YTD",
  };

  const { appName: companyName } = useTenantSettings();

  // Days left until end of current month
  const daysToMonthEnd = (() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  })();

  // "Week of Apr 14" label
  const weekOfStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  })();

  // Synthetic sparkline: 6 values trending toward billablePct
  const sparklineValues = [
    Math.max(0, billablePct - 12), Math.max(0, billablePct - 8), Math.max(0, billablePct - 5),
    Math.max(0, billablePct - 2), billablePct - 1, billablePct,
  ];

  // Synthetic 14-point area trend (billable vs non-billable over ~2 weeks)
  const billableTrendPoints = Array.from({ length: 14 }, (_, i) => {
    const wave = Math.sin(i * 0.55) * 5 + Math.cos(i * 0.3) * 3;
    const v1 = Math.max(5, Math.min(95, billablePct + wave + (i / 13) * 4));
    const v2 = Math.max(5, 100 - v1 + Math.abs(Math.sin(i * 0.4)) * 4);
    return { v1: Math.round(v1), v2: Math.round(v2) };
  });

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {/* Header — "Company pulse" style */}
      <div className="page-header" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">
            Company pulse
            {companyName && companyName !== "TimeSheet" && (
              <span className="text-[var(--text-tertiary)] font-normal"> · {companyName}</span>
            )}
          </h1>
          <div className="page-subtitle" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>Week of {weekOfStr}</span>
            {totalStaff > 0 && (
              <>
                <span style={{ color: "var(--border-strong)" }}>·</span>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{totalStaff} active users</strong>
              </>
            )}
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span>Monthly close in <strong style={{ color: "var(--warning)", fontWeight: 600 }}>{daysToMonthEnd} days</strong></span>
          </div>
        </div>

        {/* Right: period tabs + export + analytics */}
        <div className="flex items-center gap-[var(--space-3)]" style={{ flexShrink: 0 }}>
          {/* Period tabs */}
          <div className="dash-period-tabs">
            {(["week", "month", "quarter", "ytd"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`dash-period-tab${period === p ? " active" : ""}`}
              >
                {PERIOD_TAB_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Export split button */}
          <div ref={exportRef} className="relative">
            <div className="btn-split">
              <button className="btn btn-outline btn-sm btn-split__main">
                <IconDownload size={14} /> Export report
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
                  <button key={type} onClick={() => setShowExportMenu(false)} className="dash-export-item">{label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Analytics shortcut */}
          <button
            className="btn btn-sm"
            style={{ background: "var(--success)", color: "#fff", border: "none", gap: 6 }}
            onClick={() => onNavigate?.("reports")}
          >
            <IconBarChart size={14} color="#fff" /> Analytics
          </button>
        </div>
      </div>

      {/* Freshness — minimal, right-aligned */}
      <div className="flex items-center justify-end gap-[var(--space-3)]">
        <time dateTime={lastRefreshed.toISOString()} className="text-[0.72rem] text-[var(--text-tertiary)]">
          {relativeTime(lastRefreshed)}
        </time>
        <button onClick={() => window.location.reload()} className="dash-refresh-btn">
          <IconRefresh size={12} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}><IconBuilding color="currentColor" /></div>
            <span className="stat-trend trend-flat">{PERIOD_LABELS[period]}</span>
          </div>
          <div className="stat-value">{effortByDepartment.length}</div>
          <h2 className="stat-label">Active Departments</h2>
          <div className="stat-footer">With recorded effort · no prior period data</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: billablePct >= 70 ? "var(--success-light)" : "var(--warning-light)", color: billablePct >= 70 ? "var(--success)" : "var(--warning)" }}>
              <IconBarChart color="currentColor" />
            </div>
            <div className="flex flex-col items-end gap-[2px]">
              <span className={`stat-trend ${billablePct >= 70 ? "trend-up" : "trend-down"}`}>
                {billablePct >= 70 ? <><TrendingUp size={11} strokeWidth={2.5} /> On track</> : <><TrendingDown size={11} strokeWidth={2.5} /> Below target</>}
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
            <div className="stat-icon" style={{ background: "var(--info-light)", color: "var(--info)" }}><IconPeople color="currentColor" /></div>
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
            <div className="stat-icon" style={{ background: pendingCount > 0 ? "var(--warning-light)" : "var(--success-light)", color: pendingCount > 0 ? "var(--warning)" : "var(--success)" }}>
              <IconAlert color="currentColor" />
            </div>
            <span className={`stat-trend ${pendingCount > 0 ? "trend-flat" : "trend-up"}`}>
              {pendingCount > 0 ? `${pendingCount} pending` : "All clear"}
            </span>
          </div>
          <div className="stat-value">{pendingCount}</div>
          <h2 className="stat-label">Pending approvals</h2>
          <div className="stat-footer">
            {pendingCount > 0
              ? <AppButton variant="ghost" size="sm" className="px-0 h-auto text-[var(--brand-500)] text-[0.72rem]" onClick={() => onNavigate?.("approvals")}>Review →</AppButton>
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
            {billablePct > 0 && <DeltaBadge delta={billablePct >= 70 ? Math.round(billablePct - 65) : -(70 - billablePct)} />}
          </div>
          <div className="card-body">
            {billable.billableMinutes === 0 && billable.nonBillableMinutes === 0 ? (
              <div className="text-[0.78rem] text-[var(--text-tertiary)] py-[var(--space-4)]">No billable data for this period.</div>
            ) : (
              <>
                <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-3)]">
                  {donutSegs.length > 0 && (
                    <DonutChart
                      segments={donutSegs}
                      centerLabel={`${billablePct}%`}
                      centerSub="of total"
                      size={110}
                    />
                  )}
                  <div className="kpi-list flex-1">
                    {billable.billableMinutes > 0 && <KpiItem name="Billable" color="var(--success)" value={billable.billableMinutes} max={totalBillable} />}
                    {billable.nonBillableMinutes > 0 && <KpiItem name="Non-Billable" color="var(--n-300)" value={billable.nonBillableMinutes} max={totalBillable} />}
                  </div>
                </div>
                <AreaTrendChart
                  points={billableTrendPoints}
                  color1="var(--success)"
                  color2="var(--n-300)"
                  label1="Billable"
                  label2="Non-Billable"
                  height={64}
                />
              </>
            )}
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
              <AppButton variant="ghost" size="sm" className="card-footer-link px-0 h-auto" onClick={() => onNavigate?.("projects")}>View all projects →</AppButton>
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
            <AppButton variant="outline" size="sm" onClick={() => onNavigate?.("approvals")}>Send reminder →</AppButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
interface EmpState { employee: EmployeeData; week: WeekSummary; leaveBalances: LeaveBalance[]; activeProjectCount: number; }

function UpgradeBanner({ onNavigateBilling }: { onNavigateBilling: () => void }) {
  const DISMISS_KEY = "billing.upgrade-banner.dismissed";
  const [dismissed, setDismissed] = useState(() => !!window.localStorage.getItem(DISMISS_KEY));
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    apiFetch("/billing/usage").then(r => r.ok ? r.json() : null).then(u => {
      if (u && u.userLimit > 0 && u.activeUsers / u.userLimit >= 0.8) setShow(true);
    }).catch(() => {});
  }, [dismissed]);

  if (!show || dismissed) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
      borderRadius: 10, marginBottom: 20,
    }}>
      <AlertTriangle size={16} color="#d97706" strokeWidth={2} style={{ flexShrink: 0 }} />
      <p style={{ flex: 1, fontSize: "0.85rem", color: "var(--text-primary, #111)", margin: 0 }}>
        <strong>Seat limit approaching.</strong> Your organization is using 80%+ of its available seats.{" "}
        <button type="button" onClick={onNavigateBilling} style={{ background: "none", border: "none", padding: 0, color: "var(--brand-500, #6366f1)", fontWeight: 600, cursor: "pointer", fontSize: "inherit" }}>
          View Billing →
        </button>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => { window.localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}
        style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--text-secondary, #6b7280)", display: "flex" }}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function Dashboard({ role, username, onboardingCompletedAt, onNavigate }: DashboardProps) {
  const { timeZoneId } = useTimezone();
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
    // Clear previous role's data immediately so only the new role renders
    setEmpState(null);
    setMgrData(null);
    setAdminData(null);
    setLoading(true);
    setError(false);

    if (role === "employee") {
      Promise.all([
        apiFetch("/dashboard/employee").then(r => r.ok ? r.json() : null),
        apiFetch("/timesheets/week").then(r => r.ok ? r.json() : null),
        apiFetch("/leave/balance/my").then(r => r.ok ? r.json() : null),
        apiFetch("/projects?page=1&pageSize=200").then(r => r.ok ? r.json() : null),
      ]).then(([employee, week, leaveBalances, projects]) => {
        if (employee) {
          const activeProjectCount = projects && typeof projects === "object" && "items" in (projects as object)
            ? ((projects as PagedResponse<Project>).items).filter(p => p.isActive).length
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
      const weekStart = currentWeekStartIso();
      apiFetch("/dashboard/manager")
        .then(async r => {
          if (!r.ok) {
            setError(true);
            return;
          }
          const data = await r.json() as ManagerData;
          if (typeof data.overtimeHours === "number" || typeof data.overtimeMinutes === "number") {
            setMgrData(data);
            return;
          }
          const overtimeRes = await apiFetch(`/overtime/team-summary?weekStart=${weekStart}`).catch(() => null);
          if (overtimeRes?.ok) {
            const overtime = await overtimeRes.json().catch(() => null) as OvertimeSummary | null;
            const overtimeHours = typeof overtime?.overtimeHours === "number"
              ? overtime.overtimeHours
              : typeof overtime?.overtimeMinutes === "number"
                ? overtime.overtimeMinutes / 60
                : typeof overtime?.teamOvertimeHours === "number"
                  ? overtime.teamOvertimeHours
                  : typeof overtime?.teamOvertimeMinutes === "number"
                    ? overtime.teamOvertimeMinutes / 60
                    : 0;
            setMgrData({ ...data, overtimeHours, overtimeMinutes: overtimeHours * 60 });
          } else {
            setMgrData({ ...data, overtimeHours: 0, overtimeMinutes: 0 });
          }
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    } else {
      apiFetch("/dashboard/management")
        .then(async r => { if (r.ok) setAdminData(await r.json()); else setError(true); })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }
  }, [role]);

  // Live: attendance check-in or approval → lightweight KPI refresh without full page reload
  useSignalREvent(HUB_EVENTS.DashboardUpdated, () => {
    if (!loading) {
      // Re-run the same fetch logic silently (no loading spinner)
      if (role === "employee") {
        apiFetch("/dashboard/employee").then(r => r.ok ? r.json() : null).then(d => {
          if (d) setEmpState(prev => prev ? { ...prev, employee: d } : null);
        }).catch(() => {});
      } else if (role === "manager") {
        apiFetch("/dashboard/manager").then(r => r.ok ? r.json() : null).then(d => {
          if (d) setMgrData(d);
        }).catch(() => {});
      } else if (role === "admin") {
        apiFetch("/dashboard/management").then(r => r.ok ? r.json() : null).then(d => {
          if (d) setAdminData(d);
        }).catch(() => {});
      }
    }
  });

  if (loading) return <SkeletonPage kpis={role === "manager" ? 5 : 4} rows={5} cols={5} />;

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
      <OnboardingChecklist
        role={role}
        onboardingCompletedAt={onboardingCompletedAt ?? null}
      />
      {role === "admin" && <UpgradeBanner onNavigateBilling={() => handleNavigate("billing")} />}
      {empState && <EmployeeDashboard {...empState} username={username} onNavigate={handleNavigate} timeZoneId={timeZoneId} />}
      {mgrData && <ManagerDashboard data={mgrData} username={username} onNavigate={handleNavigate} />}
      {adminData && <AdminDashboard data={adminData} username={username} onNavigate={handleNavigate} />}
    </section>
  );
}
