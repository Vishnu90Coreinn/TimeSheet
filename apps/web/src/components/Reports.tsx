/**
 * Reports.tsx — PulseHQ v3.0 — Workforce Reporting
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { SkeletonPage } from "./Skeleton";
import { EmptyReports } from "./EmptyState";
import type { ReportKey, SavedReport, SavedReportPayload } from "../types";
import { AppButton, AppInput, AppSelect, AppTableShell } from "./ui";

// ── Types ─────────────────────────────────────────────────────────────────────
type PagedResponse = { page: number; pageSize: number; total: number; items: Record<string, unknown>[] };
type SortDir = "asc" | "desc";
type ColFormat = "minutes" | "date" | "datetime" | "status" | "bool" | "util-bar" | "balance-bar" | "delta" | "leave-days";
type ColConfig = { key: string; label: string; hidden?: boolean; format?: ColFormat; sortable?: boolean; align?: "right"; primary?: boolean };
type KpiCard = { label: string; value: string; sub?: string; accent?: "red" | "amber" | "green" };
type DatePreset = "7d" | "30d" | "thisMonth" | "lastMonth" | "custom";

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const cls: Record<string, string> = {
    approved:  "bg-[#d1fae5] text-[#065f46]",
    submitted: "bg-[#dbeafe] text-[#1e40af]",
    pending:   "bg-[#fef3c7] text-[#92400e]",
    rejected:  "bg-[#fee2e2] text-[#991b1b]",
    draft:     "bg-[#f3f4f6] text-[#4b5563]",
  };
  return (
    <span className={`${cls[s] ?? "bg-[#f3f4f6] text-[#4b5563]"} text-[0.72rem] font-bold rounded-[6px] px-2 py-[2px] capitalize inline-block whitespace-nowrap`}>
      {status}
    </span>
  );
}

function boolChip(isTrue: boolean): ReactNode {
  return (
    <span className={`${isTrue ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#d1fae5] text-[#065f46]"} text-[0.72rem] font-bold rounded-[6px] px-2 py-[2px] inline-block`}>
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
  if (v === null || v === undefined || v === "") return <span className="text-[#9ca3af]">—</span>;

  const primaryCls = col.primary ? "text-[rgb(16,16,26)] font-medium" : "";

  switch (col.format) {
    case "minutes":
      return <span className={`[font-variant-numeric:tabular-nums] ${primaryCls}`}>{fmtMins(Number(v))}</span>;

    case "leave-days":
      return <span className="[font-variant-numeric:tabular-nums]">{Number(v)}d</span>;

    case "date":
      return fmtDateStr(String(v));

    case "datetime": {
      const d = new Date(String(v));
      const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      return (
        <span title={`${dateStr} ${timeStr}`}>
          <span className="block font-medium text-[rgb(16,16,26)]">{dateStr}</span>
          <span className="block text-[0.72rem] text-[#9ca3af] mt-[1px]">{timeStr}</span>
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
        <div className="flex items-center gap-[6px]">
          <div className="w-[72px] h-[5px] bg-[#e5e7eb] rounded-full shrink-0">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="text-[0.8rem] text-text-secondary [font-variant-numeric:tabular-nums]">{pct}%</span>
        </div>
      );
    }

    case "balance-bar": {
      const remaining = Number(v);
      const allocated = Number(row.allocatedDays) || remaining || 1;
      const pct = Math.min(100, Math.round((remaining / allocated) * 100));
      const color = pct >= 50 ? "#10b981" : pct >= 20 ? "#f59e0b" : "#ef4444";
      return (
        <div className="flex items-center gap-[6px]">
          <div className="min-w-[90px] h-[5px] bg-[#e5e7eb] rounded-full shrink-0">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="text-[0.8rem] [font-variant-numeric:tabular-nums]">{remaining}d</span>
        </div>
      );
    }

    case "delta": {
      const m = Number(v);
      const label = m === 0 ? "On target" : (m > 0 ? "+" : "") + fmtMins(m);
      const color = m > 0 ? "#10b981" : m < 0 ? "#ef4444" : "#6b7280";
      return <span className="font-bold text-[0.8rem] [font-variant-numeric:tabular-nums]" style={{ color }}>{label}</span>;
    }

    default:
      return col.primary
        ? <span className={primaryCls}>{String(v)}</span>
        : String(v);
  }
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="opacity-[0.45] text-[0.7rem] ml-[3px]">↕</span>;
  return <span className="text-[0.75rem] ml-[3px] text-brand-600">{dir === "asc" ? "↑" : "↓"}</span>;
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

// ── Schedule description helper ───────────────────────────────────────────────
function scheduleDesc(r: SavedReport): string {
  if (r.scheduleType === "None") return "No schedule";
  if (r.scheduleType === "Weekly") {
    const day = DAY_NAMES[r.scheduleDayOfWeek ?? 1] ?? "Monday";
    return `Weekly on ${day} at ${String(r.scheduleHour).padStart(2, "0")}:00`;
  }
  return `Monthly on 1st at ${String(r.scheduleHour).padStart(2, "0")}:00`;
}

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

  // ── Saved Reports state ────────────────────────────────────────────────────
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveSchedule, setSaveSchedule] = useState<"None" | "Weekly" | "Monthly">("None");
  const [saveDay, setSaveDay] = useState(1); // Monday
  const [saveHour, setSaveHour] = useState(8);
  const [saveEmails, setSaveEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [editingReport, setEditingReport] = useState<SavedReport | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");

  function applyDatePreset(preset: DatePreset) {
    const d = new Date();
    const todayStr = d.toISOString().slice(0, 10);
    if (preset === "7d") {
      const f = new Date(d); f.setDate(d.getDate() - 6);
      setFromDate(f.toISOString().slice(0, 10)); setToDate(todayStr);
    } else if (preset === "30d") {
      const f = new Date(d); f.setDate(d.getDate() - 29);
      setFromDate(f.toISOString().slice(0, 10)); setToDate(todayStr);
    } else if (preset === "thisMonth") {
      setFromDate(getMonthStart()); setToDate(todayStr);
    } else if (preset === "lastMonth") {
      const y = d.getFullYear(), m = d.getMonth();
      const ls = new Date(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1);
      const le = new Date(y, m, 0);
      setFromDate(ls.toISOString().slice(0, 10)); setToDate(le.toISOString().slice(0, 10));
    }
    setDatePreset(preset);
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

  async function loadSavedReports() {
    const r = await apiFetch("/reports/saved");
    if (r.ok) {
      const d = await r.json() as SavedReport[];
      setSavedReports(d);
    }
  }

  useEffect(() => { void loadReport(reportKey, 1); }, []);
  useEffect(() => { void loadSavedReports(); }, []);

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

  function buildFiltersJson() {
    return JSON.stringify({ fromDate, toDate });
  }

  function openSaveModal(report?: SavedReport) {
    if (report) {
      setEditingReport(report);
      setSaveName(report.name);
      setSaveSchedule(report.scheduleType);
      setSaveDay(report.scheduleDayOfWeek ?? 1);
      setSaveHour(report.scheduleHour);
      setSaveEmails(report.recipientEmails ?? []);
    } else {
      setEditingReport(null);
      setSaveName("");
      setSaveSchedule("None");
      setSaveDay(1);
      setSaveHour(8);
      setSaveEmails([]);
    }
    setEmailInput("");
    setShowSaveModal(true);
  }

  function closeSaveModal() {
    setShowSaveModal(false);
    setEditingReport(null);
  }

  function addEmail() {
    const email = emailInput.trim();
    if (email && !saveEmails.includes(email)) {
      setSaveEmails(prev => [...prev, email]);
    }
    setEmailInput("");
  }

  function removeEmail(email: string) {
    setSaveEmails(prev => prev.filter(e => e !== email));
  }

  async function handleSaveReport() {
    if (!saveName.trim()) return;
    setSaveLoading(true);
    const payload: SavedReportPayload = {
      name: saveName.trim(),
      reportKey: editingReport ? editingReport.reportKey : reportKey,
      filtersJson: editingReport ? editingReport.filtersJson : buildFiltersJson(),
      scheduleType: saveSchedule,
      scheduleDayOfWeek: saveSchedule === "Weekly" ? saveDay : null,
      scheduleHour: saveHour,
      recipientEmails: saveEmails,
    };
    let r: Response;
    if (editingReport) {
      r = await apiFetch(`/reports/saved/${editingReport.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      r = await apiFetch("/reports/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    if (r.ok) {
      await loadSavedReports();
      closeSaveModal();
    }
    setSaveLoading(false);
  }

  function applyFilters(filtersJson: string) {
    try {
      const filters = JSON.parse(filtersJson) as { fromDate?: string; toDate?: string };
      if (filters.fromDate) setFromDate(filters.fromDate);
      if (filters.toDate) setToDate(filters.toDate);
    } catch {
      // ignore malformed JSON
    }
  }

  function loadSavedReportFilters(report: SavedReport) {
    setReportKey(report.reportKey as ReportKey);
    applyFilters(report.filtersJson);
    setShowSavedDropdown(false);
    setSortCol(null);
    setSearch("");
    setEmployeeFilter("");
  }

  async function deleteSavedReport(id: string) {
    const r = await apiFetch(`/reports/saved/${id}`, { method: "DELETE" });
    if (r.ok || r.status === 204) {
      setSavedReports(prev => prev.filter(s => s.id !== id));
    }
    setDeleteConfirmId(null);
  }

  const cols = REPORT_COLS[reportKey].filter(c => !c.hidden);
  const rawItems = data?.items ?? [];

  // Aggregate attendance rows by employee+date
  const items = reportKey === "attendance-summary" ? aggregateAttendance(rawItems) : rawItems;

  const totalFromApi = data?.total ?? 0;
  const clientTransformsEnabled = totalFromApi <= pageSize;

  // Unique employee names for filter dropdown (from current page only)
  const uniqueEmployees = clientTransformsEnabled
    ? Array.from(new Set(items.map(r => String(r.username ?? "")).filter(Boolean))).sort()
    : [];

  const filtered = clientTransformsEnabled
    ? items
        .filter(row => !employeeFilter || String(row.username) === employeeFilter)
        .filter(row => !search.trim() || Object.values(row).some(v => String(v ?? "").toLowerCase().includes(search.toLowerCase())))
    : items;

  const sorted = clientTransformsEnabled && sortCol
    ? [...filtered].sort((a, b) => {
        const cmp = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;
  const totalPages = Math.max(1, Math.ceil(totalFromApi / pageSize));
  const showStart = (page - 1) * pageSize + 1;
  const showEnd = Math.min(page * pageSize, totalFromApi);
  const showingText = totalFromApi === 0
    ? "No records"
    : clientTransformsEnabled && (search.trim() || employeeFilter)
      ? `${sorted.length} of ${totalFromApi} records (filtered)`
      : !clientTransformsEnabled && (search.trim() || employeeFilter || sortCol)
        ? "Client-side filtering/sorting is disabled for paged datasets"
        : `Showing ${showStart}-${showEnd} of ${totalFromApi}`;

  const kpis = computeKpi(reportKey, items);

  const freshnessLabel = lastLoaded ? (() => {
    const diff = Math.floor((Date.now() - lastLoaded.getTime()) / 1000);
    if (diff < 60) return "Updated just now";
    if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
    return `Updated ${Math.floor(diff / 3600)}h ago`;
  })() : "";

  if (loading && data === null) return <SkeletonPage kpis={3} rows={8} cols={5} />;

  const PRESET_OPTS: { key: DatePreset; label: string }[] = [
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "custom", label: "Custom" },
  ];

  const KPI_PALETTES = [
    { main: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
    { main: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
    { main: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    { main: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
  ];
  const KPI_ACCENT_PALETTES: Record<string, { main: string; bg: string; border: string }> = {
    red:   { main: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    amber: { main: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    green: { main: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  };
  const KPI_ICONS = [
    <svg key="0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    <svg key="1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>,
    <svg key="2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    <svg key="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>Reports</h1>
          <p style={{ margin: "3px 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>Workforce analytics and data exports</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <AppButton variant="outline" size="sm" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowSavedDropdown(o => !o)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Saved Reports
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </AppButton>
            {showSavedDropdown && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowSavedDropdown(false)} />
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "var(--n-0)", border: "1px solid var(--border-default)", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 240, padding: "4px 0" }}>
                  {savedReports.length === 0 ? (
                    <div style={{ padding: "12px 16px", fontSize: "0.8rem", color: "var(--text-tertiary)" }}>No saved reports yet.</div>
                  ) : savedReports.map(sr => (
                    <AppButton key={sr.id} variant="ghost" size="sm" className="rpt-export-item w-full text-left justify-start" onClick={() => loadSavedReportFilters(sr)}>
                      <span style={{ display: "block", fontWeight: 600, fontSize: "0.82rem" }}>{sr.name}</span>
                      <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{TABS.find(t => t.key === sr.reportKey)?.label ?? sr.reportKey}</span>
                    </AppButton>
                  ))}
                </div>
              </>
            )}
          </div>
          <AppButton variant="ghost" size="sm" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: 2 }} onClick={() => { setShowManageModal(true); setShowSavedDropdown(false); }}>
            Manage
          </AppButton>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ background: "var(--n-0)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Date preset pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {PRESET_OPTS.map(p => {
            const active = datePreset === p.key;
            return (
              <button key={p.key} type="button" onClick={() => applyDatePreset(p.key)} style={{ padding: "5px 12px", borderRadius: 20, border: active ? "1px solid var(--brand-500)" : "1px solid var(--border-default)", background: active ? "var(--brand-50)" : "transparent", color: active ? "var(--brand-700)" : "var(--text-secondary)", fontWeight: active ? 600 : 400, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.12s" }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Filters + actions row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {datePreset === "custom" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AppInput type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate || today} style={{ width: 155, fontSize: "0.82rem" }} />
              <span style={{ fontSize: "0.82rem", color: "var(--text-tertiary)", fontWeight: 500 }}>→</span>
              <AppInput type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate} max={today} style={{ width: 155, fontSize: "0.82rem" }} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "var(--n-50)", border: "1px solid var(--border-subtle)", fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {fromDate ? fmtDateStr(fromDate) : "—"}&nbsp;→&nbsp;{toDate ? fmtDateStr(toDate) : "—"}
            </div>
          )}
          {uniqueEmployees.length > 0 && (
            <AppSelect value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} style={{ minWidth: 170, fontSize: "0.82rem" }}>
              <option value="">All employees</option>
              {uniqueEmployees.map(e => <option key={e} value={e}>{e}</option>)}
            </AppSelect>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <AppButton variant="primary" size="sm" style={{ display: "flex", alignItems: "center", gap: 5 }} onClick={() => void loadReport(reportKey, 1)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.18-7.36"/></svg>
              Run Report
            </AppButton>
            <AppButton variant="outline" size="sm" style={{ display: "flex", alignItems: "center", gap: 5 }} onClick={() => openSaveModal()}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save
            </AppButton>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      {kpis.length > 0 && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 12 }}>
          {kpis.map((k, i) => {
            const pal = (k.accent ? KPI_ACCENT_PALETTES[k.accent] : null) ?? KPI_PALETTES[i % 4];
            return (
              <div key={k.label} style={{ background: "var(--n-0)", borderRadius: 12, border: "1px solid var(--border-default)", borderLeft: `3px solid ${pal.main}`, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: pal.bg, border: `1px solid ${pal.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: pal.main, flexShrink: 0 }}>
                    {KPI_ICONS[i % 4]}
                  </span>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>{k.label}</span>
                </div>
                <div style={{ fontSize: "1.55rem", fontWeight: 700, color: pal.main, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                {k.sub && <div style={{ fontSize: "0.70rem", color: "var(--text-secondary)", marginTop: 5 }}>{k.sub}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile tab select */}
      <AppSelect className="rpt-tabs-select" value={reportKey} onChange={e => switchTab(e.target.value as ReportKey)}>
        {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </AppSelect>

      {/* ── Content Card ── */}
      <div style={{ background: "var(--n-0)", borderRadius: 12, border: "1px solid var(--border-default)", overflow: "hidden" }}>

        {/* Tab strip + search/export in one row */}
        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", padding: "0 20px", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "stretch", overflowX: "auto", gap: 0 }} className="rpt-tabs-strip">
            {TABS.map(t => {
              const isActive = reportKey === t.key;
              return (
                <button key={t.key} type="button" onClick={() => switchTab(t.key)} style={{ padding: "13px 14px", background: "none", border: "none", borderBottom: isActive ? "2px solid var(--brand-600)" : "2px solid transparent", cursor: "pointer", fontSize: "0.82rem", fontWeight: isActive ? 600 : 400, color: isActive ? "var(--brand-700)" : "var(--text-secondary)", whiteSpace: "nowrap", transition: "color 0.12s", flexShrink: 0 }}>
                  {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <AppInput type="text" style={{ paddingLeft: 28, width: 190, height: 30, fontSize: "0.8rem" }} placeholder={clientTransformsEnabled ? "Search rows…" : "Search disabled on paged data"} value={search} onChange={e => setSearch(e.target.value)} disabled={!clientTransformsEnabled} />
            </div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <AppButton variant="outline" size="sm" style={{ display: "flex", alignItems: "center", gap: 5 }} onClick={() => setExportOpen(o => !o)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </AppButton>
              {exportOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setExportOpen(false)} />
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "var(--n-0)", border: "1px solid var(--border-default)", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 130, padding: "4px 0" }}>
                    {(["csv", "excel", "pdf"] as const).map(fmt => (
                      <AppButton key={fmt} variant="ghost" size="sm" className="rpt-export-item" onClick={() => { void exportReport(fmt); setExportOpen(false); }}>{fmt.toUpperCase()}</AppButton>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Report meta row */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{TABS.find(t => t.key === reportKey)?.label}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>·</span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{loading ? "Loading…" : `${totalFromApi.toLocaleString()} record${totalFromApi !== 1 ? "s" : ""}`}</span>
          {!loading && freshnessLabel && (
            <><span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>·</span><span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{freshnessLabel}</span></>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
            Loading report…
          </div>
        ) : (
          <>
            <div className="rpt-table-outer">
              <AppTableShell>
                <table className="table-base">
                  <thead>
                    <tr>
                      {cols.map(c => (
                        <th key={c.key} className={[c.sortable && clientTransformsEnabled && "rpt-th-sort", c.align === "right" && "text-right"].filter(Boolean).join(" ")} aria-sort={c.sortable && clientTransformsEnabled ? (sortCol === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined} onClick={c.sortable && clientTransformsEnabled ? () => toggleSort(c.key) : undefined}>
                          {c.label}{c.sortable && <SortIcon active={sortCol === c.key} dir={sortDir} />}
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
                            <td key={c.key} className={c.align === "right" ? "text-right" : undefined}>{renderCell(c, row)}</td>
                          ))}
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr className="empty-row">
                        <td colSpan={cols.length}><EmptyReports /></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </AppTableShell>
            </div>
            <div className="rpt-pagination">
              <span className="rpt-showing">{showingText}</span>
              <div className="rpt-page-controls">
                <AppSelect className="w-auto text-[0.8rem] px-2 py-1 h-auto" value={pageSize} onChange={e => changePageSize(Number(e.target.value))} aria-label="Rows per page">
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
                </AppSelect>
                <AppButton variant="ghost" size="sm" disabled={page <= 1} onClick={() => void loadReport(reportKey, page - 1)}>← Prev</AppButton>
                <span className="rpt-page-info">Page {page} of {totalPages}</span>
                <AppButton variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => void loadReport(reportKey, page + 1)}>Next →</AppButton>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Save Report Modal ── */}
      {showSaveModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) closeSaveModal(); }}>
          <div style={{ background: "var(--color-n-0, #fff)", borderRadius: 12, padding: "28px 32px", width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{editingReport ? "Edit Saved Report" : "Save Report"}</span>
              <AppButton variant="ghost" size="sm" onClick={closeSaveModal} aria-label="Close">✕</AppButton>
            </div>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="save-name">Report Name</label>
              <AppInput id="save-name" type="text" placeholder="e.g. Monthly Attendance" value={saveName} onChange={e => setSaveName(e.target.value)} autoFocus />
            </div>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="save-schedule">Schedule</label>
              <AppSelect id="save-schedule" value={saveSchedule} onChange={e => setSaveSchedule(e.target.value as "None" | "Weekly" | "Monthly")}>
                <option value="None">No schedule</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly (1st of month)</option>
              </AppSelect>
            </div>
            {saveSchedule === "Weekly" && (
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label" htmlFor="save-day">Day of Week</label>
                <AppSelect id="save-day" value={saveDay} onChange={e => setSaveDay(Number(e.target.value))}>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </AppSelect>
              </div>
            )}
            {saveSchedule !== "None" && (
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label" htmlFor="save-hour">Send at Hour (UTC)</label>
                <AppSelect id="save-hour" value={saveHour} onChange={e => setSaveHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                </AppSelect>
              </div>
            )}
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="form-label">Recipient Emails</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <AppInput type="email" placeholder="email@example.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} />
                <AppButton type="button" variant="outline" size="sm" onClick={addEmail}>Add</AppButton>
              </div>
              {saveEmails.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {saveEmails.map(email => (
                    <span key={email} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 6, padding: "2px 8px", fontSize: "0.78rem" }}>
                      {email}
                      <AppButton type="button" variant="ghost" size="sm" onClick={() => removeEmail(email)} aria-label={`Remove ${email}`} style={{ padding: 0, minHeight: 0, height: "auto", lineHeight: 1, fontSize: "0.9rem" }}>✕</AppButton>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <AppButton variant="ghost" size="sm" onClick={closeSaveModal} disabled={saveLoading}>Cancel</AppButton>
              <AppButton variant="primary" onClick={() => void handleSaveReport()} disabled={saveLoading || !saveName.trim()}>{saveLoading ? "Saving…" : editingReport ? "Update" : "Save"}</AppButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Saved Reports Modal ── */}
      {showManageModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) setShowManageModal(false); }}>
          <div style={{ background: "var(--color-n-0, #fff)", borderRadius: 12, padding: "28px 32px", width: "100%", maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Manage Saved Reports</span>
              <AppButton variant="ghost" size="sm" onClick={() => setShowManageModal(false)} aria-label="Close">✕</AppButton>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {savedReports.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">📋</div>
                  <p className="empty-state__title">No saved reports</p>
                  <p className="empty-state__desc">Save a report using the "Save" button in the filter bar.</p>
                </div>
              ) : (
                <AppTableShell>
                  <table className="table-base" style={{ width: "100%" }}>
                    <thead>
                      <tr><th>Name</th><th>Report</th><th>Schedule</th><th>Last Run</th><th></th></tr>
                    </thead>
                    <tbody>
                      {savedReports.map(sr => (
                        <tr key={sr.id}>
                          <td><span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>{sr.name}</span></td>
                          <td><span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{TABS.find(t => t.key === sr.reportKey)?.label ?? sr.reportKey}</span></td>
                          <td><span style={{ fontSize: "0.82rem" }}>{scheduleDesc(sr)}</span></td>
                          <td><span style={{ fontSize: "0.82rem", color: "var(--text-tertiary)" }}>{sr.lastRunAt ? fmtDateStr(sr.lastRunAt) : "Never"}</span></td>
                          <td>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              {deleteConfirmId === sr.id ? (
                                <>
                                  <AppButton variant="danger" size="sm" onClick={() => void deleteSavedReport(sr.id)}>Confirm Delete</AppButton>
                                  <AppButton variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</AppButton>
                                </>
                              ) : (
                                <>
                                  <AppButton variant="outline" size="sm" onClick={() => { setShowManageModal(false); openSaveModal(sr); }}>Edit</AppButton>
                                  <AppButton variant="danger" size="sm" onClick={() => setDeleteConfirmId(sr.id)}>Delete</AppButton>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AppTableShell>
              )}
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

