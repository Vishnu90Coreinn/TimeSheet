/**
 * Timesheets.tsx — v3.0 PulseHQ redesign
 * Two-column layout: main content + sticky sidebar.
 * Week strip, inline entry form, entry cards, attendance timer sidebar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { SkeletonPage } from "./Skeleton";
import { EmptyTimesheets } from "./EmptyState";
import { TimePickerInput } from "./TimePickerInput";
import type { AttendanceSummary } from "./AttendanceWidget";
import type { OvertimeSummary, Project, TaskCategory, TimesheetDay, TimesheetEntry, WeekDayMeta, WeekSummary } from "../types";
import { useTimezone } from "../hooks/useTimezone";

/* ─── Constants ────────────────────────────────────────────────────────────── */
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const BORDER_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface EntryForm {
  description: string;
  projectId: string;
  taskCategoryId: string;
  durationHours: string;
  startTime: string;
  endTime: string;
  editingId: string | null;
}

interface TimerSessionData {
  id: string;
  projectId: string;
  projectName: string;
  categoryId: string;
  categoryName: string;
  note: string | null;
  startedAtUtc: string;
  stoppedAtUtc: string | null;
  durationMinutes: number | null;
  convertedToEntryId: string | null;
}

interface TemplateItem {
  id: string;
  name: string;
  entries: { projectId: string; categoryId: string; minutes: number; note: string | null }[];
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse a UTC ISO string from the API (may lack trailing Z) as UTC. */
function parseUtcLocal(iso: string): Date {
  if (!iso.endsWith("Z") && !iso.includes("+")) return new Date(iso + "Z");
  return new Date(iso);
}

function fmtTime(iso: string, timeZoneId?: string): string {
  return parseUtcLocal(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timeZoneId });
}

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function fmtMins(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function fmtHours(minutes: number): string {
  return (minutes / 60).toFixed(1) + "h";
}

/** Returns an array of 7 ISO date strings for the Mon–Sun week containing `anyDate`. */
function getWeekDays(anyDate: string): string[] {
  const d = new Date(anyDate + "T00:00:00");
  // getDay(): 0=Sun,1=Mon,...,6=Sat. We want Mon=0 offset.
  const dow = (d.getDay() + 6) % 7; // Mon=0, Sun=6
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  });
}

function getWeekStart(anyDate: string): string {
  return getWeekDays(anyDate)[0];
}

function fmtWeekRange(weekDays: string[]): string {
  if (!weekDays.length) return "";
  const s = new Date(weekDays[0] + "T00:00:00");
  const e = new Date(weekDays[6] + "T00:00:00");
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

function fmtDateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function fmtDayBarLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function projectColor(projects: Project[], projectId: string): string {
  const idx = projects.findIndex((p) => p.id === projectId);
  return BORDER_COLORS[(idx >= 0 ? idx : 0) % BORDER_COLORS.length];
}

interface ParsedNotes {
  timeRange: string | null;
  description: string;
  isLive: boolean;
}

function parseNotes(raw: string | null): ParsedNotes {
  if (!raw) return { timeRange: null, description: "", isLive: false };
  // Match [HH:MM-HH:MM] at start
  const m = /^\[(\d{2}:\d{2}-\d{2}:\d{2})\]\s*/.exec(raw);
  if (m) {
    return { timeRange: m[1], description: raw.slice(m[0].length), isLive: false };
  }
  // Match [LIVE HH:MM]
  const live = /^\[LIVE (\d{2}:\d{2})\]\s*/.exec(raw);
  if (live) {
    return { timeRange: live[1], description: raw.slice(live[0].length), isLive: true };
  }
  return { timeRange: null, description: raw, isLive: false };
}

function blankForm(projects: Project[], categories: TaskCategory[]): EntryForm {
  return {
    description: "",
    projectId: projects[0]?.id ?? "",
    taskCategoryId: categories[0]?.id ?? "",
    durationHours: "",
    startTime: "",
    endTime: "",
    editingId: null,
  };
}

function computeDurationFromTimes(start: string, end: string): string {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return "";
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const diff = endMins - startMins;
  if (diff <= 0) return "";
  return (diff / 60).toFixed(2);
}

/* ─── Component ─────────────────────────────────────────────────────────────── */
export function Timesheets() {
  const toast = useToast();
  const { timeZoneId } = useTimezone();
  // Attendance state
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [weekData, setWeekData] = useState<WeekSummary | null>(null);
  const [overtimeSummary, setOvertimeSummary] = useState<OvertimeSummary | null>(null);
  const [dayData, setDayData] = useState<TimesheetDay | null>(null);
  const [loading, setLoading] = useState(true);

  // Entry form state
  const [showForm, setShowForm] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [form, setForm] = useState<EntryForm>({ description: "", projectId: "", taskCategoryId: "", durationHours: "", startTime: "", endTime: "", editingId: null });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Submit form state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitNotes, setSubmitNotes] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Delete confirm modal
  const [deleteModal, setDeleteModal] = useState<string | null>(null); // entry id

  // Bulk submit week modal
  const [showSubmitWeekModal, setShowSubmitWeekModal] = useState(false);
  const [submitWeekLoading, setSubmitWeekLoading] = useState(false);

  // Task-level timer state
  const [activeTimer, setActiveTimer] = useState<TimerSessionData | null>(null);
  const [taskElapsed, setTaskElapsed] = useState(0);
  const taskTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerProjectId, setTimerProjectId] = useState("");
  const [timerCategoryId, setTimerCategoryId] = useState("");
  const [timerNote, setTimerNote] = useState("");
  const [timerLoading, setTimerLoading] = useState(false);
  const [stoppedTimer, setStoppedTimer] = useState<TimerSessionData | null>(null);
  const [convertDate, setConvertDate] = useState(todayIso());
  const [convertLoading, setConvertLoading] = useState(false);
  const [timerHistory, setTimerHistory] = useState<TimerSessionData[]>([]);

  // Template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateApplyingId, setTemplateApplyingId] = useState<string | null>(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);

  /* ── Attendance ───────────────────────────────────────────────────────────── */
  const loadAttendance = useCallback(async () => {
    const r = await apiFetch("/attendance/summary/today");
    if (r.ok) {
      const data: AttendanceSummary = await r.json();
      setAttendance(data);
    }
  }, []);

  /* ── Data loading ─────────────────────────────────────────────────────────── */
  const loadWeek = useCallback(async (anyDate: string) => {
    const r = await apiFetch(`/timesheets/week?anyDateInWeek=${anyDate}`);
    if (r.ok) setWeekData(await r.json() as WeekSummary);
  }, []);

  const loadOvertimeSummary = useCallback(async (weekStart: string) => {
    const r = await apiFetch(`/overtime/summary?weekStart=${weekStart}`);
    if (!r.ok) {
      setOvertimeSummary(null);
      return;
    }
    const data = await r.json().catch(() => null) as OvertimeSummary | null;
    setOvertimeSummary(data);
  }, []);

  const loadDay = useCallback(async (date: string) => {
    const r = await apiFetch(`/timesheets/day?workDate=${date}`);
    if (r.ok) setDayData(await r.json() as TimesheetDay);
    else setDayData(null);
  }, []);

  const loadActiveTimer = useCallback(async () => {
    const r = await apiFetch("/timers/active");
    if (r.ok) setActiveTimer(await r.json() as TimerSessionData);
    else setActiveTimer(null);
  }, []);

  const loadTimerHistory = useCallback(async () => {
    const r = await apiFetch(`/timers/history?date=${todayIso()}`);
    if (r.ok) setTimerHistory(await r.json() as TimerSessionData[]);
  }, []);

  // Init
  useEffect(() => {
    Promise.all([
      loadAttendance(),
      loadWeek(selectedDate),
      loadOvertimeSummary(getWeekStart(selectedDate)),
      loadDay(selectedDate),
      loadActiveTimer(),
      loadTimerHistory(),
      apiFetch("/timesheets/entry-options").then(async (r) => {
        if (!r.ok) return;
        const d = await r.json() as { projects: Project[]; taskCategories: TaskCategory[] };
        setProjects(d.projects);
        setCategories(d.taskCategories);
        setForm(blankForm(d.projects, d.taskCategories));
        setTimerProjectId((prev) => prev || d.projects[0]?.id || "");
        setTimerCategoryId((prev) => prev || d.taskCategories[0]?.id || "");
      }),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Task timer live counter
  useEffect(() => {
    if (taskTimerRef.current) clearInterval(taskTimerRef.current);
    if (activeTimer) {
      const start = parseUtcLocal(activeTimer.startedAtUtc).getTime();
      const tick = () => setTaskElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      taskTimerRef.current = setInterval(tick, 1000);
    } else {
      setTaskElapsed(0);
    }
    return () => { if (taskTimerRef.current) clearInterval(taskTimerRef.current); };
  }, [activeTimer?.id, activeTimer?.startedAtUtc]);

  // Poll active timer every 30s to survive page refresh
  useEffect(() => {
    const poll = setInterval(() => { void loadActiveTimer(); }, 30_000);
    return () => clearInterval(poll);
  }, [loadActiveTimer]);

  // Global keyboard shortcut listeners
  useEffect(() => {
    function onNewEntry() { setShowForm(true); }
    function onSubmitWeek() { setShowSubmitWeekModal(true); }
    window.addEventListener("cmd:new-entry", onNewEntry);
    window.addEventListener("cmd:submit-week", onSubmitWeek);
    return () => {
      window.removeEventListener("cmd:new-entry", onNewEntry);
      window.removeEventListener("cmd:submit-week", onSubmitWeek);
    };
  }, []);

  /* ── Week navigation ─────────────────────────────────────────────────────── */
  function shiftWeek(days: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().slice(0, 10);
    selectDay(newDate);
  }

  /* ── Day selection ────────────────────────────────────────────────────────── */
  function selectDay(date: string) {
    const oldWeekDays = getWeekDays(selectedDate);
    const newWeekDays = getWeekDays(date);
    setSelectedDate(date);
    void loadDay(date);
    if (oldWeekDays[0] !== newWeekDays[0]) {
      void loadWeek(date);
      void loadOvertimeSummary(newWeekDays[0]);
    }
    setShowForm(false);
    setShowSubmitForm(false);
    setSubmitSuccess("");
  }

  /* ── Entry form helpers ───────────────────────────────────────────────────── */
  function setFormField(patch: Partial<EntryForm>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // Auto-compute duration when both times are set
      if (("startTime" in patch || "endTime" in patch)) {
        const computed = computeDurationFromTimes(next.startTime, next.endTime);
        if (computed) next.durationHours = computed;
      }
      return next;
    });
  }

  function openEdit(entry: TimesheetEntry) {
    const parsed = parseNotes(entry.notes);
    let startTime = "";
    let endTime = "";
    if (parsed.timeRange) {
      [startTime, endTime] = parsed.timeRange.split("-");
    }
    setForm({
      description: parsed.description,
      projectId: entry.projectId,
      taskCategoryId: entry.taskCategoryId,
      durationHours: (entry.minutes / 60).toFixed(2),
      startTime: startTime ?? "",
      endTime: endTime ?? "",
      editingId: entry.id,
    });
    setShowTimePicker(Boolean(startTime));
    setShowForm(true);
    setFormError("");
  }

  function openNew() {
    setForm(blankForm(projects, categories));
    setFormError("");
    setShowTimePicker(false);
    setShowForm(true);
  }

  async function saveEntry() {
    setFormError("");
    // Compute minutes
    let minutes = 0;
    if (form.startTime && form.endTime) {
      const computed = computeDurationFromTimes(form.startTime, form.endTime);
      if (!computed) {
        setFormError("End time must be after start time.");
        return;
      }
      minutes = Math.round(parseFloat(computed) * 60);
    } else if (form.durationHours) {
      const h = parseFloat(form.durationHours);
      if (isNaN(h) || h <= 0) {
        setFormError("Enter a valid duration (e.g. 1.5).");
        return;
      }
      minutes = Math.round(h * 60);
    } else {
      setFormError("Enter a duration or start/end times.");
      return;
    }
    if (!form.projectId) {
      setFormError("Please select a project.");
      return;
    }
    if (minutes <= 0 || minutes > 1440) {
      setFormError("Duration must be between 1 minute and 24 hours.");
      return;
    }

    // Build notes string
    let notes = form.description || "";
    if (form.startTime && form.endTime) {
      notes = `[${form.startTime}-${form.endTime}]${notes ? " " + notes : ""}`;
    }

    setSaving(true);
    const r = await apiFetch("/timesheets/entries", {
      method: "POST",
      body: JSON.stringify({
        workDate: selectedDate,
        entryId: form.editingId,
        projectId: form.projectId,
        taskCategoryId: form.taskCategoryId,
        minutes,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (r.ok) {
      const updated = await r.json() as TimesheetDay;
      setDayData(updated);
      void loadWeek(selectedDate);
      setShowForm(false);
      setForm(blankForm(projects, categories));
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      setFormError(body.message ?? "Failed to save entry.");
    }
  }

  async function deleteEntry(entryId: string) {
    setDeleteModal(entryId);
  }

  async function confirmDeleteEntry() {
    if (!deleteModal) return;
    const id = deleteModal;
    setDeleteModal(null);
    const r = await apiFetch(`/timesheets/entries/${id}`, { method: "DELETE" });
    if (r.ok) {
      setDayData(await r.json() as TimesheetDay);
      void loadWeek(selectedDate);
    }
  }

  async function submitTimesheet() {
    setSubmitError("");
    setSubmitSuccess("");
    const r = await apiFetch("/timesheets/submit", {
      method: "POST",
      body: JSON.stringify({ workDate: selectedDate, notes: submitNotes, mismatchReason }),
    });
    if (r.ok) {
      setDayData(await r.json() as TimesheetDay);
      void loadWeek(selectedDate);
      setSubmitSuccess("Timesheet submitted for approval.");
      setShowSubmitForm(false);
    } else {
      const body = await r.json().catch(() => ({})) as { detail?: string; message?: string };
      setSubmitError(body.detail ?? body.message ?? "Submission failed.");
    }
  }

  /* ── Bulk week submit ─────────────────────────────────────────────────────── */
  async function submitWeek() {
    setSubmitWeekLoading(true);
    const weekStart = getWeekDays(selectedDate)[0]; // Mon of current view
    const r = await apiFetch("/timesheets/submit-week", {
      method: "POST",
      body: JSON.stringify({ weekStart }),
    });
    setSubmitWeekLoading(false);
    setShowSubmitWeekModal(false);
    if (r.ok) {
      const result = await r.json() as { submitted: string[]; skipped: { date: string; reason: string }[]; errors: { date: string; message: string }[] };
      const n = result.submitted.length;
      const msg = n > 0
        ? `${n} day${n > 1 ? "s" : ""} submitted${result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : ""}.`
        : `No days submitted — ${result.skipped.length} skipped.`;
      toast.success(msg);
      // Reload week + selected day
      void loadWeek(selectedDate);
      void loadDay(selectedDate);
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      toast.error(body.message ?? "Week submission failed.");
    }
  }

  /* ── Task timer actions ───────────────────────────────────────────────────── */
  async function startTaskTimer() {
    if (!timerProjectId || !timerCategoryId) return;
    setTimerLoading(true);
    const r = await apiFetch("/timers/start", {
      method: "POST",
      body: JSON.stringify({ projectId: timerProjectId, categoryId: timerCategoryId, note: timerNote || null }),
    });
    setTimerLoading(false);
    if (r.ok) {
      const timer = await r.json() as TimerSessionData;
      setActiveTimer(timer);
      localStorage.setItem("activeTimerId", timer.id);
      localStorage.setItem("activeTimerStart", timer.startedAtUtc);
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      toast.error(body.message ?? "Failed to start timer.");
    }
  }

  async function stopTaskTimer() {
    setTimerLoading(true);
    const r = await apiFetch("/timers/stop", { method: "POST" });
    setTimerLoading(false);
    if (r.ok) {
      const stopped = await r.json() as TimerSessionData;
      setActiveTimer(null);
      setStoppedTimer(stopped);
      setConvertDate(todayIso());
      localStorage.removeItem("activeTimerId");
      localStorage.removeItem("activeTimerStart");
      void loadTimerHistory();
    }
  }

  async function convertTimer() {
    if (!stoppedTimer) return;
    setConvertLoading(true);
    const r = await apiFetch(`/timers/${stoppedTimer.id}/convert`, {
      method: "POST",
      body: JSON.stringify({ workDate: convertDate }),
    });
    setConvertLoading(false);
    if (r.ok) {
      setStoppedTimer(null);
      toast.success("Entry added to timesheet.");
      void loadTimerHistory();
      if (convertDate === selectedDate) {
        void loadDay(selectedDate);
        void loadWeek(selectedDate);
      }
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      toast.error(body.message ?? "Failed to add entry.");
    }
  }

  /* ── Template actions ────────────────────────────────────────────────────── */
  async function openTemplateModal() {
    setShowTemplateModal(true);
    setTemplatesLoading(true);
    const r = await apiFetch("/timesheets/templates");
    setTemplatesLoading(false);
    if (r.ok) setTemplates(await r.json() as TemplateItem[]);
  }

  async function applyTemplate(templateId: string) {
    setTemplateApplyingId(templateId);
    const r = await apiFetch(`/timesheets/templates/${templateId}/apply`, {
      method: "POST",
      body: JSON.stringify({ workDate: selectedDate }),
    });
    setTemplateApplyingId(null);
    if (r.ok) {
      const result = await r.json() as { entriesCreated: number; entriesSkipped: number };
      setShowTemplateModal(false);
      void loadDay(selectedDate);
      void loadWeek(selectedDate);
      const msg = result.entriesCreated > 0
        ? `${result.entriesCreated} entr${result.entriesCreated === 1 ? "y" : "ies"} added from template${result.entriesSkipped > 0 ? ` (${result.entriesSkipped} skipped)` : ""}.`
        : `No new entries added (${result.entriesSkipped} already existed).`;
      toast.success(msg);
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      toast.error(body.message ?? "Failed to apply template.");
    }
  }

  async function saveAsTemplate() {
    if (!saveTemplateName.trim()) return;
    setSaveTemplateLoading(true);
    const r = await apiFetch("/timesheets/templates", {
      method: "POST",
      body: JSON.stringify({
        name: saveTemplateName.trim(),
        entries: (dayData?.entries ?? []).map(e => ({
          projectId: e.projectId,
          categoryId: e.taskCategoryId,
          minutes: e.minutes,
          note: e.notes ?? null,
        })),
      }),
    });
    setSaveTemplateLoading(false);
    if (r.ok) {
      setShowSaveTemplateModal(false);
      setSaveTemplateName("");
      toast.success("Template saved.");
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      toast.error(body.message ?? "Failed to save template.");
    }
  }

  /* ── Copy yesterday ──────────────────────────────────────────────────────── */
  async function copyYesterday() {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    const prevDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const r = await apiFetch(`/timesheets/copy-day`, {
      method: "POST",
      body: JSON.stringify({ sourceDate: prevDate, targetDate: selectedDate }),
    });
    if (r.ok) {
      const updated = await r.json() as TimesheetDay;
      setDayData(updated);
      void loadWeek(selectedDate);
      toast.success("Yesterday's entries copied.");
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      toast.error(body.message ?? "Nothing to copy from yesterday.");
    }
  }

  /* ── Derived values ───────────────────────────────────────────────────────── */
  const isDraft     = dayData?.status === "draft" || dayData === null;
  const isApproved  = dayData?.status === "approved";
  const isSubmitted = dayData?.status === "submitted";
  const isRejected  = dayData?.status === "rejected";
  const isLocked    = isApproved || isSubmitted; // entries frozen
  const isCheckedIn = Boolean(attendance?.activeSessionId);
  const weekDays    = getWeekDays(selectedDate);
  const todayWeekStart = getWeekDays(todayIso())[0];
  const isCurrentWeek  = weekDays[0] === todayWeekStart;
  const weekRange = fmtWeekRange(weekDays);
  const weekTotalMins = weekData?.weekEnteredMinutes ?? 0;
  const weekExpectedMins = weekData?.weekExpectedMinutes ?? 0;
  const weekAttendanceMins = weekData?.weekAttendanceNetMinutes ?? 0;
  const weekOvertime = weekTotalMins - weekExpectedMins;
  const overtimeMinutes = (() => {
    if (typeof overtimeSummary?.overtimeMinutes === "number") return Math.max(0, overtimeSummary.overtimeMinutes);
    if (typeof overtimeSummary?.overtimeHours === "number") return Math.max(0, Math.round(overtimeSummary.overtimeHours * 60));
    return Math.max(0, weekOvertime);
  })();
  const overtimeThresholdMinutes = (() => {
    if (typeof overtimeSummary?.thresholdMinutes === "number") return overtimeSummary.thresholdMinutes;
    if (typeof overtimeSummary?.thresholdHours === "number") return Math.round(overtimeSummary.thresholdHours * 60);
    return weekExpectedMins;
  })();

  // Build a map from workDate -> WeekDayMeta for the strip
  const weekDayMap = new Map<string, WeekDayMeta>(
    (weekData?.days ?? []).map((d) => [d.workDate, d])
  );

  // Deficit is "alarming" only after the last expected workday has passed
  const lastExpectedDayPassed = (() => {
    const today = todayIso();
    const lastWorkDay = [...weekDays].reverse().find((d) => {
      const meta = weekDayMap.get(d);
      return (meta?.expectedMinutes ?? 0) > 0;
    });
    return lastWorkDay ? today > lastWorkDay : false;
  })();

  // Count days with draft status + entries for "Submit Week" button enablement
  const submittableCount = (weekData?.days ?? []).filter(d =>
    d.status === "draft" && d.enteredMinutes > 0
  ).length;

  // Today by project (from dayData entries)
  const projectHoursMap = new Map<string, { name: string; minutes: number; color: string }>();
  const dayEntries: TimesheetEntry[] = dayData?.entries ?? [];
  dayEntries.forEach((entry) => {
    const color = projectColor(projects, entry.projectId);
    const existing = projectHoursMap.get(entry.projectId);
    if (existing) {
      existing.minutes += entry.minutes;
    } else {
      projectHoursMap.set(entry.projectId, { name: entry.projectName, minutes: entry.minutes, color });
    }
  });
  const projectHours = Array.from(projectHoursMap.values());
  const todayTotalMins = dayData?.enteredMinutes ?? 0;
  const todayExpectedMins = dayData?.expectedMinutes ?? 480;

  /* ── Render ───────────────────────────────────────────────────────────────── */
  if (loading) return <SkeletonPage kpis={3} rows={6} cols={4} />;

  return (
    <section>
      {/* ts-page: two-column layout */}
      <div className="flex gap-6 items-start">

        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Page header */}
          <div className="page-header flex items-start justify-between flex-wrap gap-3 mb-0">
            <div>
              <div className="page-title">My Timesheet</div>
              <div className="page-subtitle">
                Week of {weekRange}&nbsp;&mdash;&nbsp;{fmtHours(weekTotalMins)} logged
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button className="btn btn-outline btn-sm">Export</button>
              {isDraft && dayEntries.length > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setSaveTemplateName(""); setShowSaveTemplateModal(true); }}
                >
                  Save as Template
                </button>
              )}
              {submittableCount > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowSubmitWeekModal(true)}
                  title={`Submit all ${submittableCount} draft day${submittableCount > 1 ? "s" : ""} this week`}
                >
                  Submit Week ({submittableCount})
                </button>
              )}
              {isDraft && dayEntries.length > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowSubmitForm((v) => !v)}
                >
                  Send for Review
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={openNew}
                disabled={isLocked}
                title={isLocked ? `Entries cannot be added to ${isApproved ? "an" : "a"} ${dayData?.status} timesheet` : undefined}
                style={isLocked ? { opacity: 0.45, cursor: "not-allowed", pointerEvents: "none" } : undefined}
              >
                + Add Entry
              </button>
            </div>
          </div>

          {/* Week strip with prev/next navigation */}
          <div className="flex items-stretch gap-[6px]">
            <button
              className="ts-week-nav-btn"
              onClick={() => shiftWeek(-7)}
              title="Previous week"
              aria-label="Previous week"
            >
              &#8249;
            </button>
            <div className="flex-1 grid grid-cols-7 gap-[6px]">
            {weekDays.map((date, i) => {
              const meta = weekDayMap.get(date);
              const mins = meta?.enteredMinutes ?? 0;
              const expected = meta?.expectedMinutes ?? 480;
              // When expected === 0 (rest/Sunday) but hours logged, show bar as filled
              const pct = expected > 0
                ? Math.min(100, Math.round((mins / expected) * 100))
                : mins > 0 ? 100 : 0;
              const isPastDay = date < todayIso();
              const fillColor = expected === 0 && mins > 0
                ? "#a5b4fc"                                           // light indigo — rest day, no target
                : pct >= 100 ? "#10b981"                             // green — target met
                : pct > 0 && isPastDay ? "#f59e0b"                   // amber — partial, past day
                : pct > 0 ? "#6366f1"                                // indigo — in progress (today/future)
                : isPastDay && expected > 0 ? "#fca5a5"              // light red — no entries, missed past day
                : "transparent";
              const isSelected = date === selectedDate;
              const isToday = date === todayIso();
              const dayApproved = meta?.status === "approved";
              return (
                <button
                  key={date}
                  className={[
                    "ts-day-card",
                    isSelected ? "ts-day-card--selected" : "",
                    isToday ? "ts-day-card--today" : "",
                    dayApproved ? "ts-day-card--approved" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => selectDay(date)}
                >
                  <div className="text-[10px] font-semibold tracking-[0.06em] text-text-secondary uppercase">
                    {DAY_LABELS[i]}
                  </div>
                  <div className="relative inline-flex items-center gap-[3px] text-[18px] font-semibold text-[var(--n-900,#111827)] leading-none">
                    {new Date(date + "T00:00:00").getDate()}
                    {dayApproved && (
                      <svg className="shrink-0 align-middle" width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="6" fill="#10b981"/>
                        <path d="M3 6l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className={`text-[11px] ${mins > 0 ? "text-brand-500 font-semibold" : "text-[var(--n-400,#9ca3af)]"}`}>
                    {mins > 0 ? fmtHours(mins) : "—"}
                  </div>
                  <div className="w-full px-[2px]">
                    <div className="h-[3px] bg-[var(--n-100,#f3f4f6)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${pct}%`, backgroundColor: fillColor }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
            <button
              className="ts-week-nav-btn"
              onClick={() => shiftWeek(7)}
              title="Next week"
              aria-label="Next week"
            >
              &#8250;
            </button>
          </div>

          {/* Entry form */}
          {showForm && (
            <div className="border-2 border-dashed border-[#a5b4fc] rounded-xl bg-[#eef2ff] p-5 flex flex-col gap-[14px]">
              <div className="text-[13px] font-semibold text-[#4338ca]">
                + {form.editingId ? "Edit" : "New"} time entry &mdash; {fmtDateLabel(selectedDate)}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-[var(--n-600,#4b5563)]">Task / Description</label>
                <textarea
                  className="ts-form-input resize-y"
                  rows={2}
                  placeholder="What did you work on?"
                  value={form.description}
                  onChange={(e) => setFormField({ description: e.target.value })}
                />
              </div>

              {/* Project + Category */}
              <div className="flex gap-[10px] items-start flex-wrap">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[12px] font-semibold text-[var(--n-600,#4b5563)]">Project</label>
                  <select
                    className="ts-form-input"
                    value={form.projectId}
                    onChange={(e) => setFormField({ projectId: e.target.value })}
                  >
                    <option value="">— Select project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[12px] font-semibold text-[var(--n-600,#4b5563)]">Category</label>
                  <select
                    className="ts-form-input"
                    value={form.taskCategoryId}
                    onChange={(e) => setFormField({ taskCategoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration OR Start/End time — progressive disclosure */}
              {!showTimePicker ? (
                <div className="flex gap-[10px] items-end flex-wrap">
                  <div className="flex flex-col gap-1 w-[140px] shrink-0">
                    <label className="text-[12px] font-semibold text-[var(--n-600,#4b5563)]">Duration (h)</label>
                    <input
                      className="ts-form-input"
                      placeholder="e.g. 1.5"
                      value={form.durationHours}
                      onChange={(e) => setFormField({ durationHours: e.target.value.replace(",", ".") })}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-[12px] text-brand-500 hover:underline pb-[7px] whitespace-nowrap"
                    onClick={() => setShowTimePicker(true)}
                  >
                    Set start &amp; end time instead
                  </button>
                </div>
              ) : (
                <div className="flex gap-[10px] items-end flex-wrap">
                  <TimePickerInput
                    label="Start time"
                    value={form.startTime}
                    onChange={(v) => setFormField({ startTime: v })}
                  />
                  <TimePickerInput
                    label="End time"
                    value={form.endTime}
                    onChange={(v) => setFormField({ endTime: v })}
                  />
                  {form.startTime && form.endTime && form.durationHours && (
                    <div className="flex flex-col gap-1 justify-end pb-[7px]">
                      <span className="text-[12px] font-semibold text-[#059669]">
                        = {form.durationHours}h
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="text-[12px] text-[var(--n-400,#9ca3af)] hover:underline pb-[7px] whitespace-nowrap"
                    onClick={() => { setShowTimePicker(false); setFormField({ startTime: "", endTime: "" }); }}
                  >
                    Enter duration instead
                  </button>
                </div>
              )}

              {formError && <p className="text-[12px] text-danger m-0">{formError}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setShowForm(false); setFormError(""); }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void saveEntry()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save entry"}
                </button>
              </div>
            </div>
          )}

          {/* Submit form */}
          {showSubmitForm && isDraft && (
            <div className="border-[1.5px] border-border-subtle rounded-xl bg-white p-5 flex flex-col gap-[14px]">
              <div className="text-[14px] font-semibold text-[var(--n-900,#111827)]">Submit for Review</div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-[var(--n-600,#4b5563)]">Notes (optional)</label>
                <textarea
                  className="ts-form-input resize-y"
                  rows={3}
                  placeholder="Optional notes to your manager…"
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                />
              </div>
              {dayData?.hasMismatch && (
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-semibold text-[var(--n-600,#4b5563)]">
                    Mismatch reason <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="ts-form-input resize-y border-warning"
                    rows={3}
                    placeholder="Explain why logged hours differ from attendance hours…"
                    value={mismatchReason}
                    onChange={(e) => setMismatchReason(e.target.value)}
                  />
                  <span className="text-[11px] text-[#b45309]">Your logged hours don&apos;t match attendance. A reason is required.</span>
                </div>
              )}
              {submitError && <p className="text-[12px] text-danger m-0">{submitError}</p>}
              <div className="flex gap-2 justify-end">
                <button className="btn btn-outline btn-sm" onClick={() => setShowSubmitForm(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={() => void submitTimesheet()}>Submit Timesheet</button>
              </div>
            </div>
          )}

          {submitSuccess && (
            <div className="bg-[#f0fdf4] border-[1.5px] border-[#86efac] rounded-lg px-[14px] py-[10px] text-[13px] text-[#166534]">
              {submitSuccess}
            </div>
          )}

          {/* Semantic status banners */}
          {isApproved && (
            <div className="flex items-center gap-[10px] rounded-[10px] px-4 py-3 text-[13px] bg-[#f0fdf4] border-[1.5px] border-[#6ee7b7] text-[#065f46]">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <circle cx="10" cy="10" r="10" fill="#10b981"/>
                <path d="M5.5 10l3 3 6-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <strong>Timesheet approved</strong>
                <span className="font-normal opacity-85"> — Entries are locked and cannot be edited.</span>
              </div>
            </div>
          )}
          {isSubmitted && (
            <div className="flex items-center gap-[10px] rounded-[10px] px-4 py-3 text-[13px] bg-[#eff6ff] border-[1.5px] border-[#93c5fd] text-[#1e40af]">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <circle cx="10" cy="10" r="9" stroke="#3b82f6" strokeWidth="1.8"/>
                <path d="M10 6v4l2.5 2.5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div>
                <strong>Awaiting approval</strong>
                <span className="font-normal opacity-85"> — Submitted for manager review.</span>
              </div>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-[10px] rounded-[10px] px-4 py-3 text-[13px] bg-[#fef2f2] border-[1.5px] border-[#fca5a5] text-[#991b1b]">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <circle cx="10" cy="10" r="9" stroke="#ef4444" strokeWidth="1.8"/>
                <path d="M7 7l6 6M13 7l-6 6" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div>
                <strong>Timesheet rejected</strong>
                <span className="font-normal opacity-85"> — Please review and resubmit.</span>
              </div>
            </div>
          )}

          {/* Entries list */}
          <div className="flex flex-col gap-2">
            {dayEntries.length === 0 && !showForm ? (
              <div className="flex flex-col gap-3">
                <EmptyTimesheets onAdd={isDraft && !isLocked ? openNew : undefined} />
                {isDraft && !isLocked && (
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => void copyYesterday()}
                    >
                      Copy yesterday&apos;s entries
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => void openTemplateModal()}
                    >
                      Use Template
                    </button>
                  </div>
                )}
              </div>
            ) : (
              dayEntries.map((entry) => {
                const parsed = parseNotes(entry.notes);
                const color = projectColor(projects, entry.projectId);
                return (
                  <div
                    key={entry.id}
                    className={[
                      "ts-entry-card",
                      !isDraft ? "ts-entry-card--locked" : "",
                      isApproved ? "ts-entry-card--approved" : "",
                    ].filter(Boolean).join(" ")}
                    style={{ borderLeftColor: isApproved ? "rgb(5, 150, 105)" : color }}
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="text-[13px] font-semibold text-[var(--n-900,#111827)] flex items-center gap-[6px] whitespace-nowrap overflow-hidden text-ellipsis">
                        {parsed.description || entry.taskCategoryName}
                        {parsed.isLive && (
                          <span className="text-[10px] font-bold bg-[#dcfce7] text-[#166534] px-[6px] py-[1px] rounded-full tracking-[0.05em]">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                          style={{ backgroundColor: color + "22", color }}
                        >
                          {entry.projectName}
                        </span>
                        {parsed.timeRange && (
                          <span className="text-[11px] text-text-secondary">{parsed.timeRange.replace("-", " – ")}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-[14px] font-bold text-[var(--n-900,#111827)] whitespace-nowrap min-w-[40px] text-right">
                      {fmtHours(entry.minutes)}
                    </div>
                    {isDraft ? (
                      <div className="flex gap-1">
                        <button className="ts-icon-btn" title="Edit" onClick={() => openEdit(entry)}>
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 3.3a1 1 0 0 1 1.4 1.4L5.5 15.3l-3 .7.7-3L14.7 3.3z"/></svg>
                        </button>
                        <button className="ts-icon-btn ts-icon-btn--danger" title="Delete" onClick={() => void deleteEntry(entry.id)}>
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h14M8 6V4h4v2M6 6l1 11h6l1-11"/></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="w-[28px] h-[28px] flex items-center justify-center text-[var(--n-400,#9ca3af)] shrink-0" title={`Locked — ${dayData?.status}`}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <rect x="3" y="7" width="10" height="8" rx="1.5"/>
                          <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Day summary bar */}
          <div className={`ts-day-bar${isApproved ? " ts-day-bar--approved" : ""}`}>
            <span>{fmtDayBarLabel(selectedDate)}</span>
            <div className="flex items-center gap-[10px]">
              {todayExpectedMins > 0 ? (
                <>
                  <div className="w-[60px] h-[4px] bg-white/25 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/90 rounded-full transition-[width] duration-300"
                      style={{ width: `${Math.min(100, todayExpectedMins > 0 ? Math.round((todayTotalMins / todayExpectedMins) * 100) : 0)}%` }}
                    />
                  </div>
                  <span>{fmtHours(todayTotalMins)} / {fmtHours(todayExpectedMins)}</span>
                </>
              ) : (
                <span className="text-white/50 text-[12px]">Rest day — no target</span>
              )}
            </div>
          </div>

        </div>{/* /main column */}

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-[280px] shrink-0 flex flex-col gap-4 sticky top-[calc(60px+24px)]">

          {/* Attendance status chip (read-only) */}
          {isCheckedIn ? (
            <div className="flex items-center gap-[6px] px-3 py-2 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] text-[12px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
              <span className="font-semibold text-[#065f46]">Checked in</span>
              <span className="text-[#047857]">&middot; {fmtMins(attendance?.netMinutes ?? 0)} today</span>
            </div>
          ) : (
            <div className="flex items-center gap-[6px] px-3 py-2 rounded-lg bg-[var(--n-50,#f9fafb)] border border-[var(--border-subtle)] text-[12px]">
              <span className="w-2 h-2 rounded-full border-2 border-[var(--n-300,#d1d5db)] shrink-0" />
              <span className="text-[var(--n-400,#9ca3af)]">Not checked in today</span>
            </div>
          )}

          {/* Task Timer card */}
          <div className="ts-sidebar-card">
            <div className="ts-sidebar-section-label">
              {activeTimer && <span className="ts-green-dot ts-green-dot--pulse" />}
              TASK TIMER
            </div>

            {/* Stopped timer — confirm "Add to Timesheet?" */}
            {stoppedTimer && !activeTimer && (
              <div className="flex flex-col gap-[6px]">
                <div className="inline-flex items-center bg-[#f0fdf4] text-[#059669] rounded-[6px] px-[10px] py-[3px] text-[12px] font-bold w-fit">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="3 8 6 11 13 4"/></svg>
                  &nbsp;{fmtMins(stoppedTimer.durationMinutes ?? 0)} recorded
                </div>
                <div className="text-[12px] text-[var(--n-900,#111827)] leading-[1.4]">
                  <strong>{stoppedTimer.projectName}</strong> · {stoppedTimer.categoryName}
                  {stoppedTimer.note && (
                    <div className="text-[11px] text-text-secondary mt-[2px]">{stoppedTimer.note}</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <label className="text-[11px] text-text-secondary font-semibold">Add to date</label>
                  <input
                    type="date"
                    value={convertDate}
                    max={todayIso()}
                    onChange={(e) => setConvertDate(e.target.value)}
                    className="ts-timer-date-input"
                  />
                </div>
                <div className="flex gap-2 mt-[10px]">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={convertLoading}
                    onClick={() => void convertTimer()}
                  >
                    {convertLoading ? "Adding…" : "Add to Timesheet"}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setStoppedTimer(null)}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Running timer */}
            {activeTimer && (
              <>
                <div className="text-[24px] font-bold [font-variant-numeric:tabular-nums] text-brand-500 tracking-[0.02em] leading-none">
                  {fmtElapsed(taskElapsed)}
                </div>
                <div className="text-[12px] text-text-secondary -mt-[6px]">
                  <strong>{activeTimer.projectName}</strong> · {activeTimer.categoryName}
                </div>
                {activeTimer.note && (
                  <div className="text-[11px] text-text-secondary mt-[2px] mb-[6px]">{activeTimer.note}</div>
                )}
                <button
                  className="btn ts-btn-stop btn-sm w-full mt-2"
                  onClick={() => void stopTaskTimer()}
                  disabled={timerLoading}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" className="mr-[5px]"><rect x="2" y="2" width="8" height="8" rx="1.5"/></svg>
                  Stop
                </button>
              </>
            )}

            {/* Start new timer */}
            {!activeTimer && !stoppedTimer && (
              <>
                <select
                  className="ts-timer-select"
                  value={timerProjectId}
                  onChange={(e) => setTimerProjectId(e.target.value)}
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  className="ts-timer-select"
                  value={timerCategoryId}
                  onChange={(e) => setTimerCategoryId(e.target.value)}
                >
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input
                  type="text"
                  className="ts-timer-note"
                  placeholder="Note (optional)"
                  value={timerNote}
                  onChange={(e) => setTimerNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void startTaskTimer(); }}
                />
                <button
                  className="btn btn-primary btn-sm w-full mt-2"
                  onClick={() => void startTaskTimer()}
                  disabled={timerLoading || !timerProjectId || !timerCategoryId}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" className="mr-[5px]"><polygon points="3,1 11,6 3,11"/></svg>
                  Start Timer
                </button>
              </>
            )}

            {/* Timer history for today */}
            {timerHistory.filter(t => t.stoppedAtUtc !== null).length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] font-bold text-[#9ca3af] tracking-[0.06em] mb-[6px] uppercase">TODAY&apos;S SESSIONS</div>
                {timerHistory.filter(t => t.stoppedAtUtc !== null).slice(0, 5).map((t) => (
                  <div key={t.id} className="flex justify-between items-center text-[12px] py-[3px] border-b border-border-subtle">
                    <span className="text-[var(--n-700,#374151)] overflow-hidden text-ellipsis whitespace-nowrap flex-1 mr-[6px]">
                      {t.projectName}
                    </span>
                    <span className="text-text-secondary [font-variant-numeric:tabular-nums] whitespace-nowrap shrink-0">
                      {t.convertedToEntryId
                        ? <span title="Added to timesheet" className="text-[#059669]">✓ </span>
                        : null}
                      {fmtMins(t.durationMinutes ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Week Summary card */}
          <div className="ts-sidebar-card">
            <div className="ts-sidebar-section-label">WEEK SUMMARY</div>
            <div className="flex flex-col gap-[6px]">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-secondary">Total logged</span>
                <span className="font-semibold text-[var(--n-900,#111827)]">{fmtMins(weekTotalMins)}</span>
              </div>
              <div className="flex items-center gap-[6px]">
                <div className="flex-1 h-[6px] bg-[var(--n-100,#f3f4f6)] rounded-full overflow-hidden relative">
                  <div
                    className="ts-week-prog-fill"
                    style={{ width: `${weekExpectedMins > 0 ? Math.min(100, Math.round((weekTotalMins / weekExpectedMins) * 100)) : 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-brand-600 whitespace-nowrap shrink-0">
                  {weekExpectedMins > 0 ? `${Math.min(100, Math.round((weekTotalMins / weekExpectedMins) * 100))}%` : "0%"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-secondary">Weekly target</span>
                <span className="font-semibold text-[var(--n-900,#111827)]">{fmtMins(weekExpectedMins)}</span>
              </div>
              <div className={`flex justify-between items-center text-[13px] rounded-[10px] px-3 py-2 ${overtimeMinutes > 0 ? "bg-[#fffbeb] border border-[#fde68a]" : ""}`}>
                <span className="text-text-secondary">Attendance</span>
                <span className="font-semibold text-[var(--n-900,#111827)]">{fmtMins(weekAttendanceMins)}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-secondary">
                  {overtimeMinutes > 0 ? "Overtime" : "Deficit"}
                  {weekOvertime < 0 && !lastExpectedDayPassed && (
                    <span className="text-[10px] text-[var(--n-400,#9ca3af)] cursor-default ml-[2px]" title="Week still in progress">in progress</span>
                  )}
                  <span
                    className="text-[10px] text-[var(--n-400,#9ca3af)] cursor-default ml-[2px] not-italic"
                    title={overtimeMinutes > 0 ? `Hours logged above overtime threshold (${fmtMins(overtimeThresholdMinutes)})` : "Hours logged below weekly target"}
                  > ℹ</span>
                </span>
                <span className={`font-semibold ${
                  overtimeMinutes > 0 ? "text-[#b45309]"
                  : weekOvertime < 0 && lastExpectedDayPassed ? "text-[#dc2626]"
                  : weekOvertime < 0 ? "text-[#b45309]"
                  : "text-[var(--n-900,#111827)]"
                }`}>
                  {overtimeMinutes > 0 ? "+" : weekOvertime < 0 ? "−" : ""}{fmtMins(overtimeMinutes > 0 ? overtimeMinutes : Math.abs(weekOvertime))}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-secondary">Status</span>
                <span>
                  <span className={`badge ${isApproved ? "badge-success" : isSubmitted ? "badge-brand" : isRejected ? "badge-error" : "badge-warning"}`}>
                    {dayData?.status ?? "draft"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Today By Project card */}
          {projectHours.length > 0 && (
            <div className="ts-sidebar-card">
              <div className="ts-sidebar-section-label">TODAY BY PROJECT</div>
              <div className="flex flex-col gap-[10px]">
                {projectHours.map((ph) => {
                  const pct = todayTotalMins > 0 ? Math.min(100, Math.round((ph.minutes / todayTotalMins) * 100)) : 0;
                  return (
                    <div key={ph.name} className="flex flex-col gap-1">
                      <div className="flex items-center gap-[6px]">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: ph.color }}
                        />
                        <span className="flex-1 text-[12px] text-[var(--n-700,#374151)] whitespace-nowrap overflow-hidden text-ellipsis">{ph.name}</span>
                        <span className="text-[12px] font-semibold text-[var(--n-900,#111827)] whitespace-nowrap">{fmtHours(ph.minutes)}</span>
                      </div>
                      <div className="h-[4px] bg-[var(--n-100,#f3f4f6)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${pct}%`, backgroundColor: ph.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </aside>
      </div>{/* /two-column */}

      {/* ── Delete entry confirmation modal ─────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 bg-[rgba(17,24,39,0.45)] z-[1000] flex items-center justify-center backdrop-blur-[2px]" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-2xl px-6 pb-5 pt-6 max-w-[360px] w-[calc(100%-32px)] shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.10)] flex flex-col gap-[10px]" onClick={(e) => e.stopPropagation()}>
            <div className="w-[42px] h-[42px] rounded-[11px] bg-danger-light flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h14M8 6V4h4v2M6 6l1 11h6l1-11"/>
              </svg>
            </div>
            <div className="text-[15px] font-bold text-[var(--n-900,#111827)]">Delete time entry?</div>
            <div className="text-[13px] text-[var(--n-600,#4b5563)] leading-[1.55]">This entry will be permanently removed. You can&rsquo;t undo this action.</div>
            <div className="flex gap-2 justify-end mt-[6px]">
              <button className="btn btn-outline btn-sm" onClick={() => setDeleteModal(null)}>Keep it</button>
              <button
                className="btn btn-sm bg-danger text-white border-none"
                onClick={() => void confirmDeleteEntry()}
              >
                Delete entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Week preview modal ──────────────────────────────────────── */}
      {showSubmitWeekModal && (
        <div className="fixed inset-0 bg-[rgba(17,24,39,0.45)] z-[1000] flex items-center justify-center backdrop-blur-[2px]" onClick={() => setShowSubmitWeekModal(false)}>
          <div className="bg-white rounded-2xl px-6 pb-5 pt-6 max-w-[480px] w-[calc(100%-32px)] shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.10)] flex flex-col gap-[10px]" onClick={(e) => e.stopPropagation()}>
            <div className="w-[42px] h-[42px] rounded-[11px] bg-[#eef2ff] flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/>
                <polyline points="9 11 11 13 15 9"/>
              </svg>
            </div>
            <div className="text-[15px] font-bold text-[var(--n-900,#111827)]">Submit week for approval</div>
            <div className="text-[13px] text-[var(--n-600,#4b5563)] leading-[1.55] mb-3">
              The following days will be submitted. Days with no entries or already submitted will be skipped.
            </div>
            {/* Preview table */}
            <table className="w-full [border-collapse:collapse] text-[13px] mb-4">
              <thead>
                <tr className="border-b border-[#e5e7eb]">
                  <th className="text-left py-1 font-semibold text-[#6b7280] text-[11px] uppercase">Day</th>
                  <th className="text-right py-1 font-semibold text-[#6b7280] text-[11px] uppercase">Logged</th>
                  <th className="text-right py-1 font-semibold text-[#6b7280] text-[11px] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {weekDays.slice(0, 6).map((date, i) => {
                  const meta = weekDayMap.get(date);
                  const mins = meta?.enteredMinutes ?? 0;
                  const status = meta?.status ?? "draft";
                  const willSubmit = status === "draft" && mins > 0;
                  const isSkipped = status === "draft" && mins === 0;
                  return (
                    <tr key={date} className="border-b border-[#f3f4f6]">
                      <td className="py-[6px] text-[#111827]">
                        {DAY_LABELS[i]} {new Date(date + "T00:00:00").getDate()}
                      </td>
                      <td className={`text-right py-[6px] ${mins > 0 ? "text-[#111827]" : "text-[#9ca3af]"}`}>
                        {mins > 0 ? fmtHours(mins) : "—"}
                      </td>
                      <td className="text-right py-[6px]">
                        {willSubmit ? (
                          <span className="bg-[#eef2ff] text-[#6366f1] rounded px-2 py-[2px] text-[11px] font-semibold">Will submit</span>
                        ) : isSkipped ? (
                          <span className="bg-[#f9fafb] text-[#9ca3af] rounded px-2 py-[2px] text-[11px] font-semibold">No entries</span>
                        ) : (
                          <span className="bg-[#f0fdf4] text-[#059669] rounded px-2 py-[2px] text-[11px] font-semibold capitalize">{status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex gap-2 justify-end mt-[6px]">
              <button className="btn btn-outline btn-sm" onClick={() => setShowSubmitWeekModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={submitWeekLoading || submittableCount === 0}
                onClick={() => void submitWeek()}
              >
                {submitWeekLoading ? "Submitting…" : `Submit ${submittableCount} day${submittableCount > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Use Template modal ──────────────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-[rgba(17,24,39,0.45)] z-[1000] flex items-center justify-center backdrop-blur-[2px]" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl px-6 pb-5 pt-6 max-w-[480px] w-[calc(100%-32px)] shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.10)] flex flex-col gap-[10px]" onClick={(e) => e.stopPropagation()}>
            <div className="w-[42px] h-[42px] rounded-[11px] bg-[#eef2ff] flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="14" height="14" rx="2"/>
                <path d="M7 7h6M7 10h6M7 13h3"/>
              </svg>
            </div>
            <div className="text-[15px] font-bold text-[var(--n-900,#111827)]">Use Template</div>
            <div className="text-[13px] text-[var(--n-600,#4b5563)] leading-[1.55] mb-3">
              Apply a saved template to <strong>{fmtDateLabel(selectedDate)}</strong>. Duplicate entries will be skipped.
            </div>
            {templatesLoading ? (
              <div className="text-center text-[#9ca3af] text-[13px] py-4">Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="text-center text-[#9ca3af] text-[13px] py-4">No templates saved yet.</div>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-[14px] py-[10px] border border-[#e5e7eb] rounded-lg bg-[#f9fafb]">
                    <div>
                      <div className="font-semibold text-[14px] text-[#111827]">{t.name}</div>
                      <div className="text-[12px] text-[#6b7280] mt-[2px]">
                        {t.entries.length} entr{t.entries.length === 1 ? "y" : "ies"} &middot;&nbsp;
                        {t.entries.reduce((sum, e) => sum + e.minutes, 0) > 0
                          ? fmtHours(t.entries.reduce((sum, e) => sum + e.minutes, 0))
                          : "—"}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={templateApplyingId === t.id}
                      onClick={() => void applyTemplate(t.id)}
                    >
                      {templateApplyingId === t.id ? "Applying…" : "Apply"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-between mt-[6px]">
              <span className="text-[12px] text-[#9ca3af]">
                Manage templates in your Profile page.
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => setShowTemplateModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save as Template modal ───────────────────────────────────────────── */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-[rgba(17,24,39,0.45)] z-[1000] flex items-center justify-center backdrop-blur-[2px]" onClick={() => setShowSaveTemplateModal(false)}>
          <div className="bg-white rounded-2xl px-6 pb-5 pt-6 max-w-[360px] w-[calc(100%-32px)] shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.10)] flex flex-col gap-[10px]" onClick={(e) => e.stopPropagation()}>
            <div className="w-[42px] h-[42px] rounded-[11px] bg-[#f0fdf4] flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
                <path d="M13 3v6H7V3"/>
                <path d="M7 13h6"/>
              </svg>
            </div>
            <div className="text-[15px] font-bold text-[var(--n-900,#111827)]">Save as Template</div>
            <div className="text-[13px] text-[var(--n-600,#4b5563)] leading-[1.55]">
              Save today&rsquo;s {dayEntries.length} entr{dayEntries.length === 1 ? "y" : "ies"} as a reusable template.
            </div>
            <div className="pb-4">
              <label className="text-[12px] font-semibold text-[#6b7280] block mb-[6px]">
                Template name
              </label>
              <input
                className="ts-form-input w-full box-border"
                placeholder="e.g. Standard work day"
                value={saveTemplateName}
                autoFocus
                maxLength={120}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void saveAsTemplate(); }}
              />
            </div>
            <div className="flex gap-2 justify-end mt-[6px]">
              <button className="btn btn-outline btn-sm" onClick={() => setShowSaveTemplateModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={saveTemplateLoading || !saveTemplateName.trim()}
                onClick={() => void saveAsTemplate()}
              >
                {saveTemplateLoading ? "Saving…" : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
