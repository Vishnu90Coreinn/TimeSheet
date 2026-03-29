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
  const totalMins = Math.round(hours * 60);
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
    const toApprove = filteredTsPending.filter((a) => selectedIds.has(a.timesheetId) && a.enteredMinutes > 0 && !sanitizeMismatch(a.mismatchReason));
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
  const selectedEligibleCount = filteredTsPending.filter((a) => selectedIds.has(a.timesheetId) && a.enteredMinutes > 0 && !sanitizeMismatch(a.mismatchReason)).length;
  const selectedIneligibleCount = Math.max(0, selectedCount - selectedEligibleCount);
  const reviewRequiredCount = tsPending.filter((a) => a.enteredMinutes === 0 || sanitizeMismatch(a.mismatchReason) !== null).length;
  const readyNowCount = tsPending.filter((a) => a.enteredMinutes > 0 && !sanitizeMismatch(a.mismatchReason)).length + leavePending.length;
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
    <section className="flex flex-col gap-6">
      <div className="page-header">
        <div>
          <div className="page-title">Approvals</div>
          <div className="page-subtitle">{headerSubtitle}</div>
        </div>
        <div className="page-actions">
          <AppButton variant="outline" size="sm" onClick={() => void openDelegateModal()}>
            Delegate Approvals
          </AppButton>
          {delegation && (
            <AppButton variant="ghost" size="sm" className="text-[#b91c1c]" onClick={() => void handleRevokeDelegate()}>
              Revoke Delegation
            </AppButton>
          )}
        </div>
      </div>

      {feedbackMessage && <div className="apr3-feedback">{feedbackMessage}</div>}

      {delegation && (
        <div className="apr3-delegation-note">
          Delegated to <strong>{delegation.toUsername}</strong> until {fmtDate(delegation.toDate)}
        </div>
      )}

      <div className="apr3-stats-toolbar-compact">
          <div className="apr3-period-segment apr3-period-segment-compact" role="tablist" aria-label="Stats period">
          <AppButton
            className={`apr3-segment-btn ${statsPeriod === "thisWeek" ? "active" : ""}`}
            onClick={() => setStatsPeriod("thisWeek")}
            role="tab"
            aria-selected={statsPeriod === "thisWeek"}
            variant="ghost"
            type="button"
          >
            This Week
          </AppButton>
          <AppButton
            className={`apr3-segment-btn ${statsPeriod === "thisMonth" ? "active" : ""}`}
            onClick={() => setStatsPeriod("thisMonth")}
            role="tab"
            aria-selected={statsPeriod === "thisMonth"}
            variant="ghost"
            type="button"
          >
            This Month
          </AppButton>
          <AppButton
            className={`apr3-segment-btn ${statsPeriod === "custom" ? "active" : ""}`}
            onClick={() => setStatsPeriod("custom")}
            role="tab"
            aria-selected={statsPeriod === "custom"}
            variant="ghost"
            type="button"
          >
            Custom
          </AppButton>
          </div>

        {statsPeriod === "custom" ? (
          <div className="apr3-period-inline-range">
            <ModernDatePicker value={customFrom} onChange={setCustomFrom} ariaLabel={`From date ${customFrom ? fmtDate(customFrom) : "not selected"}`} />
            <span className="apr3-range-sep">to</span>
            <ModernDatePicker value={customTo} onChange={setCustomTo} ariaLabel={`To date ${customTo ? fmtDate(customTo) : "not selected"}`} />
            <AppButton variant="primary" size="sm" onClick={() => loadData()} disabled={!customFrom || !customTo}>Apply</AppButton>
          </div>
        ) : (
          <div className="apr3-period-inline-note">{statsPeriodLabel}</div>
        )}
      </div>

      <div className="apr3-stats-split">
        <div className="apr3-realtime-group">
          <div className="apr3-stat apr3-stat-realtime">
            <div className="apr3-stat-icon bg-[#fff7ed] text-[#ea580c]"><IconPending /></div>
            <div>
              <div className="apr3-stat-num text-[#ea580c]">{pendingCount}</div>
              <div className="apr3-stat-label">Pending action</div>
              <div className="apr3-stat-sub">Real-time</div>
            </div>
          </div>
          <div className="apr3-stat apr3-stat-realtime">
            <div className="apr3-stat-icon bg-[#ecfdf5] text-[#059669]"><IconCheckCircle /></div>
            <div>
              <div className="apr3-stat-num text-[#059669]">{readyNowCount}</div>
              <div className="apr3-stat-label">Ready now</div>
              <div className="apr3-stat-sub">Can be actioned now</div>
            </div>
          </div>
        </div>
        <div className="apr3-scoped-group">
          <div className="apr3-scoped-pill">Scoped by: {statsPeriodLabel}</div>
          <div className="apr3-stats apr3-stats-scoped">
            <div className="apr3-stat">
              <div className="apr3-stat-icon bg-[#eef2ff] text-[#4f46e5]"><IconApproved /></div>
              <div>
                <div className="apr3-stat-num text-[#4f46e5]">{stats.approvedThisMonth ?? "-"}</div>
                <div className="apr3-stat-label">Approved</div>
                <div className="apr3-stat-sub">{statsPeriod}</div>
              </div>
            </div>
            <div className="apr3-stat">
              <div className={`apr3-stat-icon ${rejectedCount > 0 ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[var(--n-100)] text-[var(--text-tertiary)]"}`}><IconRejected /></div>
              <div>
                <div className={`apr3-stat-num ${rejectedCount > 0 ? "text-[#dc2626]" : "text-[var(--text-secondary)]"}`}>{stats.rejectedThisMonth ?? "-"}</div>
                <div className="apr3-stat-label">Rejected</div>
                <div className="apr3-stat-sub">{statsPeriod}</div>
              </div>
            </div>
            <div className="apr3-stat">
              <div className={`apr3-stat-icon ${reviewRequiredCount > 0 ? "bg-[#fffbeb] text-[#d97706]" : "bg-[var(--n-100)] text-[var(--text-tertiary)]"}`}><IconAlert /></div>
              <div>
                <div className={`apr3-stat-num ${reviewRequiredCount > 0 ? "text-[#b45309]" : "text-[var(--text-secondary)]"}`}>{reviewRequiredCount}</div>
                <div className="apr3-stat-label">Needs review</div>
                <div className="apr3-stat-sub">Pending queue</div>
              </div>
            </div>
            <div className="apr3-stat">
              <div className="apr3-stat-icon bg-[#f8fafc] text-[var(--text-secondary)]" title="Average time from submission to final decision."><IconClock /></div>
              <div>
                <div className="apr3-stat-num">{fmtResponseTime(stats.avgResponseHours)}</div>
                <div className="apr3-stat-label">Avg. response time</div>
                <div className="apr3-stat-sub">{avgTrendText}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="apr3-tabs">
        {tabs.map(({ key, label, count, disabled }) => (
          <AppButton key={key} variant="ghost" className={`apr3-tab${tab === key ? " active" : ""}${disabled ? " apr3-tab-disabled" : ""}`} onClick={() => !disabled && setTab(key)} disabled={disabled}>
            {label}<span className="apr3-tab-count">{count}</span>
          </AppButton>
        ))}
      </div>

      {showTs && (
        <div className="apr3-filter-shell">
          <div className="apr3-filter-search-wrap">
            <span className="apr3-filter-search-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <AppInput
              className="apr3-search apr3-search-modern"
              placeholder="Search employee by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <AppButton className="apr3-filter-clear" variant="ghost" size="sm" onClick={() => setSearch("")} aria-label="Clear search">
                Clear
              </AppButton>
            )}
          </div>
          <div className="apr3-filter-sort-wrap">
            <label className="apr3-filter-sort-label" htmlFor="apr-sort-select">Sort by</label>
            <AppSelect id="apr-sort-select" className="apr3-sort apr3-sort-modern" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="waiting">Longest waiting</option>
              <option value="name">Employee name</option>
              <option value="hours">Hours logged</option>
              <option value="period">Period date</option>
            </AppSelect>
            <AppButton
              className="apr3-sort-direction"
              variant="ghost"
              size="sm"
              onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
              aria-label={`Sort direction ${sortDirection === "asc" ? "ascending" : "descending"}`}
              title={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </AppButton>
          </div>
        </div>
      )}

      <div className="apr3-list">
        {pendingCount === 0 && <EmptyApprovals />}

        {showTs && filteredTsPending.length > 0 && (
          <div className={`apr3-select-bar ${selectedIds.size > 0 ? "apr3-select-bar-active" : ""}`}>
            {hasManyTimesheets ? (
              <>
                <AppButton variant="ghost" className="apr3-select-hit" onClick={() => toggleSelectAll(filteredTsPending.map((a) => a.timesheetId))} aria-label="Toggle select all timesheets">
                  <AppCheckbox readOnly checked={selectedIds.size === filteredTsPending.length && filteredTsPending.length > 0} />
                </AppButton>
                <span className="text-[0.8rem] text-text-secondary">{selectedIds.size === filteredTsPending.length && filteredTsPending.length > 0 ? "Deselect all" : "Select all"}</span>
              </>
            ) : (
              <span className="text-[0.8rem] text-text-secondary">1 timesheet pending</span>
            )}
            {selectedCount > 0 && <span className="text-[0.78rem] text-brand-600 font-semibold">{selectedCount} selected</span>}
            {selectedCount > 0 && (
              <span className="text-[0.74rem] text-[var(--text-secondary)]">
                {selectedEligibleCount} eligible
                {selectedIneligibleCount > 0 ? ` · ${selectedIneligibleCount} needs manual review` : ""}
              </span>
            )}
            <AppButton
              className={(!canBulkApprove ? "apr3-bulk-disabled" : "")}
              variant="primary"
              size="sm"
              onClick={() => void bulkApprove()}
              disabled={!canBulkApprove || selectedEligibleCount === 0}
              title={selectedEligibleCount > 0 ? `Approve ${selectedEligibleCount} eligible selected` : "Select one or more eligible timesheets"}
            >
              {bulkApproving ? "Approving..." : selectedCount > 0 ? `Approve ${selectedEligibleCount} selected` : "Approve selected"}
            </AppButton>
            <AppButton variant="outline" size="sm" onClick={() => setBulkRejectMode((v) => !v)} disabled={selectedCount === 0}>
              Request correction selected
            </AppButton>
            {bulkRejectMode && (
              <div className="apr3-bulk-reject">
                <label className="apr3-input-label" htmlFor="bulk-reject-comment">Correction note</label>
                <AppInput
                  id="bulk-reject-comment"
                  className="flex-1"
                  value={bulkRejectComment}
                  onChange={(e) => setBulkRejectComment(e.target.value)}
                  placeholder="What should be corrected?"
                />
                <span className="apr3-char-count">{bulkRejectComment.length}/500</span>
                <AppButton variant="primary" size="sm" onClick={() => void bulkRequestCorrection()} disabled={bulkRejecting || bulkRejectComment.trim().length === 0}>
                  {bulkRejecting ? "Sending..." : "Send"}
                </AppButton>
              </div>
            )}
          </div>
        )}

        {showTs && filteredTsPending.length > 0 && (
          <div className="apr3-table-head" aria-label="Approval columns">
            <AppButton variant="ghost" className="apr3-head-btn" onClick={() => toggleSort("name")}>
              Employee {sortBy === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </AppButton>
            <AppButton variant="ghost" className="apr3-head-btn" onClick={() => toggleSort("period")}>
              Period {sortBy === "period" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </AppButton>
            <AppButton variant="ghost" className="apr3-head-btn" onClick={() => toggleSort("hours")}>
              Hours logged {sortBy === "hours" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </AppButton>
            <AppButton variant="ghost" className="apr3-head-btn" onClick={() => toggleSort("waiting")}>
              Waiting {sortBy === "waiting" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </AppButton>
          </div>
        )}

        {showTs && filteredTsPending.map((a) => {
          const mismatch = sanitizeMismatch(a.mismatchReason);
          const requiresReview = a.enteredMinutes === 0 || mismatch !== null;
          const days = waitingDays(a.submittedAtUtc, a.workDate);
          const tone = waitingTone(days);
          const person = a.displayName && a.displayName.trim().length > 0 ? a.displayName : a.username;

          return (
            <div key={a.timesheetId} className="apr3-card [border-left:3px_solid_var(--brand-500)]">
              <div className="apr3-card-inner">
                <AppButton variant="ghost" className="apr3-select-hit" onClick={() => toggleSelect(a.timesheetId)} aria-label={`Select ${person}`}>
                  <AppCheckbox readOnly checked={selectedIds.has(a.timesheetId)} />
                </AppButton>
                <div className="apr3-avatar" style={{ background: avatarColor(a.userId ?? a.username) }}>{initials(person)}</div>
                <div className="apr3-meta">
                  <div className="apr3-meta-title apr3-meta-grid">
                    <span><span className="apr3-meta-label">Employee</span>{person}</span>
                    <span><span className="apr3-meta-label">Period</span>{fmtDate(a.workDate)}</span>
                    <span><span className="apr3-meta-label">Hours logged</span>{fmtHours(a.enteredMinutes)}</span>
                    <span className={`apr3-age-pill apr3-age-${tone}`}>Waiting {days} day{days === 1 ? "" : "s"}</span>
                  </div>
                  <div className="apr3-meta-sub">
                    {requiresReview ? <span className="apr3-warning-chip">{a.enteredMinutes === 0 ? "Review required: 0h submitted" : `Review required: ${mismatch}`}</span> : <strong>Ready for approval</strong>}
                    {a.delegatedFromUsername && <span className="apr3-tag">Delegate: {a.delegatedFromUsername}</span>}
                  </div>
                </div>
                <div className="apr3-right">
                  <div className="apr3-actions">
                    <AppButton variant="primary" size="sm" className={requiresReview ? "apr3-bulk-disabled" : ""} onClick={() => void approveTs(a.timesheetId, requiresReview)} disabled={requiresReview} title={requiresReview ? "Cannot approve: 0 hours or mismatch detected. Request correction first." : "Approve timesheet"} aria-label="Approve timesheet">Approve</AppButton>
                    <AppButton variant="outline" size="sm" className="btn btn-outline-reject" onClick={() => toggleReject(a.timesheetId, "ts")} aria-label="Request correction">Request correction</AppButton>
                    <AppButton
                      variant="ghost"
                      size="sm"
                      onClick={() => void openTimesheetDetail(a.timesheetId)}
                      aria-expanded={detailId === a.timesheetId}
                      aria-controls={`ts-detail-${a.timesheetId}`}
                    >
                      {detailId === a.timesheetId ? "Hide details" : "View details"}
                    </AppButton>
                  </div>
                </div>
              </div>

              {detailId === a.timesheetId && (
                <div id={`ts-detail-${a.timesheetId}`} className="apr3-detail-panel">
                  {detailLoading && <div className="text-[0.82rem] text-[var(--text-secondary)]">Loading timesheet details...</div>}
                  {!detailLoading && detail && (
                    <>
                      <div className="apr3-detail-head"><span>{detail.displayName} ({detail.username})</span><span>{fmtDate(detail.workDate)}</span></div>
                      <div className="apr3-detail-list">
                        {detail.entries.length === 0 && <div className="text-[0.8rem] text-[var(--text-secondary)]">No entries found.</div>}
                        {detail.entries.map((entry) => (
                          <div key={entry.id} className="apr3-detail-row">
                            <div>
                              <div className="font-semibold text-[0.82rem]">{entry.projectName}</div>
                              <div className="text-[0.75rem] text-[var(--text-secondary)]">{entry.taskCategoryName}</div>
                              {entry.notes && <div className="text-[0.75rem] text-[var(--text-tertiary)]">{entry.notes}</div>}
                            </div>
                            <div className="font-semibold text-[0.82rem]">{fmtHours(entry.minutes)}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {!detailLoading && !detail && <div className="text-[0.82rem] text-[var(--error)]">Unable to load details.</div>}
                </div>
              )}

              {rejectFor?.id === a.timesheetId && rejectFor.kind === "ts" && (
                <div className="apr3-reject-row">
                  <label className="apr3-input-label" htmlFor={`ts-correct-${a.timesheetId}`}>Correction note</label>
                  <AppInput
                    id={`ts-correct-${a.timesheetId}`}
                    className="flex-1 max-w-[520px]"
                    placeholder="What should be corrected?"
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value.slice(0, 500))}
                    autoFocus
                  />
                  <span className="apr3-char-count">{rejectComment.length}/500</span>
                  <AppButton variant="primary" size="sm" onClick={() => void confirmRejectTs(a.timesheetId)}>Send correction request</AppButton>
                  <AppButton variant="ghost" size="sm" onClick={() => setRejectFor(null)}>Cancel</AppButton>
                </div>
              )}
            </div>
          );
        })}

        {tab === "timesheets" && filteredTsPending.length === 0 && (
          <div className="apr3-empty">
            <div className="apr3-empty-icon">✓</div>
            <div className="font-semibold">You are all caught up</div>
            <div>No timesheet approvals need your attention right now.</div>
          </div>
        )}

        {showLeave && leavePending.map((l) => (
          <div key={l.id} className="apr3-card [border-left:3px_solid_#f59e0b]">
            <div className="apr3-card-inner">
              <div className="apr3-avatar" style={{ background: avatarColor(l.username) }}>{initials(l.username)}</div>
              <div className="apr3-meta">
                <div className="apr3-meta-title">{l.username} - {l.leaveTypeName} Request</div>
                <div className="apr3-meta-sub">{fmtDate(l.leaveDate)} - <strong>{l.isHalfDay ? "Half day" : "1 day"}</strong>{l.comment && <> - {l.comment}</>}</div>
              </div>
              <div className="apr3-right">
                <div className="apr3-actions">
                  <AppButton variant="primary" size="sm" onClick={() => void approveLeave(l.id)} aria-label="Approve leave">Approve</AppButton>
                  <AppButton variant="outline" size="sm" className="btn btn-outline-reject" onClick={() => toggleReject(l.id, "leave")} aria-label="Reject leave">Reject</AppButton>
                </div>
              </div>
            </div>
            {rejectFor?.id === l.id && rejectFor.kind === "leave" && (
              <div className="apr3-reject-row">
                <AppInput className="flex-1 max-w-[520px]" placeholder="Reason for rejection (required)" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} autoFocus />
                <AppButton variant="danger" size="sm" onClick={() => void confirmRejectLeave(l.id)}>Confirm reject</AppButton>
                <AppButton variant="ghost" size="sm" onClick={() => setRejectFor(null)}>Cancel</AppButton>
              </div>
            )}
          </div>
        ))}

        {tab === "leave" && leavePending.length === 0 && (
          <div className="apr3-empty">
            <div className="apr3-empty-icon">🌴</div>
            <div className="font-semibold">You are all caught up</div>
            <div>No leave requests need your attention right now.</div>
          </div>
        )}
      </div>

      {showDelegateModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setShowDelegateModal(false); }}>
          <div style={{ background: "var(--color-n-0, #fff)", borderRadius: 12, padding: "28px 32px", width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Delegate Approvals</span>
              <AppButton variant="ghost" size="sm" onClick={() => setShowDelegateModal(false)} aria-label="Close">x</AppButton>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: 4 }}>Delegate to</label>
                <AppSelect value={delegateToUserId} onChange={(e) => setDelegateToUserId(e.target.value)} className="w-full">
                  <option value="">Select a manager or admin...</option>
                  {delegateUsers.map((u) => (<option key={u.id} value={u.id}>{u.displayName || u.username}</option>))}
                </AppSelect>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: 4 }}>From date</label>
                  <AppInput type="date" value={delegateFromDate} onChange={(e) => setDelegateFromDate(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: 4 }}>To date</label>
                  <AppInput type="date" value={delegateToDate} onChange={(e) => setDelegateToDate(e.target.value)} className="w-full" />
                </div>
              </div>
              {delegateDateError && <p className="apr3-form-error">{delegateDateError}</p>}

              <p style={{ fontSize: "0.80rem", color: "#6b7280", margin: 0 }}>The selected manager will be able to approve, reject, and request correction on your behalf during this period.</p>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
              <AppButton variant="ghost" size="sm" onClick={() => setShowDelegateModal(false)} disabled={delegateSaving}>Cancel</AppButton>
              <AppButton variant="primary" onClick={() => void handleSaveDelegate()} disabled={delegateSaving || !delegateToUserId || !delegateFromDate || !delegateToDate}>
                {delegateSaving ? "Saving..." : "Save Delegation"}
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
