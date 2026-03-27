/**
 * Reports.tsx — PulseHQ v3.0 — Workforce Reporting
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { SkeletonPage } from "./Skeleton";
import { EmptyReports } from "./EmptyState";
import type { ReportKey, SavedReport, SavedReportPayload } from "../types";

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

  if (loading && data === null) return <SkeletonPage kpis={3} rows={8} cols={5} />;

  return (
    <section className="flex flex-col gap-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Workforce analytics and data exports</div>
        </div>
        {/* Saved Reports dropdown + Manage link */}
        <div className="flex items-center gap-2">
          <div className="relative inline-block">
            <button
              className="btn btn-outline btn-sm flex items-center gap-1"
              onClick={() => setShowSavedDropdown(o => !o)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Saved Reports ▾
            </button>
            {showSavedDropdown && (
              <>
                <div className="fixed inset-0 z-[99]" onClick={() => setShowSavedDropdown(false)} />
                <div className="absolute right-0 top-[calc(100%+4px)] bg-n-0 border border-border-default rounded-lg shadow-md z-[100] min-w-[240px] py-1">
                  {savedReports.length === 0 ? (
                    <div className="px-4 py-3 text-[0.8rem] text-[#9ca3af]">No saved reports yet.</div>
                  ) : (
                    savedReports.map(sr => (
                      <button
                        key={sr.id}
                        className="rpt-export-item w-full text-left"
                        onClick={() => loadSavedReportFilters(sr)}
                      >
                        <span className="block font-medium text-[0.82rem]">{sr.name}</span>
                        <span className="block text-[0.72rem] text-[#9ca3af]">{TABS.find(t => t.key === sr.reportKey)?.label ?? sr.reportKey}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm text-[0.8rem] underline underline-offset-2"
            onClick={() => { setShowManageModal(true); setShowSavedDropdown(false); }}
          >
            Manage
          </button>
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
          <div className="form-field min-w-[180px]">
            <label className="form-label" htmlFor="rpt-emp">Employee</label>
            <select id="rpt-emp" className="input-field" value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}>
              <option value="">All employees</option>
              {uniqueEmployees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => void loadReport(reportKey, 1)}>Apply</button>
        <button
          className="btn btn-outline btn-sm flex items-center gap-1"
          onClick={() => openSaveModal()}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Report
        </button>
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
      <div className="card overflow-hidden">
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
              className="input-field w-[200px] h-[30px] text-[0.8rem]"
              placeholder="Search rows…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="relative inline-block">
              <button className="btn btn-outline btn-sm flex items-center gap-1" onClick={() => setExportOpen(o => !o)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export ▾
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-[99]" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+4px)] bg-n-0 border border-border-default rounded-lg shadow-md z-[100] min-w-[130px] py-1">
                    {(["csv", "excel", "pdf"] as const).map(fmt => (
                      <button key={fmt}
                        className="rpt-export-item"
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
            <EmptyReports />
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
                          className={[c.sortable && "rpt-th-sort", c.align === "right" && "text-right"].filter(Boolean).join(" ")}
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
                            <td key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                              {renderCell(c, row)}
                            </td>
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
              </div>
            </div>

            {/* Pagination footer */}
            <div className="rpt-pagination">
              <span className="rpt-showing">{showingText}</span>
              <div className="rpt-page-controls">
                <select
                  className="input-field w-auto text-[0.8rem] px-2 py-1 h-auto"
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

      {/* ── Save Report Modal ─────────────────────────────────────────────── */}
      {showSaveModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) closeSaveModal(); }}
        >
          <div style={{ background: "var(--color-n-0, #fff)", borderRadius: 12, padding: "28px 32px", width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{editingReport ? "Edit Saved Report" : "Save Report"}</span>
              <button className="btn btn-ghost btn-sm" onClick={closeSaveModal} aria-label="Close">✕</button>
            </div>

            {/* Name */}
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="save-name">Report Name</label>
              <input
                id="save-name"
                type="text"
                className="input-field"
                placeholder="e.g. Monthly Attendance"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Schedule type */}
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="save-schedule">Schedule</label>
              <select
                id="save-schedule"
                className="input-field"
                value={saveSchedule}
                onChange={e => setSaveSchedule(e.target.value as "None" | "Weekly" | "Monthly")}
              >
                <option value="None">No schedule</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly (1st of month)</option>
              </select>
            </div>

            {/* Weekly: day of week */}
            {saveSchedule === "Weekly" && (
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label" htmlFor="save-day">Day of Week</label>
                <select
                  id="save-day"
                  className="input-field"
                  value={saveDay}
                  onChange={e => setSaveDay(Number(e.target.value))}
                >
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}

            {/* Hour (Weekly or Monthly) */}
            {saveSchedule !== "None" && (
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label" htmlFor="save-hour">Send at Hour (UTC)</label>
                <select
                  id="save-hour"
                  className="input-field"
                  value={saveHour}
                  onChange={e => setSaveHour(Number(e.target.value))}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipient emails */}
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="form-label">Recipient Emails</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  type="email"
                  className="input-field"
                  placeholder="email@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={addEmail}>Add</button>
              </div>
              {saveEmails.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {saveEmails.map(email => (
                    <span key={email} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 6, padding: "2px 8px", fontSize: "0.78rem" }}>
                      {email}
                      <button type="button" onClick={() => removeEmail(email)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "0.9rem", lineHeight: 1, padding: 0 }} aria-label={`Remove ${email}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost btn-sm" onClick={closeSaveModal} disabled={saveLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={() => void handleSaveReport()} disabled={saveLoading || !saveName.trim()}>
                {saveLoading ? "Saving…" : editingReport ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Saved Reports Modal ────────────────────────────────────── */}
      {showManageModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setShowManageModal(false); }}
        >
          <div style={{ background: "var(--color-n-0, #fff)", borderRadius: 12, padding: "28px 32px", width: "100%", maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Manage Saved Reports</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowManageModal(false)} aria-label="Close">✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {savedReports.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">📋</div>
                  <p className="empty-state__title">No saved reports</p>
                  <p className="empty-state__desc">Save a report using the "Save Report" button in the filter bar.</p>
                </div>
              ) : (
                <table className="table-base" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Report</th>
                      <th>Schedule</th>
                      <th>Last Run</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedReports.map(sr => (
                      <tr key={sr.id}>
                        <td>
                          <span className="text-[rgb(16,16,26)] font-medium text-[0.88rem]">{sr.name}</span>
                        </td>
                        <td>
                          <span className="text-[0.82rem] text-[#6b7280]">{TABS.find(t => t.key === sr.reportKey)?.label ?? sr.reportKey}</span>
                        </td>
                        <td>
                          <span className="text-[0.82rem]">{scheduleDesc(sr)}</span>
                        </td>
                        <td>
                          <span className="text-[0.82rem] text-[#9ca3af]">{sr.lastRunAt ? fmtDateStr(sr.lastRunAt) : "Never"}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {deleteConfirmId === sr.id ? (
                              <>
                                <button className="btn btn-sm" style={{ background: "#fee2e2", color: "#991b1b", border: "none" }} onClick={() => void deleteSavedReport(sr.id)}>Confirm Delete</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => { setShowManageModal(false); openSaveModal(sr); }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm"
                                  style={{ background: "#fee2e2", color: "#991b1b", border: "none" }}
                                  onClick={() => setDeleteConfirmId(sr.id)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
