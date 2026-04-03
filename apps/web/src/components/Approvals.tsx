import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { SkeletonPage } from "./Skeleton";
import { EmptyApprovals } from "./EmptyState";
import type { ApprovalItem, LeaveRequest } from "../types";
import { AppButton, AppCheckbox, AppInput, AppSelect } from "./ui";

type Tab = "all" | "timesheets" | "leave";
type StatsPeriod = "thisWeek" | "thisMonth" | "custom";
type SortBy = "waiting" | "name" | "hours" | "period";
type SortDirection = "asc" | "desc";

interface ApprovalDelegation {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  fromDate: string;
  toDate: string;
  isActive: boolean;
  createdAtUtc: string;
}

interface PendingTimesheetItem extends ApprovalItem {
  delegatedFromUsername?: string;
}

interface ApprovalStats {
  approvedThisMonth: number | null;
  rejectedThisMonth: number | null;
  avgResponseHours: number | null;
}

interface PendingTimesheetEntry {
  id: string;
  projectId: string;
  projectName: string;
  taskCategoryId: string;
  taskCategoryName: string;
  minutes: number;
  notes: string | null;
}

interface PendingTimesheetDetail {
  timesheetId: string;
  userId: string;
  username: string;
  displayName: string;
  workDate: string;
  status: string;
  enteredMinutes: number;
  mismatchReason: string | null;
  submittedAtUtc: string | null;
  entries: PendingTimesheetEntry[];
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtResponseTime(hours: number | null): string {
  if (hours == null) return "-";
  if (hours < 0) return "< 1m";
  const totalMins = Math.round(hours * 60);
  if (totalMins <= 0) return "< 1m";
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function sanitizeMismatch(reason: string | null): string | null {
  if (!reason) return null;
  const normalized = reason.trim();
  if (normalized.length < 4) return "Needs review";
  if (normalized.includes("DEBUG:") || normalized.length > 100) return "Time mismatch detected";
  if (/^(asd|test|na|null)$/i.test(normalized)) return "Needs review";
  return normalized;
}

function fmtDate(dateLike?: string | null): string {
  if (!dateLike) return "-";
  const d = new Date(dateLike.includes("T") ? dateLike : `${dateLike}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateLike;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function waitingDays(submittedAtUtc?: string | null, workDate?: string): number {
  const submittedTs = submittedAtUtc ? new Date(submittedAtUtc).getTime() : Number.NaN;
  if (!Number.isNaN(submittedTs)) {
    return Math.max(0, Math.floor((Date.now() - submittedTs) / 86400000));
  }

  if (workDate) {
    const fallbackTs = new Date(`${workDate}T00:00:00`).getTime();
    if (!Number.isNaN(fallbackTs)) {
      return Math.max(0, Math.floor((Date.now() - fallbackTs) / 86400000));
    }
  }

  return 0;
}

function waitingTone(days: number): "green" | "amber" | "red" {
  if (days > 5) return "red";
  if (days >= 2) return "amber";
  return "green";
}

const AVATAR_PALETTE = ["#818cf8", "#a78bfa", "#34d399", "#60a5fa", "#f472b6", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#f87171"];
function avatarColor(name: string): string {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(value: string): Date {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function CompactCalendar({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const parsed = parseYmd(value || todayIso());
  const [year, setYear] = useState(parsed.getFullYear());
  const [month, setMonth] = useState(parsed.getMonth());
  const today = todayIso();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: { iso: string; day: number; inMonth: boolean }[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({ iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: true });
  }
  while (cells.length < 42) {
    const d = cells.length - (firstWeekday + daysInMonth) + 1;
    const m = month === 11 ? 1 : month + 2;
    const y = month === 11 ? year + 1 : year;
    cells.push({ iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
  }

  return (
    <div className="select-none w-[224px]">
      <div className="flex items-center justify-between mb-2">
        <AppButton type="button" variant="ghost" size="sm" className="px-2 py-[2px] rounded-sm text-base leading-none text-text-secondary flex items-center" onClick={() => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1)} aria-label="Previous month">‹</AppButton>
        <span className="text-[0.82rem] font-bold text-text-primary">{CAL_MONTHS[month]} {year}</span>
        <AppButton type="button" variant="ghost" size="sm" className="px-2 py-[2px] rounded-sm text-base leading-none text-text-secondary flex items-center" onClick={() => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1)} aria-label="Next month">›</AppButton>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {CAL_DAYS.map((d) => <div key={d} className="text-center text-[0.62rem] text-text-tertiary font-semibold py-[2px]">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map((cell) => {
          const isSelected = cell.iso === value;
          const isToday = cell.iso === today;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => { onChange(cell.iso); onClose(); }}
              className="rounded cursor-pointer text-[0.72rem] leading-[28px] h-7 p-0"
              style={{
                border: isToday && !isSelected ? "1px solid var(--brand-400)" : "1px solid transparent",
                fontWeight: isSelected || isToday ? 700 : 400,
                background: isSelected ? "var(--brand-500)" : "transparent",
                color: isSelected ? "#fff" : isToday ? "var(--brand-600)" : cell.inMonth ? "var(--text-primary)" : "var(--text-tertiary)",
                opacity: cell.inMonth ? 1 : 0.45,
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t border-border-subtle pt-2">
        <AppButton type="button" variant="ghost" size="sm" className="w-full text-[0.75rem]" onClick={() => { onChange(todayIso()); onClose(); }}>Today</AppButton>
      </div>
    </div>
  );
}

function ModernDatePicker({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <AppButton
        type="button"
        variant="outline"
        size="sm"
        className="apr3-date-trigger"
        onClick={() => setOpen(v => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {value ? fmtDate(value) : "Select date"}
      </AppButton>
      {open && (
        <div
          role="dialog"
          aria-label="Date picker"
          className="absolute top-[calc(100%+6px)] right-0 z-[220] apr3-date-popover border border-border-subtle rounded-md shadow-md p-3"
        >
          <CompactCalendar value={value || todayIso()} onChange={onChange} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

const IconPending = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14" /><path d="M5 2h14" />
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
  </svg>
);

const IconApproved = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
  </svg>
);

const IconRejected = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconAlert = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconCheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export function Approvals() {
  const [loading, setLoading] = useState(true);
  const [tsPending, setTsPending] = useState<PendingTimesheetItem[]>([]);
  const [leavePending, setLeavePending] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats>({ approvedThisMonth: null, rejectedThisMonth: null, avgResponseHours: null });
  const [tab, setTab] = useState<Tab>("all");
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("waiting");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [search, setSearch] = useState("");
  const [rejectFor, setRejectFor] = useState<{ id: string; kind: "ts" | "leave" } | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [bulkApproving, setBulkApproving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [delegation, setDelegation] = useState<ApprovalDelegation | null>(null);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [delegateUsers, setDelegateUsers] = useState<{ id: string; username: string; displayName: string }[]>([]);
  const [delegateToUserId, setDelegateToUserId] = useState("");
  const [delegateFromDate, setDelegateFromDate] = useState("");
  const [delegateToDate, setDelegateToDate] = useState("");
  const [delegateSaving, setDelegateSaving] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PendingTimesheetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [bulkRejectMode, setBulkRejectMode] = useState(false);
  const [bulkRejectComment, setBulkRejectComment] = useState("");
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [delegateDateError, setDelegateDateError] = useState<string | null>(null);

  function statsQuery(): string {
    const base = `/approvals/stats?period=${statsPeriod}`;
    if (statsPeriod !== "custom") return base;
    if (!customFrom || !customTo) return `${base}&fromDate=&toDate=`;
    return `${base}&fromDate=${customFrom}&toDate=${customTo}`;
  }

  function loadData() {
    Promise.all([
      apiFetch("/approvals/pending-timesheets").then(async (r) => { if (r.ok) setTsPending(await r.json()); }),
      apiFetch("/leave/requests/pending").then(async (r) => { if (r.ok) setLeavePending(await r.json()); }),
      apiFetch(statsQuery()).then(async (r) => { if (r.ok) setStats(await r.json()); }),
    ]).finally(() => setLoading(false));
  }

  const loadDelegation = async () => {
    try {
      const r = await apiFetch("/approvals/delegation");
      if (r.ok) {
        const data = await r.json();
        if (data && typeof data === "object" && "id" in (data as Record<string, unknown>) && "toDate" in (data as Record<string, unknown>)) {
          setDelegation(data as ApprovalDelegation);
        } else {
          setDelegation(null);
        }
      }
    } catch {
      // non-blocking
    }
  };

  useEffect(() => { loadData(); void loadDelegation(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (!loading) loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statsPeriod]);

  async function approveTs(timesheetId: string, requiresReview: boolean) {
    if (requiresReview) return;
    const r = await apiFetch(`/approvals/timesheets/${timesheetId}/approve`, { method: "POST", body: JSON.stringify({ comment: "" }) });
    if (r.ok) loadData();
  }

  async function confirmRejectTs(timesheetId: string) {
    if (!rejectComment.trim()) { alert("Comment required for correction request."); return; }
    const r = await apiFetch(`/approvals/timesheets/${timesheetId}/reject`, { method: "POST", body: JSON.stringify({ comment: rejectComment }) });
    if (r.ok) {
      setRejectFor(null);
      setRejectComment("");
      setFeedbackMessage("Correction request sent successfully.");
      setTimeout(() => setFeedbackMessage(null), 3000);
      loadData();
    }
  }

  async function approveLeave(id: string) {
    const r = await apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve: true, comment: "" }) });
    if (r.ok) loadData();
  }

  async function confirmRejectLeave(id: string) {
    if (!rejectComment.trim()) { alert("Comment required for rejection."); return; }
    const r = await apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve: false, comment: rejectComment }) });
    if (r.ok) {
      setRejectFor(null);
      setRejectComment("");
      loadData();
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(currentIds: string[]) {
    if (selectedIds.size === currentIds.length && currentIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentIds));
    }
  }

  async function bulkApprove() {
    if (selectedIds.size === 0) return;
    setBulkApproving(true);
    const toApprove = filteredTsPending.filter((a) => selectedIds.has(a.timesheetId) && a.enteredMinutes > 0);
    await Promise.all(toApprove.map((a) =>
      apiFetch(`/approvals/timesheets/${a.timesheetId}/approve`, { method: "POST", body: JSON.stringify({ comment: "" }) }),
    ));
    setSelectedIds(new Set());
    setBulkApproving(false);
    setFeedbackMessage(`Approved ${toApprove.length} selected timesheet${toApprove.length === 1 ? "" : "s"}.`);
    setTimeout(() => setFeedbackMessage(null), 3000);
    loadData();
  }

  async function bulkRequestCorrection() {
    if (selectedIds.size === 0) return;
    if (!bulkRejectComment.trim()) return;

    setBulkRejecting(true);
    const toReject = filteredTsPending.filter((a) => selectedIds.has(a.timesheetId));
    await Promise.all(toReject.map((a) =>
      apiFetch(`/approvals/timesheets/${a.timesheetId}/reject`, {
        method: "POST",
        body: JSON.stringify({ comment: bulkRejectComment.trim() }),
      }),
    ));
    setBulkRejecting(false);
    setBulkRejectMode(false);
    setBulkRejectComment("");
    setSelectedIds(new Set());
    setFeedbackMessage(`Correction requested for ${toReject.length} timesheet${toReject.length === 1 ? "" : "s"}.`);
    setTimeout(() => setFeedbackMessage(null), 3000);
    loadData();
  }

  function toggleReject(id: string, kind: "ts" | "leave") {
    if (rejectFor?.id === id && rejectFor.kind === kind) {
      setRejectFor(null);
      setRejectComment("");
      return;
    }
    setRejectFor({ id, kind });
    setRejectComment("");
  }

  async function openTimesheetDetail(timesheetId: string) {
    if (detailId === timesheetId) {
      setDetailId(null);
      setDetail(null);
      return;
    }
    setDetailId(timesheetId);
    setDetailLoading(true);
    const r = await apiFetch(`/approvals/timesheets/${timesheetId}`).catch(() => null);
    if (r?.ok) setDetail(await r.json()); else setDetail(null);
    setDetailLoading(false);
  }

  const openDelegateModal = async () => {
    try {
      const r = await apiFetch("/users");
      if (r.ok) {
        const users: { id: string; username: string; displayName: string; role: string }[] = await r.json();
        setDelegateUsers(users.filter((u) => u.role === "manager" || u.role === "admin"));
      }
    } catch {
      setDelegateUsers([]);
    }
    setDelegateToUserId("");
    setDelegateFromDate("");
    setDelegateToDate("");
    setShowDelegateModal(true);
  };

  const handleSaveDelegate = async () => {
    if (!delegateToUserId || !delegateFromDate || !delegateToDate) return;
    if (delegateToDate < delegateFromDate) {
      setDelegateDateError("To date cannot be before from date.");
      return;
    }

    setDelegateDateError(null);
    setDelegateSaving(true);
    try {
      const r = await apiFetch("/approvals/delegation", {
        method: "POST",
        body: JSON.stringify({ toUserId: delegateToUserId, fromDate: delegateFromDate, toDate: delegateToDate }),
      });
      if (r.ok) {
        const result: ApprovalDelegation = await r.json();
        setDelegation(result);
        setShowDelegateModal(false);
      }
    } finally {
      setDelegateSaving(false);
    }
  };

  const handleRevokeDelegate = async () => {
    if (!delegation) return;
    await apiFetch(`/approvals/delegation/${delegation.id}`, { method: "DELETE" }).catch(() => null);
    setDelegation(null);
  };

  const filteredTsPending = useMemo(() => {
    const term = search.trim().toLowerCase();
    const bySearch = tsPending.filter((a) => {
      const display = (a.displayName ?? a.username).toLowerCase();
      return term.length === 0 || display.includes(term) || a.username.toLowerCase().includes(term);
    });
    const sorted = [...bySearch];
    sorted.sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortBy === "name") return multiplier * ((a.displayName ?? a.username).localeCompare(b.displayName ?? b.username));
      if (sortBy === "hours") return multiplier * (a.enteredMinutes - b.enteredMinutes);
      if (sortBy === "period") return multiplier * ((new Date(a.workDate).getTime()) - (new Date(b.workDate).getTime()));
      return multiplier * (waitingDays(a.submittedAtUtc, a.workDate) - waitingDays(b.submittedAtUtc, b.workDate));
    });
    return sorted;
  }, [search, sortBy, sortDirection, tsPending]);

  const pendingCount = tsPending.length + leavePending.length;
  const showTs = tab !== "leave";
  const showLeave = tab !== "timesheets";
  const rejectedCount = stats.rejectedThisMonth ?? 0;
  const hasManyTimesheets = filteredTsPending.length > 1;
  const canBulkApprove = selectedIds.size > 0 && !bulkApproving;
  const selectedCount = selectedIds.size;
  const selectedEligibleCount = filteredTsPending.filter((a) => selectedIds.has(a.timesheetId) && a.enteredMinutes > 0).length;
  const selectedIneligibleCount = Math.max(0, selectedCount - selectedEligibleCount);
  const reviewRequiredCount = tsPending.filter((a) => a.enteredMinutes === 0).length;
  const readyNowCount = tsPending.filter((a) => a.enteredMinutes > 0).length + leavePending.length;
  const targetResponseHours = 24;
  const avgVsTarget = stats.avgResponseHours == null ? null : Math.round((targetResponseHours - stats.avgResponseHours) * 10) / 10;
  const avgTrendText = avgVsTarget == null ? "No benchmark yet" : avgVsTarget >= 0 ? `↓ ${Math.abs(avgVsTarget)}h vs ${targetResponseHours}h target` : `↑ ${Math.abs(avgVsTarget)}h vs ${targetResponseHours}h target`;

  const tabs: { key: Tab; label: string; count: number; disabled?: boolean }[] = [
    { key: "all", label: "All", count: pendingCount },
    { key: "timesheets", label: "Timesheets", count: tsPending.length, disabled: tsPending.length === 0 },
    { key: "leave", label: "Leave", count: leavePending.length, disabled: leavePending.length === 0 },
  ];

  const headerSubtitle = `${pendingCount} item${pendingCount === 1 ? "" : "s"} awaiting your decision`;
  const statsPeriodLabel = statsPeriod === "thisWeek" ? "This Week" : statsPeriod === "thisMonth" ? "This Month" : "Custom Range";

  function toggleSort(next: SortBy) {
    if (sortBy === next) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDirection(next === "name" ? "asc" : "desc");
    }
  }

  if (loading) return <SkeletonPage kpis={2} rows={5} cols={5} />;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>Approvals</h1>
          <p style={{ margin: "3px 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>{headerSubtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {delegation && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 20,
              background: "#fffbeb", border: "1px solid #fde68a",
              fontSize: "0.76rem", color: "#92400e",
            }}>
              Delegated to <strong>{delegation.toUsername}</strong> until {fmtDate(delegation.toDate)}
              <button
                type="button"
                onClick={() => void handleRevokeDelegate()}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#b45309", fontSize: "0.75rem", padding: "0 0 0 4px" }}
              >
                Revoke
              </button>
            </span>
          )}
          <AppButton variant="outline" size="sm" onClick={() => void openDelegateModal()}>
            Delegate Approvals
          </AppButton>
        </div>
      </div>

      {feedbackMessage && (
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: "#ecfdf5", border: "1px solid #a7f3d0",
          fontSize: "0.82rem", color: "#065f46", fontWeight: 500,
        }}>
          {feedbackMessage}
        </div>
      )}

      {/* ── Stats section ── */}
      <div style={{
        background: "var(--n-0)", borderRadius: 12,
        border: "1px solid var(--border-default)",
      }}>
        {/* Stats header with period selector */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>
            Overview
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {statsPeriod === "custom" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 6 }}>
                <ModernDatePicker value={customFrom} onChange={setCustomFrom} ariaLabel="From date" />
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>to</span>
                <ModernDatePicker value={customTo} onChange={setCustomTo} ariaLabel="To date" />
                <AppButton variant="primary" size="sm" onClick={() => loadData()} disabled={!customFrom || !customTo}>Apply</AppButton>
              </div>
            )}
            {/* Segment pills */}
            <div style={{
              display: "flex", background: "var(--n-50)", borderRadius: 8,
              padding: 3, border: "1px solid var(--border-default)", gap: 2,
            }}>
              {(["thisWeek", "thisMonth", "custom"] as StatsPeriod[]).map((p) => {
                const label = p === "thisWeek" ? "This Week" : p === "thisMonth" ? "This Month" : "Custom";
                const active = statsPeriod === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setStatsPeriod(p)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                      fontSize: "0.74rem", fontWeight: active ? 600 : 400,
                      background: active ? "var(--n-0)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.12s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 6 stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)" }}>
          {([
            {
              value: pendingCount,
              label: "Pending",
              sub: pendingCount === 0 ? "Queue is clear" : `${pendingCount} awaiting decision`,
              color: "#ea580c", bg: "#fff7ed", border: "#fed7aa",
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              ),
            },
            {
              value: readyNowCount,
              label: "Ready now",
              sub: pendingCount > 0 ? `${readyNowCount} of ${pendingCount} can be approved` : "Nothing pending",
              color: "#059669", bg: "#ecfdf5", border: "#a7f3d0",
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                </svg>
              ),
            },
            {
              value: stats.approvedThisMonth ?? "-",
              label: "Approved",
              sub: stats.approvedThisMonth == null ? statsPeriodLabel : `${stats.approvedThisMonth === 0 ? "None yet" : `${stats.approvedThisMonth} approved`} · ${statsPeriodLabel}`,
              color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe",
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              ),
            },
            {
              value: stats.rejectedThisMonth ?? "-",
              label: "Corrections",
              sub: stats.rejectedThisMonth == null ? statsPeriodLabel : `${stats.rejectedThisMonth === 0 ? "None sent" : `${stats.rejectedThisMonth} sent back`} · ${statsPeriodLabel}`,
              color: "#dc2626", bg: "#fef2f2", border: "#fecaca",
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ),
            },
            {
              value: reviewRequiredCount,
              label: "Needs review",
              sub: reviewRequiredCount === 0 ? "No issues in queue" : `${reviewRequiredCount} blocked — cannot approve yet`,
              color: "#d97706", bg: "#fffbeb", border: "#fde68a",
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              ),
            },
            {
              value: fmtResponseTime(stats.avgResponseHours),
              label: "Avg response",
              sub: avgTrendText,
              color: stats.avgResponseHours != null && stats.avgResponseHours > targetResponseHours ? "#dc2626" : "var(--text-primary)",
              bg: "var(--n-50)", border: "transparent",
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              ),
            },
          ] as const).map((s, i) => (
            <div
              key={i}
              style={{
                padding: "14px 18px",
                borderRight: i < 5 ? "1px solid var(--border-subtle)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, color: s.color }}>
                {s.icon}
                <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>{s.label}</span>
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "0.70rem", color: "var(--text-secondary)", marginTop: 5, lineHeight: 1.4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Queue section ── */}
      <div style={{
        background: "var(--n-0)", borderRadius: 12,
        border: "1px solid var(--border-default)",
        overflow: "hidden",
      }}>
        {/* Tabs header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          borderBottom: "1px solid var(--border-default)",
          padding: "0 20px",
        }}>
          {tabs.map(({ key, label, count, disabled }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => !disabled && setTab(key)}
                disabled={disabled}
                style={{
                  padding: "13px 4px",
                  marginRight: 20,
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2px solid var(--brand-600)" : "2px solid transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: "0.82rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--brand-700)" : disabled ? "var(--text-tertiary)" : "var(--text-secondary)",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "color 0.12s",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 18, height: 18, padding: "0 5px",
                  borderRadius: 9,
                  background: active ? "var(--brand-600)" : "var(--n-100)",
                  color: active ? "#fff" : "var(--text-secondary)",
                  fontSize: "0.68rem", fontWeight: 700,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + sort bar */}
        {showTs && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            <div style={{ flex: 1, position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round"
                   style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none" }}
                   aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <AppInput
                style={{ paddingLeft: 32 }}
                placeholder="Search employee by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: 500 }}>Sort</span>
              <AppSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                style={{ fontSize: "0.80rem" }}
              >
                <option value="waiting">Longest waiting</option>
                <option value="name">Employee name</option>
                <option value="hours">Hours logged</option>
                <option value="period">Period date</option>
              </AppSelect>
              <button
                type="button"
                onClick={() => setSortDirection((p) => (p === "asc" ? "desc" : "asc"))}
                style={{
                  width: 32, height: 32, borderRadius: 6,
                  border: "1px solid var(--border-default)",
                  background: "var(--n-0)", cursor: "pointer",
                  fontSize: "0.80rem", color: "var(--text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
                title={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
              >
                {sortDirection === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>
        )}

        {/* Bulk actions bar — shown when rows are selected */}
        {showTs && filteredTsPending.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "10px 20px",
            background: selectedIds.size > 0 ? "var(--brand-50)" : "var(--n-50)",
            borderBottom: "1px solid var(--border-subtle)",
            transition: "background 0.15s",
          }}>
            {hasManyTimesheets && (
              <AppButton
                variant="ghost"
                style={{ padding: "0 6px", height: 28 }}
                onClick={() => toggleSelectAll(filteredTsPending.map((a) => a.timesheetId))}
                aria-label="Toggle select all"
              >
                <AppCheckbox readOnly checked={selectedIds.size === filteredTsPending.length && filteredTsPending.length > 0} />
              </AppButton>
            )}
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              {hasManyTimesheets
                ? (selectedIds.size === filteredTsPending.length && filteredTsPending.length > 0 ? "Deselect all" : "Select all")
                : "1 timesheet pending"}
            </span>
            {selectedIds.size > 0 && (
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--brand-700)" }}>
                {selectedIds.size} selected
                {selectedEligibleCount > 0 ? ` · ${selectedEligibleCount} eligible` : ""}
                {selectedIneligibleCount > 0 ? ` · ${selectedIneligibleCount} need review` : ""}
              </span>
            )}
            <AppButton
              variant="primary"
              size="sm"
              onClick={() => void bulkApprove()}
              disabled={!canBulkApprove || selectedEligibleCount === 0}
              title={selectedEligibleCount > 0 ? `Approve ${selectedEligibleCount} eligible` : "Select eligible timesheets"}
            >
              {bulkApproving ? "Approving…" : selectedIds.size > 0 ? `Approve ${selectedEligibleCount}` : "Approve selected"}
            </AppButton>
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setBulkRejectMode((v) => !v)}
              disabled={selectedIds.size === 0}
            >
              Request correction
            </AppButton>
            {bulkRejectMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 6 }}>
                <AppInput
                  style={{ flex: 1, maxWidth: 480 }}
                  value={bulkRejectComment}
                  onChange={(e) => setBulkRejectComment(e.target.value)}
                  placeholder="What needs to be corrected?"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{bulkRejectComment.length}/500</span>
                <AppButton variant="primary" size="sm" onClick={() => void bulkRequestCorrection()} disabled={bulkRejecting || !bulkRejectComment.trim()}>
                  {bulkRejecting ? "Sending…" : "Send"}
                </AppButton>
              </div>
            )}
          </div>
        )}

        {/* Column headers */}
        {showTs && filteredTsPending.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 130px 100px 120px 1fr 36px",
            gap: 8,
            padding: "8px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--n-50)",
          }}>
            <div />
            {(["name", "period", "hours", "waiting"] as SortBy[]).map((col) => {
              const labels: Record<SortBy, string> = { name: "EMPLOYEE", period: "PERIOD", hours: "HOURS LOGGED", waiting: "WAITING" };
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => toggleSort(col)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left",
                    fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em",
                    color: sortBy === col ? "var(--brand-600)" : "var(--text-secondary)",
                    display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  {labels[col]}
                  {sortBy === col && <span style={{ fontSize: "0.70rem" }}>{sortDirection === "asc" ? "↑" : "↓"}</span>}
                </button>
              );
            })}
            <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-secondary)" }}>ACTIONS</div>
            <div />
          </div>
        )}

        {/* Timesheet rows */}
        {showTs && filteredTsPending.map((a, rowIndex) => {
          const mismatch      = sanitizeMismatch(a.mismatchReason);
          const requiresReview = a.enteredMinutes === 0 || mismatch !== null; // warning chip only
          const cannotApprove  = a.enteredMinutes === 0; // only true block on approval
          const days          = waitingDays(a.submittedAtUtc, a.workDate);
          const tone          = waitingTone(days);
          const person        = (a.displayName ?? "").trim().length > 0 ? a.displayName! : a.username;
          const isSelected    = selectedIds.has(a.timesheetId);
          const isDetailOpen  = detailId === a.timesheetId;

          const waitingColors = {
            green: { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
            amber: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
            red:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
          }[tone];

          return (
            <div
              key={a.timesheetId}
              style={{
                borderBottom: rowIndex < filteredTsPending.length - 1 ? "1px solid var(--border-subtle)" : "none",
                background: isSelected ? "var(--brand-50)" : "var(--n-0)",
                transition: "background 0.1s",
              }}
            >
              {/* Main row */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 130px 100px 120px 1fr 36px",
                gap: 8,
                padding: "14px 20px",
                alignItems: "center",
              }}>
                {/* Checkbox */}
                <AppButton
                  variant="ghost"
                  style={{ padding: "0 4px", height: 28, justifyContent: "center" }}
                  onClick={() => toggleSelect(a.timesheetId)}
                  aria-label={`Select ${person}`}
                >
                  <AppCheckbox readOnly checked={isSelected} />
                </AppButton>

                {/* Employee */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: avatarColor(a.userId ?? a.username),
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.72rem", fontWeight: 700,
                  }}>
                    {initials(person)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {person}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      {requiresReview && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "1px 7px", borderRadius: 4,
                          background: "#fffbeb", border: "1px solid #fde68a",
                          fontSize: "0.68rem", fontWeight: 600, color: "#92400e",
                        }}>
                          ⚠ {a.enteredMinutes === 0 ? "0h submitted" : mismatch}
                        </span>
                      )}
                      {!requiresReview && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "1px 7px", borderRadius: 4,
                          background: "#ecfdf5", border: "1px solid #a7f3d0",
                          fontSize: "0.68rem", fontWeight: 600, color: "#065f46",
                        }}>
                          ✓ Ready
                        </span>
                      )}
                      {a.delegatedFromUsername && (
                        <span style={{
                          padding: "1px 7px", borderRadius: 4,
                          background: "var(--brand-50)", border: "1px solid var(--brand-100)",
                          fontSize: "0.68rem", color: "var(--brand-700)",
                        }}>
                          via {a.delegatedFromUsername}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Period */}
                <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 500 }}>
                  {fmtDate(a.workDate)}
                </div>

                {/* Hours */}
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: a.enteredMinutes === 0 ? "var(--text-tertiary)" : "var(--text-primary)" }}>
                  {fmtHours(a.enteredMinutes)}
                </div>

                {/* Waiting */}
                <div>
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "3px 9px", borderRadius: 20,
                    background: waitingColors.bg,
                    border: `1px solid ${waitingColors.border}`,
                    fontSize: "0.74rem", fontWeight: 600,
                    color: waitingColors.color,
                  }}>
                    {days === 0 ? "Today" : `${days}d waiting`}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AppButton
                    variant="primary"
                    size="sm"
                    onClick={() => void approveTs(a.timesheetId, cannotApprove)}
                    disabled={cannotApprove}
                    title={cannotApprove ? "Cannot approve: no hours logged." : mismatch ? `Mismatch noted: ${mismatch}` : "Approve timesheet"}
                    style={cannotApprove ? { opacity: 0.4 } : { background: "var(--brand-600)", borderColor: "var(--brand-600)" }}
                  >
                    Approve
                  </AppButton>
                  <AppButton
                    variant="outline"
                    size="sm"
                    onClick={() => toggleReject(a.timesheetId, "ts")}
                    style={{ fontSize: "0.78rem", color: "var(--text-secondary)", borderColor: "var(--border-default)" }}
                  >
                    Request Correction
                  </AppButton>
                </div>

                {/* Expand/collapse chevron */}
                <button
                  type="button"
                  onClick={() => void openTimesheetDetail(a.timesheetId)}
                  title={isDetailOpen ? "Collapse details" : "Expand details"}
                  aria-label={isDetailOpen ? "Collapse details" : "Expand details"}
                  aria-expanded={isDetailOpen}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: "1px solid var(--border-default)",
                    background: isDetailOpen ? "var(--brand-50)" : "var(--n-0)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: isDetailOpen ? "var(--brand-600)" : "var(--text-secondary)",
                    transition: "background 0.12s, color 0.12s",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: "transform 0.18s", transform: isDetailOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Correction input */}
              {rejectFor?.id === a.timesheetId && rejectFor.kind === "ts" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  padding: "10px 20px 14px",
                  background: "#fffbeb",
                  borderTop: "1px solid #fde68a",
                }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#92400e", flexShrink: 0 }}>Correction note:</span>
                  <AppInput
                    style={{ flex: 1, minWidth: 200, maxWidth: 480 }}
                    placeholder="What should be corrected?"
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value.slice(0, 500))}
                    autoFocus
                  />
                  <span style={{ fontSize: "0.70rem", color: "var(--text-secondary)" }}>{rejectComment.length}/500</span>
                  <AppButton variant="primary" size="sm" onClick={() => void confirmRejectTs(a.timesheetId)}>Send</AppButton>
                  <AppButton variant="ghost" size="sm" onClick={() => setRejectFor(null)}>Cancel</AppButton>
                </div>
              )}

              {/* Detail panel */}
              {isDetailOpen && (
                <div style={{
                  padding: "14px 20px 16px",
                  background: "var(--n-50)",
                  borderTop: "1px solid var(--border-subtle)",
                }}>
                  {detailLoading && (
                    <p style={{ margin: 0, fontSize: "0.80rem", color: "var(--text-secondary)" }}>Loading details…</p>
                  )}
                  {!detailLoading && detail && (
                    <>
                      <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        {detail.displayName} ({detail.username}) · {fmtDate(detail.workDate)}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {detail.entries.length === 0 && (
                          <p style={{ margin: 0, fontSize: "0.80rem", color: "var(--text-secondary)" }}>No entries.</p>
                        )}
                        {detail.entries.map((entry) => (
                          <div key={entry.id} style={{
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                            padding: "8px 12px", borderRadius: 8,
                            background: "var(--n-0)", border: "1px solid var(--border-subtle)",
                          }}>
                            <div>
                              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{entry.projectName}</div>
                              <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{entry.taskCategoryName}</div>
                              {entry.notes && <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>{entry.notes}</div>}
                            </div>
                            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", flexShrink: 0, marginLeft: 12 }}>
                              {fmtHours(entry.minutes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {!detailLoading && !detail && (
                    <p style={{ margin: 0, fontSize: "0.80rem", color: "#b91c1c" }}>Unable to load details.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Timesheet empty state */}
        {tab === "timesheets" && filteredTsPending.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", margin: "0 auto 12px",
              background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div style={{ fontSize: "0.90rem", fontWeight: 600, color: "var(--text-primary)" }}>All caught up</div>
            <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", marginTop: 4 }}>No timesheet approvals pending right now.</div>
          </div>
        )}

        {/* Leave rows */}
        {showLeave && leavePending.map((l, rowIndex) => (
          <div
            key={l.id}
            style={{
              borderBottom: rowIndex < leavePending.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 130px 100px 120px 1fr 36px",
              gap: 8,
              padding: "14px 20px",
              alignItems: "center",
            }}>
              <div />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  background: avatarColor(l.username),
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.72rem", fontWeight: 700,
                }}>
                  {initials(l.username)}
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{l.username}</div>
                  <span style={{
                    padding: "1px 7px", borderRadius: 4,
                    background: "#fffbeb", border: "1px solid #fde68a",
                    fontSize: "0.68rem", fontWeight: 600, color: "#92400e",
                  }}>
                    {l.leaveTypeName}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 500 }}>{fmtDate(l.leaveDate)}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{l.isHalfDay ? "Half day" : "Full day"}</div>
              <div />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <AppButton variant="primary" size="sm" onClick={() => void approveLeave(l.id)}>Approve</AppButton>
                <AppButton variant="ghost" size="sm" style={{ color: "var(--text-secondary)" }} onClick={() => toggleReject(l.id, "leave")}>Reject</AppButton>
              </div>
              <div />
            </div>
            {rejectFor?.id === l.id && rejectFor.kind === "leave" && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px 14px",
                background: "#fef2f2", borderTop: "1px solid #fecaca",
              }}>
                <AppInput
                  style={{ flex: 1, maxWidth: 480 }}
                  placeholder="Reason for rejection (required)"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  autoFocus
                />
                <AppButton variant="danger" size="sm" onClick={() => void confirmRejectLeave(l.id)}>Confirm</AppButton>
                <AppButton variant="ghost" size="sm" onClick={() => setRejectFor(null)}>Cancel</AppButton>
              </div>
            )}
          </div>
        ))}

        {tab === "leave" && leavePending.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", margin: "0 auto 12px",
              background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "1.3rem" }}>🌴</span>
            </div>
            <div style={{ fontSize: "0.90rem", fontWeight: 600, color: "var(--text-primary)" }}>All caught up</div>
            <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", marginTop: 4 }}>No leave requests pending right now.</div>
          </div>
        )}

        {pendingCount === 0 && <EmptyApprovals />}
      </div>

      {/* ── Delegate Modal ── */}
      {showDelegateModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(16,16,26,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDelegateModal(false); }}
        >
          <div style={{
            background: "var(--n-0)", borderRadius: 16, padding: "24px 28px",
            width: "100%", maxWidth: 460,
            boxShadow: "0 20px 60px rgba(16,16,26,0.18)",
            border: "1px solid var(--border-default)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>Delegate Approvals</h3>
                <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                  Another manager will act on your behalf during this period.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDelegateModal(false)}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-default)",
                  background: "transparent", cursor: "pointer", color: "var(--text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
                  Delegate to
                </label>
                <AppSelect value={delegateToUserId} onChange={(e) => setDelegateToUserId(e.target.value)} className="w-full">
                  <option value="">Select a manager or admin…</option>
                  {delegateUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
                  ))}
                </AppSelect>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>From</label>
                  <AppInput type="date" value={delegateFromDate} onChange={(e) => setDelegateFromDate(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>To</label>
                  <AppInput type="date" value={delegateToDate} onChange={(e) => setDelegateToDate(e.target.value)} className="w-full" />
                </div>
              </div>
              {delegateDateError && (
                <p style={{ margin: 0, fontSize: "0.76rem", color: "#b91c1c" }}>{delegateDateError}</p>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <AppButton variant="ghost" size="sm" onClick={() => setShowDelegateModal(false)} disabled={delegateSaving}>Cancel</AppButton>
              <AppButton
                variant="primary"
                onClick={() => void handleSaveDelegate()}
                disabled={delegateSaving || !delegateToUserId || !delegateFromDate || !delegateToDate}
              >
                {delegateSaving ? "Saving…" : "Save Delegation"}
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
