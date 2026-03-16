/**
 * Reports.tsx — PulseHQ v3.0 — Workforce Reporting
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import type { ReportKey } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────
type PagedResponse = { page: number; pageSize: number; total: number; items: Record<string, unknown>[] };
type SortDir = "asc" | "desc";
type ColFormat = "minutes" | "date" | "datetime" | "status" | "bool" | "util-bar" | "balance-bar" | "delta" | "leave-days";
type ColConfig = { key: string; label: string; hidden?: boolean; format?: ColFormat; sortable?: boolean; align?: "right"; primary?: boolean };
type KpiCard = { label: string; value: string; sub?: string; accent?: "red" | "amber" | "green" };

// ── Column definitions ────────────────────────────────────────────────────────
const REPORT_COLS: Record<ReportKey, ColConfig[]> = {
  "attendance-summary": [
    { key: "userId",            label: "User ID",       hidden: true },
    { key: "username",          label: "Employee",      sortable: true, primary: true },
    { key: "workDate",          label: "Date",          format: "date", sortable: true },
    { key: "attendanceMinutes", label: "Hours Present", format: "minutes", sortable: true, align: "right", primary: true },
    { key: "breakMinutes",      label: "Break Duration",format: "minutes", align: "right" },
    { key: "hasException",      label: "Exception",     format: "bool" },
  ],
  "timesheet-summary": [
    { key: "userId",            label: "User ID",       hidden: true },
    { key: "username",          label: "Employee",      sortable: true, primary: true },
    { key: "workDate",          label: "Date",          format: "date", sortable: true },
    { key: "status",            label: "Status",        format: "status", sortable: true },
    { key: "enteredMinutes",    label: "Hours Entered", format: "minutes", sortable: true, align: "right", primary: true },
    { key: "attendanceMinutes", label: "Hours Present", format: "minutes", align: "right" },
    { key: "hasMismatch",       label: "Mismatch",      format: "bool" },
  ],
  "project-effort": [
    { key: "projectId",           label: "Project ID",  hidden: true },
    { key: "projectName",         label: "Project",     sortable: true, primary: true },
    { key: "projectCode",         label: "Code" },
    { key: "totalMinutes",        label: "Total Hours", format: "minutes", sortable: true, align: "right", primary: true },
    { key: "distinctContributors",label: "Contributors",sortable: true, align: "right" },
  ],
  "leave-utilization": [
    { key: "userId",             label: "User ID",       hidden: true },
    { key: "username",           label: "Employee",      sortable: true, primary: true },
    { key: "leaveDays",          label: "Leave Days",    format: "leave-days", sortable: true, align: "right" },
    { key: "halfDays",           label: "Half Days",     format: "leave-days", align: "right" },
    { key: "timesheetMinutes",   label: "Hours Worked",  format: "minutes", sortable: true, align: "right", primary: true },
    { key: "utilizationPercent", label: "Utilization %", format: "util-bar", sortable: true },
  ],
  "leave-balance": [
    { key: "userId",        label: "User ID",    hidden: true },
    { key: "username",      label: "Employee",   sortable: true, primary: true },
    { key: "leaveTypeName", label: "Leave Type", sortable: true },
    { key: "allocatedDays", label: "Allocated",  format: "leave-days", align: "right" },
    { key: "usedDays",      label: "Used",       format: "leave-days", align: "right" },
    { key: "remainingDays", label: "Remaining",  format: "balance-bar", sortable: true },
  ],
  "timesheet-approval-status": [
    { key: "userId",             label: "User ID",       hidden: true },
    { key: "username",           label: "Employee",      sortable: true, primary: true },
    { key: "workDate",           label: "Date",          format: "date", sortable: true },
    { key: "enteredMinutes",     label: "Hours Entered", format: "minutes", sortable: true, align: "right", primary: true },
    { key: "status",             label: "Status",        format: "status", sortable: true },
    { key: "approvedByUsername", label: "Approved By" },
    { key: "approvedAtUtc",      label: "Approved At",   format: "datetime" },
  ],
  "overtime-deficit": [
    { key: "userId",        label: "User ID", hidden: true },
    { key: "username",      label: "Employee",sortable: true, primary: true },
    { key: "weekStart",     label: "Week Of", format: "date", sortable: true },
    { key: "targetMinutes", label: "Target",  format: "minutes", align: "right", hidden: true },
    { key: "loggedMinutes", label: "Logged",  format: "minutes", sortable: true, align: "right", primary: true },
    { key: "deltaMinutes",  label: "Delta",   format: "delta", sortable: true, align: "right" },
  ],
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS: { key: ReportKey; label: string }[] = [
  { key: "attendance-summary",        label: "Attendance" },
  { key: "timesheet-summary",         label: "Timesheets" },
  { key: "project-effort",            label: "Project Effort" },
  { key: "leave-utilization",         label: "Leave Usage" },
  { key: "leave-balance",             label: "Leave Balance" },
  { key: "timesheet-approval-status", label: "Approvals" },
  { key: "overtime-deficit",          label: "Overtime / Deficit" },
];

const PAGE_SIZES = [10, 25, 50, 100];

// ── Date helpers ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtMins(m: number): string {
  if (m === 0) return "0h";
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const min = abs % 60;
  const sign = m < 0 ? "-" : "";
  return min === 0 ? `${sign}${h}h` : `${sign}${h}h ${min}m`;
}

function fmtDateStr(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusChip(status: string): ReactNode {
  const s = status.toLowerCase();
  const styles: Record<string, React.CSSProperties> = {
    approved:  { background: "#d1fae5", color: "#065f46" },
    submitted: { background: "#dbeafe", color: "#1e40af" },
    pending:   { background: "#fef3c7", color: "#92400e" },
    rejected:  { background: "#fee2e2", color: "#991b1b" },
    draft:     { background: "#f3f4f6", color: "#4b5563" },
  };
  return (
    <span style={{
      ...(styles[s] ?? { background: "#f3f4f6", color: "#4b5563" }),
      fontSize: "0.72rem", fontWeight: 700, borderRadius: 6,
      padding: "2px 8px", textTransform: "capitalize", display: "inline-block", whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

function boolChip(isTrue: boolean): ReactNode {
  return (
    <span style={{
      background: isTrue ? "#fee2e2" : "#d1fae5",
      color: isTrue ? "#991b1b" : "#065f46",
      fontSize: "0.72rem", fontWeight: 700, borderRadius: 6,
      padding: "2px 8px", display: "inline-block",
    }}>
      {isTrue ? "Yes" : "No"}
    </span>
  );
}

// ── Attendance aggregation (sum per employee+date) ────────────────────────────
function aggregateAttendance(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of items) {
    const key = `${String(row.username)}|${String(row.workDate)}`;
    if (map.has(key)) {
      const ex = map.get(key)!;
      ex.attendanceMinutes = (Number(ex.attendanceMinutes) || 0) + (Number(row.attendanceMinutes) || 0);
      ex.breakMinutes = (Number(ex.breakMinutes) || 0) + (Number(row.breakMinutes) || 0);
      if (row.hasException === true || String(row.hasException).toLowerCase() === "true") ex.hasException = true;
    } else {
      map.set(key, { ...row });
    }
  }
  return Array.from(map.values());
}

// ── Cell renderer ─────────────────────────────────────────────────────────────
function renderCell(col: ColConfig, row: Record<string, unknown>): ReactNode {
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return <span style={{ color: "#9ca3af" }}>—</span>;

  const primaryStyle: React.CSSProperties = col.primary ? { color: "rgb(16,16,26)", fontWeight: 500 } : {};

  switch (col.format) {
    case "minutes":
      return <span style={{ fontVariantNumeric: "tabular-nums", ...primaryStyle }}>{fmtMins(Number(v))}</span>;

    case "leave-days":
      return <span style={{ fontVariantNumeric: "tabular-nums" }}>{Number(v)}d</span>;

    case "date":
      return fmtDateStr(String(v));

    case "datetime": {
      const d = new Date(String(v));
      const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      return (
        <span title={`${dateStr} ${timeStr}`}>
          <span style={{ display: "block", fontWeight: 500, color: "rgb(16,16,26)" }}>{dateStr}</span>
          <span style={{ display: "block", fontSize: "0.72rem", color: "#9ca3af", marginTop: 1 }}>{timeStr}</span>
        </span>
      );
    }

    case "status":
      return statusChip(String(v));

    case "bool": {
      const b = v === true || String(v).toLowerCase() === "true";
      return boolChip(b);
    }

    case "util-bar": {
      const pct = Math.min(100, Math.max(0, Number(v)));
      const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 72, height: 5, background: "#e5e7eb", borderRadius: 99, flexShrink: 0 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        </div>
      );
    }

    case "balance-bar": {
      const remaining = Number(v);
      const allocated = Number(row.allocatedDays) || remaining || 1;
      const pct = Math.min(100, Math.round((remaining / allocated) * 100));
      const color = pct >= 50 ? "#10b981" : pct >= 20 ? "#f59e0b" : "#ef4444";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ minWidth: 90, height: 5, background: "#e5e7eb", borderRadius: 99, flexShrink: 0 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>{remaining}d</span>
        </div>
      );
    }

    case "delta": {
      const m = Number(v);
      const label = m === 0 ? "On target" : (m > 0 ? "+" : "") + fmtMins(m);
      const color = m > 0 ? "#10b981" : m < 0 ? "#ef4444" : "#6b7280";
      return <span style={{ color, fontWeight: 700, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>{label}</span>;
    }

    default:
      return col.primary
        ? <span style={primaryStyle}>{String(v)}</span>
        : String(v);
  }
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span style={{ opacity: 0.45, fontSize: "0.7rem", marginLeft: 3 }}>↕</span>;
  return <span style={{ fontSize: "0.75rem", marginLeft: 3, color: "var(--brand-600,#4f46e5)" }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

// ── KPI computation ───────────────────────────────────────────────────────────
function computeKpi(key: ReportKey, items: Record<string, unknown>[]): KpiCard[] {
  if (items.length === 0) return [];
  const n = items.length;

  switch (key) {
    case "attendance-summary": {
      const agg = aggregateAttendance(items);
      const totalMins = agg.reduce((s, r) => s + (Number(r.attendanceMinutes) || 0), 0);
      const exCount = agg.filter(r => r.hasException === true || String(r.hasException).toLowerCase() === "true").length;
      return [
        { label: "Days Tracked", value: String(agg.length) },
        { label: "Total Present", value: fmtMins(totalMins) },
        { label: "Avg / Day", value: fmtMins(agg.length > 0 ? Math.round(totalMins / agg.length) : 0) },
        { label: "Exceptions", value: String(exCount), sub: `${agg.length > 0 ? Math.round(exCount * 100 / agg.length) : 0}%`, accent: exCount > 0 ? "amber" : undefined },
      ];
    }
    case "timesheet-summary": {
      const approved = items.filter(r => String(r.status).toLowerCase() === "approved").length;
      const totalMins = items.reduce((s, r) => s + (Number(r.enteredMinutes) || 0), 0);
      const mismatches = items.filter(r => r.hasMismatch === true || String(r.hasMismatch).toLowerCase() === "true").length;
      return [
        { label: "Timesheets", value: String(n) },
        { label: "Approved", value: String(approved), sub: `${Math.round(approved * 100 / n)}%` },
        { label: "Avg Hours", value: fmtMins(Math.round(totalMins / n)) },
        { label: "Mismatches", value: String(mismatches), accent: mismatches > 0 ? "amber" : undefined },
      ];
    }
    case "project-effort": {
      const totalMins = items.reduce((s, r) => s + (Number(r.totalMinutes) || 0), 0);
      const avgContrib = Math.round(items.reduce((s, r) => s + (Number(r.distinctContributors) || 0), 0) / n);
      const top = [...items].sort((a, b) => (Number(b.totalMinutes) || 0) - (Number(a.totalMinutes) || 0))[0];
      return [
        { label: "Projects", value: String(n) },
        { label: "Total Hours", value: fmtMins(totalMins) },
        { label: "Avg Contributors", value: String(avgContrib) },
        { label: "Top Project", value: String(top?.projectName ?? "—"), sub: fmtMins(Number(top?.totalMinutes) || 0) },
      ];
    }
    case "leave-utilization": {
      const totalLeave = items.reduce((s, r) => s + (Number(r.leaveDays) || 0), 0);
      const avgUtil = (items.reduce((s, r) => s + (Number(r.utilizationPercent) || 0), 0) / n).toFixed(1);
      const totalHours = items.reduce((s, r) => s + (Number(r.timesheetMinutes) || 0), 0);
      return [
        { label: "Employees", value: String(n) },
        { label: "Total Leave Days", value: `${totalLeave}d` },
        { label: "Avg Utilization", value: `${avgUtil}%` },
        { label: "Total Hours Worked", value: fmtMins(totalHours) },
      ];
    }
    case "leave-balance": {
      const distinctUsers = new Set(items.map(r => r.username)).size;
      const avgRemaining = Math.round(items.reduce((s, r) => s + (Number(r.remainingDays) || 0), 0) / n);
      const zeroBalance = items.filter(r => (Number(r.remainingDays) || 0) <= 0 && (Number(r.allocatedDays) || 0) > 0).length;
      return [
        { label: "Employees", value: String(distinctUsers) },
        { label: "Avg Remaining", value: `${avgRemaining}d` },
        { label: "Zero Balance", value: String(zeroBalance), sub: "allocations exhausted", accent: zeroBalance > 0 ? "red" : undefined },
        { label: "Allocations", value: String(n) },
      ];
    }
    case "timesheet-approval-status": {
      const approved = items.filter(r => String(r.status).toLowerCase() === "approved").length;
      const pending = items.filter(r => String(r.status).toLowerCase() === "submitted").length;
      const totalMins = items.reduce((s, r) => s + (Number(r.enteredMinutes) || 0), 0);
      return [
        { label: "Total", value: String(n) },
        { label: "Approved", value: String(approved), sub: `${Math.round(approved * 100 / n)}%`, accent: "green" },
        { label: "Pending Review", value: String(pending), sub: "awaiting approval", accent: pending > 0 ? "amber" : undefined },
        { label: "Avg Hours", value: fmtMins(Math.round(totalMins / n)) },
      ];
    }
    case "overtime-deficit": {
      const otCount = items.filter(r => (Number(r.deltaMinutes) || 0) > 0).length;
      const defCount = items.filter(r => (Number(r.deltaMinutes) || 0) < 0).length;
      const netDelta = items.reduce((s, r) => s + (Number(r.deltaMinutes) || 0), 0);
      const avgTarget = n > 0 ? Math.round(items.reduce((s, r) => s + (Number(r.targetMinutes) || 0), 0) / n) : 0;
      return [
        { label: "Weeks Tracked", value: String(n), sub: `vs. ${fmtMins(avgTarget)} avg target/wk` },
        { label: "Overtime Weeks", value: String(otCount), sub: "above target", accent: otCount > 0 ? "green" : undefined },
        { label: "Deficit Weeks", value: String(defCount), sub: "below target", accent: defCount > 0 ? "amber" : undefined },
        { label: "Net Delta", value: fmtMins(netDelta), accent: netDelta < 0 ? "red" : netDelta > 0 ? "green" : undefined },
      ];
    }
    default:
      return [];
  }
}

// ── Page CSS ──────────────────────────────────────────────────────────────────
const PAGE_STYLES = `
.rpt-tabs-row { display: flex; align-items: center; gap: 4px; }
.rpt-tabs { display: flex; gap: 4px; overflow-x: auto; flex: 1;
  scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 2px; }
.rpt-tabs::-webkit-scrollbar { display: none; }
.rpt-tab { padding: 7px 16px; border-radius: 8px; border: 1px solid transparent; background: none;
  cursor: pointer; font-size: 0.8rem; font-weight: 500; color: var(--text-secondary, #6b7280);
  transition: all .15s; white-space: nowrap; }
.rpt-tab:hover { background: var(--n-50, #f9fafb); color: var(--text-primary, #111827); }
.rpt-tab--active { background: var(--brand-600, #4f46e5); color: #fff; border-color: var(--brand-600, #4f46e5); }
.rpt-tab-arrow { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e5e7eb;
  background: #fff; cursor: pointer; font-size: 1rem; color: #6b7280; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; padding: 0; }
.rpt-tab-arrow:hover { background: #f9fafb; color: #111827; border-color: #d1d5db; }
.rpt-filter-bar { display: flex; align-items: flex-end; gap: var(--space-4, 16px); flex-wrap: wrap; }
.rpt-kpi-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-4, 16px); }
.rpt-kpi-card { background: var(--surface-card, #fff); border: 1px solid var(--n-200, #e5e7eb);
  border-left-width: 3px; border-radius: 12px; padding: 16px 20px; }
.rpt-kpi-card--red    { border-left-color: #ef4444; }
.rpt-kpi-card--amber  { border-left-color: #f59e0b; }
.rpt-kpi-card--green  { border-left-color: #10b981; }
.rpt-kpi-card--none   { border-left-color: var(--n-200, #e5e7eb); }
.rpt-kpi-value { font-size: 1.45rem; font-weight: 700; color: rgb(16,16,26); line-height: 1; margin-bottom: 5px; }
.rpt-kpi-label { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #6b7280); text-transform: uppercase; letter-spacing: .05em; }
.rpt-kpi-sub { font-size: 0.72rem; color: var(--text-tertiary, #9ca3af); margin-top: 2px; }
.rpt-th-sort { cursor: pointer; user-select: none; white-space: nowrap; }
.rpt-th-sort:hover { color: var(--brand-600, #4f46e5); }
.rpt-table-outer { position: relative; overflow: hidden; }
.rpt-table-outer::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: 28px;
  background: linear-gradient(to right, transparent, var(--surface-card, #fff));
  pointer-events: none; z-index: 1; }
.rpt-table-outer table tbody tr:hover { background: rgba(99,102,241,0.04); }
.rpt-pagination { display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  border-top: 1px solid var(--n-200, #e5e7eb); flex-wrap: wrap; }
.rpt-showing { font-size: 0.8rem; color: var(--text-secondary, #6b7280); flex: 1; }
.rpt-page-controls { display: flex; align-items: center; gap: 8px; }
.rpt-page-info { font-size: 0.825rem; color: var(--text-secondary, #6b7280); }
.rpt-freshness { font-size: 0.72rem; color: var(--text-tertiary, #9ca3af); margin-left: 8px; }
.rpt-zero-alloc { opacity: 0.4; }
.rpt-tabs-select { display: none; width: 100%; }
@media (max-width: 640px) {
  .rpt-tabs-row { display: none; }
  .rpt-tabs-select { display: block; }
}
`;

// ── Component ─────────────────────────────────────────────────────────────────
export function Reports() {
  const [reportKey, setReportKey] = useState<ReportKey>("attendance-summary");
  const [data, setData] = useState<PagedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(getMonthStart);
  const [toDate, setToDate] = useState(today);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  function scrollTabs(dir: -1 | 1) {
    tabsRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  }

  function buildUrl(key: ReportKey, pg: number, ps: number) {
    const params = new URLSearchParams({ page: String(pg), pageSize: String(ps) });
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    return `/reports/${key}?${params.toString()}`;
  }

  async function loadReport(key: ReportKey, pg = 1, ps = pageSize) {
    setLoading(true);
    const r = await apiFetch(buildUrl(key, pg, ps));
    if (r.ok) {
      const d = await r.json() as PagedResponse;
      setData(d);
      setPage(pg);
      setLastLoaded(new Date());
    }
    setLoading(false);
  }

  useEffect(() => { void loadReport(reportKey, 1); }, []);

  function switchTab(key: ReportKey) {
    setReportKey(key);
    setSortCol(null);
    setSearch("");
    setEmployeeFilter("");
    void loadReport(key, 1);
  }

  function changePageSize(ps: number) {
    setPageSize(ps);
    void loadReport(reportKey, 1, ps);
  }

  async function exportReport(format: "csv" | "excel" | "pdf") {
    const params = new URLSearchParams({ format });
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    const r = await apiFetch(`/reports/${reportKey}/export?${params.toString()}`);
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ext = format === "excel" ? "xlsx" : format;
    a.href = url; a.download = `${reportKey}-${today}.${ext}`; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSort(key: string) {
    if (sortCol === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(key); setSortDir("asc"); }
  }

  const cols = REPORT_COLS[reportKey].filter(c => !c.hidden);
  const rawItems = data?.items ?? [];

  // Aggregate attendance rows by employee+date
  const items = reportKey === "attendance-summary" ? aggregateAttendance(rawItems) : rawItems;

  // Unique employee names for filter dropdown (from current page)
  const uniqueEmployees = Array.from(new Set(items.map(r => String(r.username ?? "")).filter(Boolean))).sort();

  const filtered = items
    .filter(row => !employeeFilter || String(row.username) === employeeFilter)
    .filter(row => !search.trim() || Object.values(row).some(v => String(v ?? "").toLowerCase().includes(search.toLowerCase())));

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const cmp = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  const totalFromApi = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFromApi / pageSize));
  const showStart = (page - 1) * pageSize + 1;
  const showEnd = Math.min(page * pageSize, totalFromApi);
  const showingText = totalFromApi === 0
    ? "No records"
    : search.trim() || employeeFilter
      ? `${sorted.length} of ${totalFromApi} records (filtered)`
      : `Showing ${showStart}–${showEnd} of ${totalFromApi}`;

  const kpis = computeKpi(reportKey, items);

  const freshnessLabel = lastLoaded ? (() => {
    const diff = Math.floor((Date.now() - lastLoaded.getTime()) / 1000);
    if (diff < 60) return "Updated just now";
    if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
    return `Updated ${Math.floor(diff / 3600)}h ago`;
  })() : "";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <style>{PAGE_STYLES}</style>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Workforce analytics and data exports</div>
        </div>
      </div>

      {/* Mobile tab select */}
      <select
        className="input-field rpt-tabs-select"
        value={reportKey}
        onChange={(e) => switchTab(e.target.value as ReportKey)}
      >
        {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>

      {/* Tab strip with scroll arrows */}
      <div className="rpt-tabs-row">
        <button className="rpt-tab-arrow" onClick={() => scrollTabs(-1)} aria-label="Scroll tabs left">‹</button>
        <div className="rpt-tabs" ref={tabsRef}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`rpt-tab${reportKey === t.key ? " rpt-tab--active" : ""}`}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="rpt-tab-arrow" onClick={() => scrollTabs(1)} aria-label="Scroll tabs right">›</button>
      </div>

      {/* Filter bar */}
      <div className="card-flat rpt-filter-bar">
        <div className="form-field">
          <label className="form-label" htmlFor="rpt-from">From Date</label>
          <input id="rpt-from" type="date" className="input-field" value={fromDate}
            onChange={e => setFromDate(e.target.value)} max={toDate || today} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="rpt-to">To Date</label>
          <input id="rpt-to" type="date" className="input-field" value={toDate}
            onChange={e => setToDate(e.target.value)} min={fromDate} max={today} />
        </div>
        {uniqueEmployees.length > 0 && (
          <div className="form-field" style={{ minWidth: 180 }}>
            <label className="form-label" htmlFor="rpt-emp">Employee</label>
            <select id="rpt-emp" className="input-field" value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}>
              <option value="">All employees</option>
              {uniqueEmployees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => void loadReport(reportKey, 1)}>Apply</button>
      </div>

      {/* KPI strip */}
      {kpis.length > 0 && !loading && (
        <div className="rpt-kpi-strip">
          {kpis.map(k => (
            <div key={k.label} className={`rpt-kpi-card rpt-kpi-card--${k.accent ?? "none"}`}>
              <div className="rpt-kpi-value">{k.value}</div>
              <div className="rpt-kpi-label">{k.label}</div>
              {k.sub && <div className="rpt-kpi-sub">{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Table card */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">{TABS.find(t => t.key === reportKey)?.label}</div>
            <div className="card-subtitle">
              {loading ? "Loading…" : `${totalFromApi} records`}
              {!loading && freshnessLabel && <span className="rpt-freshness">{freshnessLabel}</span>}
            </div>
          </div>
          <div className="page-actions">
            <input
              type="text"
              className="input-field"
              placeholder="Search rows…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200, height: 30, fontSize: "0.8rem" }}
            />
            <div style={{ position: "relative", display: "inline-block" }}>
              <button className="btn btn-outline btn-sm" onClick={() => setExportOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export ▾
              </button>
              {exportOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setExportOpen(false)} />
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "var(--n-0)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-md)", zIndex: 100, minWidth: 130, padding: "4px 0" }}>
                    {(["csv", "excel", "pdf"] as const).map(fmt => (
                      <button key={fmt}
                        style={{ display: "block", padding: "8px 16px", fontSize: "0.825rem", cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--n-50)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        onClick={() => { void exportReport(fmt); setExportOpen(false); }}>
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state__icon">⏳</div>
              <p className="empty-state__title">Loading report…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="rpt-table-outer">
              <div className="table-wrap">
                <table className="table-base">
                  <thead>
                    <tr>
                      {cols.map(c => (
                        <th
                          key={c.key}
                          className={c.sortable ? "rpt-th-sort" : ""}
                          style={c.align === "right" ? { textAlign: "right" } : undefined}
                          aria-sort={c.sortable ? (sortCol === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined}
                          onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                        >
                          {c.label}
                          {c.sortable && <SortIcon active={sortCol === c.key} dir={sortDir} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => {
                      const isZeroAlloc = reportKey === "leave-balance" && Number(row.allocatedDays) === 0;
                      return (
                        <tr key={i} className={isZeroAlloc ? "rpt-zero-alloc" : undefined}>
                          {cols.map(c => (
                            <td key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>
                              {renderCell(c, row)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr className="empty-row">
                        <td colSpan={cols.length}>No data for this report.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination footer */}
            <div className="rpt-pagination">
              <span className="rpt-showing">{showingText}</span>
              <div className="rpt-page-controls">
                <select
                  className="input-field"
                  style={{ width: "auto", fontSize: "0.8rem", padding: "4px 8px", height: "auto" }}
                  value={pageSize}
                  onChange={e => changePageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                >
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1}
                  onClick={() => void loadReport(reportKey, page - 1)}>← Prev</button>
                <span className="rpt-page-info">Page {page} of {totalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages}
                  onClick={() => void loadReport(reportKey, page + 1)}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
