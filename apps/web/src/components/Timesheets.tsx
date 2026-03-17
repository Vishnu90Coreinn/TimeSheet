/**
 * Timesheets.tsx — v3.0 PulseHQ redesign
 * Two-column layout: main content + sticky sidebar.
 * Week strip, inline entry form, entry cards, attendance timer sidebar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import type { AttendanceSummary } from "./AttendanceWidget";
import type { Project, TaskCategory, TimesheetDay, TimesheetEntry, WeekDayMeta, WeekSummary } from "../types";

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

function fmtTime(iso: string): string {
  return parseUtcLocal(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

function fmtWeekRange(weekDays: string[]): string {
  if (!weekDays.length) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(weekDays[0] + "T00:00:00").toLocaleDateString(undefined, opts);
  const end = new Date(weekDays[6] + "T00:00:00").toLocaleDateString(undefined, opts);
  return `${start}–${end}`;
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
  // Attendance state
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [checkLoading, setCheckLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [weekData, setWeekData] = useState<WeekSummary | null>(null);
  const [dayData, setDayData] = useState<TimesheetDay | null>(null);

  // Entry form state
  const [showForm, setShowForm] = useState(false);
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
  const [submitWeekToast, setSubmitWeekToast] = useState<string | null>(null);

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
  const [timerToast, setTimerToast] = useState<string | null>(null);

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

  // Live elapsed timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (attendance?.activeSessionId && attendance.lastCheckInAtUtc) {
      const checkIn = parseUtcLocal(attendance.lastCheckInAtUtc).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - checkIn) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [attendance?.activeSessionId, attendance?.lastCheckInAtUtc]);

  /* ── Data loading ─────────────────────────────────────────────────────────── */
  const loadWeek = useCallback(async (anyDate: string) => {
    const r = await apiFetch(`/timesheets/week?anyDateInWeek=${anyDate}`);
    if (r.ok) setWeekData(await r.json() as WeekSummary);
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
    void loadAttendance();
    void loadWeek(selectedDate);
    void loadDay(selectedDate);
    void loadActiveTimer();
    void loadTimerHistory();
    apiFetch("/timesheets/entry-options").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json() as { projects: Project[]; taskCategories: TaskCategory[] };
      setProjects(d.projects);
      setCategories(d.taskCategories);
      setForm(blankForm(d.projects, d.taskCategories));
      setTimerProjectId((prev) => prev || d.projects[0]?.id || "");
      setTimerCategoryId((prev) => prev || d.taskCategories[0]?.id || "");
    });
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
    }
    setShowForm(false);
    setShowSubmitForm(false);
    setSubmitSuccess("");
  }

  /* ── Attendance actions ───────────────────────────────────────────────────── */
  async function handleCheck() {
    setCheckLoading(true);
    const isCheckedIn = Boolean(attendance?.activeSessionId);
    const r = await apiFetch(isCheckedIn ? "/attendance/check-out" : "/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (r.ok) setAttendance(await r.json() as AttendanceSummary);
    setCheckLoading(false);
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
    setShowForm(true);
    setFormError("");
  }

  function openNew() {
    setForm(blankForm(projects, categories));
    setFormError("");
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
      const toast = n > 0
        ? `${n} day${n > 1 ? "s" : ""} submitted${result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : ""}.`
        : `No days submitted — ${result.skipped.length} skipped.`;
      setSubmitWeekToast(toast);
      setTimeout(() => setSubmitWeekToast(null), 4000);
      // Reload week + selected day
      void loadWeek(selectedDate);
      void loadDay(selectedDate);
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      setSubmitWeekToast(body.message ?? "Week submission failed.");
      setTimeout(() => setSubmitWeekToast(null), 4000);
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
      setTimerToast(body.message ?? "Failed to start timer.");
      setTimeout(() => setTimerToast(null), 4000);
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
      setTimerToast("Entry added to timesheet.");
      setTimeout(() => setTimerToast(null), 3000);
      void loadTimerHistory();
      if (convertDate === selectedDate) {
        void loadDay(selectedDate);
        void loadWeek(selectedDate);
      }
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      setTimerToast(body.message ?? "Failed to add entry.");
      setTimeout(() => setTimerToast(null), 4000);
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
      setSubmitWeekToast(msg);
      setTimeout(() => setSubmitWeekToast(null), 4000);
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      setTimerToast(body.message ?? "Failed to apply template.");
      setTimeout(() => setTimerToast(null), 4000);
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
      setSubmitWeekToast("Template saved.");
      setTimeout(() => setSubmitWeekToast(null), 3000);
    } else {
      const body = await r.json().catch(() => ({})) as { message?: string };
      setTimerToast(body.message ?? "Failed to save template.");
      setTimeout(() => setTimerToast(null), 4000);
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

  // Build a map from workDate -> WeekDayMeta for the strip
  const weekDayMap = new Map<string, WeekDayMeta>(
    (weekData?.days ?? []).map((d) => [d.workDate, d])
  );

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
  return (
    <section>
      <style>{PAGE_STYLES}</style>
      <div className="ts3-page">

        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="ts3-main">

          {/* Page header */}
          <div className="page-header ts3-page-header">
            <div>
              <div className="page-title">My Timesheet</div>
              <div className="page-subtitle">
                Week of {weekRange}&nbsp;&mdash;&nbsp;{fmtHours(weekTotalMins)} logged
              </div>
            </div>
            <div className="ts3-header-actions">
              <button className="btn btn-outline btn-sm">Export</button>
              {isDraft && !isLocked && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => void openTemplateModal()}
                >
                  Use Template
                </button>
              )}
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
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowSubmitWeekModal(true)}
                  title={`Submit all ${submittableCount} draft day${submittableCount > 1 ? "s" : ""} this week`}
                >
                  Submit Week
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
          <div className="ts3-week-nav">
            <button
              className="ts3-week-nav-btn"
              onClick={() => shiftWeek(-7)}
              title="Previous week"
              aria-label="Previous week"
            >
              &#8249;
            </button>
            <div className="ts3-week-strip">
            {weekDays.map((date, i) => {
              const meta = weekDayMap.get(date);
              const mins = meta?.enteredMinutes ?? 0;
              const expected = meta?.expectedMinutes ?? 480;
              // When expected === 0 (rest/Sunday) but hours logged, show bar as filled
              const pct = expected > 0
                ? Math.min(100, Math.round((mins / expected) * 100))
                : mins > 0 ? 100 : 0;
              const fillColor = expected === 0 && mins > 0
                ? "#a5b4fc"                              // light indigo — rest day, no target
                : pct >= 100 ? "#10b981"                // green — target met
                : pct > 0   ? "#6366f1"                 // indigo — in progress
                : "transparent";
              const isSelected = date === selectedDate;
              const isToday = date === todayIso();
              const dayApproved = meta?.status === "approved";
              return (
                <button
                  key={date}
                  className={`ts3-day-card${isSelected ? " ts3-day-card--selected" : ""}${isToday ? " ts3-day-card--today" : ""}${dayApproved ? " ts3-day-card--approved" : ""}`}
                  onClick={() => selectDay(date)}
                >
                  <div className="ts3-day-label">{DAY_LABELS[i]}</div>
                  <div className="ts3-day-num">
                    {new Date(date + "T00:00:00").getDate()}
                    {dayApproved && (
                      <svg className="ts3-day-approved-icon" width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="6" fill="#10b981"/>
                        <path d="M3 6l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className={`ts3-day-hours${mins > 0 ? " ts3-day-hours--logged" : ""}`}>
                    {mins > 0 ? fmtHours(mins) : "—"}
                  </div>
                  <div className="ts3-day-bar-wrap">
                    <div className="ts3-day-bar-track">
                      <div
                        className="ts3-day-bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: fillColor }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
            </div>{/* /ts3-week-strip */}
            <button
              className="ts3-week-nav-btn"
              onClick={() => shiftWeek(7)}
              title="Next week"
              aria-label="Next week"
            >
              &#8250;
            </button>
          </div>{/* /ts3-week-nav */}

          {/* Entry form */}
          {showForm && (
            <div className="ts3-entry-form-card">
              <div className="ts3-entry-form-header">
                <span>+ {form.editingId ? "Edit" : "New"} time entry &mdash; {fmtDateLabel(selectedDate)}</span>
              </div>

              {/* Description */}
              <div className="ts3-field">
                <label className="ts3-label">Task / Description</label>
                <textarea
                  className="ts3-textarea"
                  rows={2}
                  placeholder="What did you work on?"
                  value={form.description}
                  onChange={(e) => setFormField({ description: e.target.value })}
                />
              </div>

              {/* Project + Category + Duration */}
              <div className="ts3-form-row">
                <div className="ts3-field ts3-field--grow">
                  <label className="ts3-label">Project</label>
                  <select
                    className="ts3-select"
                    value={form.projectId}
                    onChange={(e) => setFormField({ projectId: e.target.value })}
                  >
                    <option value="">— Select project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="ts3-field ts3-field--grow">
                  <label className="ts3-label">Category</label>
                  <select
                    className="ts3-select"
                    value={form.taskCategoryId}
                    onChange={(e) => setFormField({ taskCategoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="ts3-field ts3-field--narrow">
                  <label className="ts3-label">Duration (h)</label>
                  <input
                    className="ts3-input"
                    placeholder="e.g. 1.5"
                    value={form.durationHours}
                    disabled={!!(form.startTime && form.endTime)}
                    onChange={(e) => setFormField({ durationHours: e.target.value })}
                    title={form.startTime && form.endTime ? "Auto-calculated from start/end times" : undefined}
                  />
                </div>
              </div>

              {/* Start + End time */}
              <div className="ts3-form-row">
                <div className="ts3-field ts3-field--narrow">
                  <label className="ts3-label">Start time</label>
                  <input
                    type="time"
                    className="ts3-input"
                    value={form.startTime}
                    onChange={(e) => setFormField({ startTime: e.target.value })}
                  />
                </div>
                <div className="ts3-field ts3-field--narrow">
                  <label className="ts3-label">End time</label>
                  <input
                    type="time"
                    className="ts3-input"
                    value={form.endTime}
                    onChange={(e) => setFormField({ endTime: e.target.value })}
                  />
                </div>
                <div className="ts3-field ts3-field--grow" />
              </div>

              {formError && <p className="ts3-form-error">{formError}</p>}

              <div className="ts3-form-actions">
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
            <div className="ts3-submit-card">
              <div className="ts3-submit-title">Submit for Review</div>
              <div className="ts3-field">
                <label className="ts3-label">Notes (optional)</label>
                <textarea
                  className="ts3-textarea"
                  rows={3}
                  placeholder="Optional notes to your manager…"
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                />
              </div>
              {dayData?.hasMismatch && (
                <div className="ts3-field">
                  <label className="ts3-label">
                    Mismatch reason <span className="ts3-required">*</span>
                  </label>
                  <textarea
                    className="ts3-textarea ts3-textarea--warn"
                    rows={3}
                    placeholder="Explain why logged hours differ from attendance hours…"
                    value={mismatchReason}
                    onChange={(e) => setMismatchReason(e.target.value)}
                  />
                  <span className="ts3-hint ts3-hint--warn">Your logged hours don't match attendance. A reason is required.</span>
                </div>
              )}
              {submitError && <p className="ts3-form-error">{submitError}</p>}
              <div className="ts3-form-actions">
                <button className="btn btn-outline btn-sm" onClick={() => setShowSubmitForm(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={() => void submitTimesheet()}>Submit Timesheet</button>
              </div>
            </div>
          )}

          {submitSuccess && (
            <div className="ts3-success-banner">{submitSuccess}</div>
          )}

          {/* Semantic status banners */}
          {isApproved && (
            <div className="ts3-banner ts3-banner--approved">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="10" cy="10" r="10" fill="#10b981"/>
                <path d="M5.5 10l3 3 6-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <strong>Timesheet approved</strong>
                <span className="ts3-banner-sub"> — Entries are locked and cannot be edited.</span>
              </div>
            </div>
          )}
          {isSubmitted && (
            <div className="ts3-banner ts3-banner--submitted">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="10" cy="10" r="9" stroke="#3b82f6" strokeWidth="1.8"/>
                <path d="M10 6v4l2.5 2.5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div>
                <strong>Awaiting approval</strong>
                <span className="ts3-banner-sub"> — Submitted for manager review.</span>
              </div>
            </div>
          )}
          {isRejected && (
            <div className="ts3-banner ts3-banner--rejected">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="10" cy="10" r="9" stroke="#ef4444" strokeWidth="1.8"/>
                <path d="M7 7l6 6M13 7l-6 6" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div>
                <strong>Timesheet rejected</strong>
                <span className="ts3-banner-sub"> — Please review and resubmit.</span>
              </div>
            </div>
          )}

          {/* Entries list */}
          <div className="ts3-entries">
            {dayEntries.length === 0 ? (
              <div className="ts3-empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: "var(--n-300, #d1d5db)", marginBottom: 8 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div>No entries for this day.</div>
                <div style={{ fontSize: "12px", color: "var(--n-400, #9ca3af)", marginTop: 4 }}>Click &ldquo;+ Add Entry&rdquo; to log your time.</div>
              </div>
            ) : (
              dayEntries.map((entry) => {
                const parsed = parseNotes(entry.notes);
                const color = projectColor(projects, entry.projectId);
                return (
                  <div
                    key={entry.id}
                    className={`ts3-entry-card${!isDraft ? " ts3-entry-card--locked" : ""}${isApproved ? " ts3-entry-card--approved" : ""}`}
                    style={{ borderLeftColor: isApproved ? "rgb(5, 150, 105)" : color }}
                  >
                    <div className="ts3-entry-body">
                      <div className="ts3-entry-title">
                        {parsed.description || entry.taskCategoryName}
                        {parsed.isLive && <span className="ts3-live-badge">LIVE</span>}
                      </div>
                      <div className="ts3-entry-meta">
                        <span className="ts3-project-badge" style={{ backgroundColor: color + "22", color }}>
                          {entry.projectName}
                        </span>
                        {parsed.timeRange && (
                          <span className="ts3-entry-time">{parsed.timeRange.replace("-", " – ")}</span>
                        )}
                      </div>
                    </div>
                    <div className="ts3-entry-hours">{fmtHours(entry.minutes)}</div>
                    {isDraft ? (
                      <div className="ts3-entry-actions">
                        <button className="ts3-icon-btn" title="Edit" onClick={() => openEdit(entry)}>
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 3.3a1 1 0 0 1 1.4 1.4L5.5 15.3l-3 .7.7-3L14.7 3.3z"/></svg>
                        </button>
                        <button className="ts3-icon-btn ts3-icon-btn--danger" title="Delete" onClick={() => void deleteEntry(entry.id)}>
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h14M8 6V4h4v2M6 6l1 11h6l1-11"/></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="ts3-lock-icon" title={`Locked — ${dayData?.status}`}>
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
          <div className={`ts3-day-bar${isApproved ? " ts3-day-bar--approved" : ""}`}>
            <span>{fmtDayBarLabel(selectedDate)}</span>
            <div className="ts3-day-bar-right">
              {todayExpectedMins > 0 ? (
                <>
                  <div className="ts3-day-mini-prog">
                    <div
                      className="ts3-day-mini-prog-fill"
                      style={{ width: `${Math.min(100, todayExpectedMins > 0 ? Math.round((todayTotalMins / todayExpectedMins) * 100) : 0)}%` }}
                    />
                  </div>
                  <span>{fmtHours(todayTotalMins)} / {fmtHours(todayExpectedMins)}</span>
                </>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>Rest day — no target</span>
              )}
            </div>
          </div>

        </div>{/* /ts3-main */}

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="ts3-sidebar">

          {/* Attendance card */}
          {(isCurrentWeek || isCheckedIn) && (
            <div className="ts3-sidebar-card">
              <div className="ts3-sidebar-section-label">
                {isCheckedIn && <span className="ts3-green-dot" />}
                ATTENDANCE
              </div>
              {isCheckedIn ? (
                <>
                  <div className="ts3-elapsed-clock">{fmtElapsed(elapsed)}</div>
                  <div className="ts3-elapsed-sub">
                    since {attendance?.lastCheckInAtUtc ? fmtTime(attendance.lastCheckInAtUtc) : "—"}
                    &nbsp;&middot;&nbsp;{fmtMins(attendance?.netMinutes ?? 0)} today
                  </div>
                  <div className="ts3-timer-actions">
                    <button
                      className="btn ts3-btn-stop btn-sm"
                      onClick={() => void handleCheck()}
                      disabled={checkLoading}
                    >
                      Check Out
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={openNew}>
                      + Entry
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="ts3-not-checked-in">Not checked in</div>
                  <button
                    className="btn btn-primary btn-sm ts3-checkin-btn"
                    onClick={() => void handleCheck()}
                    disabled={checkLoading}
                  >
                    Check In
                  </button>
                </>
              )}
            </div>
          )}

          {/* Task Timer card */}
          <div className="ts3-sidebar-card">
            <div className="ts3-sidebar-section-label">
              {activeTimer && <span className="ts3-green-dot ts3-green-dot--pulse" />}
              TASK TIMER
            </div>

            {/* Stopped timer — confirm "Add to Timesheet?" */}
            {stoppedTimer && !activeTimer && (
              <div className="ts3-timer-convert">
                <div className="ts3-timer-convert-badge">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 8 6 11 13 4"/></svg>
                  &nbsp;{fmtMins(stoppedTimer.durationMinutes ?? 0)} recorded
                </div>
                <div className="ts3-timer-convert-detail">
                  <strong>{stoppedTimer.projectName}</strong> · {stoppedTimer.categoryName}
                  {stoppedTimer.note && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{stoppedTimer.note}</div>}
                </div>
                <div className="ts3-timer-convert-row">
                  <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Add to date</label>
                  <input
                    type="date"
                    value={convertDate}
                    max={todayIso()}
                    onChange={(e) => setConvertDate(e.target.value)}
                    className="ts3-timer-date-input"
                  />
                </div>
                <div className="ts3-timer-actions" style={{ marginTop: 10 }}>
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
                <div className="ts3-elapsed-clock ts3-elapsed-clock--task">{fmtElapsed(taskElapsed)}</div>
                <div className="ts3-elapsed-sub">
                  <strong>{activeTimer.projectName}</strong> · {activeTimer.categoryName}
                </div>
                {activeTimer.note && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, marginBottom: 6 }}>{activeTimer.note}</div>
                )}
                <button
                  className="btn ts3-btn-stop btn-sm"
                  style={{ width: "100%", marginTop: 8 }}
                  onClick={() => void stopTaskTimer()}
                  disabled={timerLoading}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" style={{ marginRight: 5 }}><rect x="2" y="2" width="8" height="8" rx="1.5"/></svg>
                  Stop
                </button>
              </>
            )}

            {/* Start new timer */}
            {!activeTimer && !stoppedTimer && (
              <>
                <select
                  className="ts3-timer-select"
                  value={timerProjectId}
                  onChange={(e) => setTimerProjectId(e.target.value)}
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  className="ts3-timer-select"
                  value={timerCategoryId}
                  onChange={(e) => setTimerCategoryId(e.target.value)}
                >
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input
                  type="text"
                  className="ts3-timer-note"
                  placeholder="Note (optional)"
                  value={timerNote}
                  onChange={(e) => setTimerNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void startTaskTimer(); }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%", marginTop: 8 }}
                  onClick={() => void startTaskTimer()}
                  disabled={timerLoading || !timerProjectId || !timerCategoryId}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" style={{ marginRight: 5 }}><polygon points="3,1 11,6 3,11"/></svg>
                  Start Timer
                </button>
              </>
            )}

            {/* Timer history for today */}
            {timerHistory.filter(t => t.stoppedAtUtc !== null).length > 0 && (
              <div className="ts3-timer-history">
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", marginBottom: 6, marginTop: 12 }}>TODAY'S SESSIONS</div>
                {timerHistory.filter(t => t.stoppedAtUtc !== null).slice(0, 5).map((t) => (
                  <div key={t.id} className="ts3-timer-history-row">
                    <span className="ts3-timer-history-proj">{t.projectName}</span>
                    <span className="ts3-timer-history-dur">
                      {t.convertedToEntryId
                        ? <span title="Added to timesheet" style={{ color: "#059669" }}>✓ </span>
                        : null}
                      {fmtMins(t.durationMinutes ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Week Summary card */}
          <div className="ts3-sidebar-card">
            <div className="ts3-sidebar-section-label">WEEK SUMMARY</div>
            <div className="ts3-summary-rows">
              <div className="ts3-summary-row">
                <span className="ts3-summary-key">Total logged</span>
                <span className="ts3-summary-val">{fmtMins(weekTotalMins)}</span>
              </div>
              <div className="ts3-week-prog-wrap">
                <div className="ts3-week-prog-bar">
                  <div
                    className="ts3-week-prog-fill"
                    style={{ width: `${weekExpectedMins > 0 ? Math.min(100, Math.round((weekTotalMins / weekExpectedMins) * 100)) : 0}%` }}
                  />
                </div>
                <span className="ts3-week-prog-pct">
                  {weekExpectedMins > 0 ? `${Math.min(100, Math.round((weekTotalMins / weekExpectedMins) * 100))}%` : "0%"}
                </span>
              </div>
              <div className="ts3-summary-row">
                <span className="ts3-summary-key">Weekly target</span>
                <span className="ts3-summary-val">{fmtMins(weekExpectedMins)}</span>
              </div>
              <div className="ts3-summary-row">
                <span className="ts3-summary-key">Attendance</span>
                <span className="ts3-summary-val">{fmtMins(weekAttendanceMins)}</span>
              </div>
              <div className="ts3-summary-row">
                <span className="ts3-summary-key">
                  {weekOvertime >= 0 ? "Overtime" : "Deficit"}
                  <span className="ts3-info-tip" title={weekOvertime >= 0 ? "Hours logged above weekly target" : "Hours logged below weekly target"}> ℹ</span>
                </span>
                <span className={`ts3-summary-val${weekOvertime > 0 ? " ts3-overtime-pos" : weekOvertime < 0 ? " ts3-overtime-deficit" : ""}`}>
                  {weekOvertime > 0 ? "+" : weekOvertime < 0 ? "−" : ""}{fmtMins(Math.abs(weekOvertime))}
                </span>
              </div>
              <div className="ts3-summary-row">
                <span className="ts3-summary-key">Status</span>
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
            <div className="ts3-sidebar-card">
              <div className="ts3-sidebar-section-label">TODAY BY PROJECT</div>
              <div className="ts3-proj-rows">
                {projectHours.map((ph) => {
                  const pct = todayTotalMins > 0 ? Math.min(100, Math.round((ph.minutes / todayTotalMins) * 100)) : 0;
                  return (
                    <div key={ph.name} className="ts3-proj-row">
                      <div className="ts3-proj-row-top">
                        <span className="ts3-proj-dot" style={{ backgroundColor: ph.color }} />
                        <span className="ts3-proj-name">{ph.name}</span>
                        <span className="ts3-proj-hours">{fmtHours(ph.minutes)}</span>
                      </div>
                      <div className="ts3-proj-track">
                        <div className="ts3-proj-fill" style={{ width: `${pct}%`, backgroundColor: ph.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </aside>
      </div>{/* /ts3-page */}

      {/* ── Delete entry confirmation modal ─────────────────── */}
      {deleteModal && (
        <div className="ts3-modal-backdrop" onClick={() => setDeleteModal(null)}>
          <div className="ts3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ts3-modal-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h14M8 6V4h4v2M6 6l1 11h6l1-11"/>
              </svg>
            </div>
            <div className="ts3-modal-title">Delete time entry?</div>
            <div className="ts3-modal-body">This entry will be permanently removed. You can&rsquo;t undo this action.</div>
            <div className="ts3-modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setDeleteModal(null)}>Keep it</button>
              <button
                className="btn btn-sm"
                style={{ background: "#ef4444", color: "#fff", border: "none" }}
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
        <div className="ts3-modal-backdrop" onClick={() => setShowSubmitWeekModal(false)}>
          <div className="ts3-modal ts3-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="ts3-modal-icon" style={{ background: "#eef2ff" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/>
                <polyline points="9 11 11 13 15 9"/>
              </svg>
            </div>
            <div className="ts3-modal-title">Submit week for approval</div>
            <div className="ts3-modal-body" style={{ marginBottom: 12 }}>
              The following days will be submitted. Days with no entries or already submitted will be skipped.
            </div>
            {/* Preview table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Day</th>
                  <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Logged</th>
                  <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Status</th>
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
                    <tr key={date} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "6px 0", color: "#111827" }}>
                        {DAY_LABELS[i]} {new Date(date + "T00:00:00").getDate()}
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 0", color: mins > 0 ? "#111827" : "#9ca3af" }}>
                        {mins > 0 ? fmtHours(mins) : "—"}
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 0" }}>
                        {willSubmit ? (
                          <span style={{ background: "#eef2ff", color: "#6366f1", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>Will submit</span>
                        ) : isSkipped ? (
                          <span style={{ background: "#f9fafb", color: "#9ca3af", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>No entries</span>
                        ) : (
                          <span style={{ background: "#f0fdf4", color: "#059669", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ts3-modal-actions">
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

      {/* ── Submit week toast ──────────────────────────────────────────────── */}
      {submitWeekToast && (
        <div style={{
          position: "fixed", bottom: "var(--space-6, 24px)", right: "var(--space-6, 24px)",
          background: "#111827", color: "#fff", borderRadius: 8,
          padding: "10px 18px", fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 9999,
          animation: "page-enter 0.2s both",
        }}>
          {submitWeekToast}
        </div>
      )}

      {/* ── Timer toast ────────────────────────────────────────────────────── */}
      {timerToast && (
        <div style={{
          position: "fixed", bottom: "var(--space-6, 24px)", left: "50%", transform: "translateX(-50%)",
          background: "#111827", color: "#fff", borderRadius: 8,
          padding: "10px 18px", fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 9999,
          animation: "page-enter 0.2s both",
        }}>
          {timerToast}
        </div>
      )}

      {/* ── Use Template modal ──────────────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="ts3-modal-backdrop" onClick={() => setShowTemplateModal(false)}>
          <div className="ts3-modal ts3-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="ts3-modal-icon" style={{ background: "#eef2ff" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="14" height="14" rx="2"/>
                <path d="M7 7h6M7 10h6M7 13h3"/>
              </svg>
            </div>
            <div className="ts3-modal-title">Use Template</div>
            <div className="ts3-modal-body" style={{ marginBottom: 12 }}>
              Apply a saved template to <strong>{fmtDateLabel(selectedDate)}</strong>. Duplicate entries will be skipped.
            </div>
            {templatesLoading ? (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>Loading templates…</div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>No templates saved yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {templates.map(t => (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8,
                    background: "#f9fafb",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
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
            <div className="ts3-modal-actions" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                Manage templates in your Profile page.
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => setShowTemplateModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save as Template modal ───────────────────────────────────────────── */}
      {showSaveTemplateModal && (
        <div className="ts3-modal-backdrop" onClick={() => setShowSaveTemplateModal(false)}>
          <div className="ts3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ts3-modal-icon" style={{ background: "#f0fdf4" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
                <path d="M13 3v6H7V3"/>
                <path d="M7 13h6"/>
              </svg>
            </div>
            <div className="ts3-modal-title">Save as Template</div>
            <div className="ts3-modal-body">
              Save today&rsquo;s {dayEntries.length} entr{dayEntries.length === 1 ? "y" : "ies"} as a reusable template.
            </div>
            <div style={{ padding: "0 0 16px" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>
                Template name
              </label>
              <input
                className="ts3-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Standard work day"
                value={saveTemplateName}
                autoFocus
                maxLength={120}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void saveAsTemplate(); }}
              />
            </div>
            <div className="ts3-modal-actions">
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

/* ─── Scoped styles ─────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
  .ts3-page {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }
  .ts3-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .ts3-sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: sticky;
    top: calc(60px + 24px);
  }

  /* Page header */
  .ts3-page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 0;
  }
  .ts3-header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Week navigation wrapper */
  .ts3-week-nav {
    display: flex;
    align-items: stretch;
    gap: 6px;
  }
  .ts3-week-nav-btn {
    flex-shrink: 0;
    width: 32px;
    background: var(--surface, #fff);
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 10px;
    font-size: 22px;
    color: var(--n-500, #6b7280);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    padding: 0;
    line-height: 1;
  }
  .ts3-week-nav-btn:hover {
    border-color: #6366f1;
    color: #6366f1;
    background: #eef2ff;
  }

  /* Week strip */
  .ts3-week-strip {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }
  .ts3-day-card {
    background: var(--surface, #fff);
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 10px;
    padding: 10px 6px 8px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .ts3-day-card:hover {
    border-color: #6366f1;
  }
  .ts3-day-card--selected {
    border-color: #6366f1;
    background: #eef2ff;
  }
  .ts3-day-card--today .ts3-day-num {
    color: #6366f1;
    font-weight: 700;
  }
  .ts3-day-card--approved {
    border-color: #6ee7b7;
    background: #f0fdf4;
  }
  .ts3-day-card--approved .ts3-day-num {
    color: #059669;
  }
  .ts3-day-num {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .ts3-day-approved-icon {
    flex-shrink: 0;
    vertical-align: middle;
  }
  .ts3-day-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--n-500, #6b7280);
    text-transform: uppercase;
  }
  .ts3-day-num {
    font-size: 18px;
    font-weight: 600;
    color: var(--n-900, #111827);
    line-height: 1;
  }
  .ts3-day-hours {
    font-size: 11px;
    color: var(--n-400, #9ca3af);
  }
  .ts3-day-hours--logged {
    color: #6366f1;
    font-weight: 600;
  }
  .ts3-day-card--approved .ts3-day-hours--logged {
    color: rgb(5, 150, 105);
  }
  .ts3-day-bar-wrap {
    width: 100%;
    padding: 0 2px;
  }
  .ts3-day-bar-track {
    height: 3px;
    background: var(--n-100, #f3f4f6);
    border-radius: 99px;
    overflow: hidden;
  }
  .ts3-day-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.3s;
  }

  /* Entry form */
  .ts3-entry-form-card {
    border: 2px dashed #a5b4fc;
    border-radius: 12px;
    background: #eef2ff;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .ts3-entry-form-header {
    font-size: 13px;
    font-weight: 600;
    color: #4338ca;
  }
  .ts3-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ts3-field--grow {
    flex: 1;
  }
  .ts3-field--narrow {
    width: 110px;
    flex-shrink: 0;
  }
  .ts3-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--n-600, #4b5563);
  }
  .ts3-required {
    color: #ef4444;
  }
  .ts3-input, .ts3-select {
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 7px;
    padding: 7px 10px;
    font-size: 13px;
    background: #fff;
    color: var(--n-900, #111827);
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  .ts3-input:focus, .ts3-select:focus {
    border-color: #6366f1;
  }
  .ts3-textarea {
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 7px;
    padding: 8px 10px;
    font-size: 13px;
    background: #fff;
    color: var(--n-900, #111827);
    outline: none;
    resize: vertical;
    font-family: inherit;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  .ts3-textarea:focus {
    border-color: #6366f1;
  }
  .ts3-textarea--warn {
    border-color: #f59e0b;
  }
  .ts3-form-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .ts3-form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .ts3-form-error {
    font-size: 12px;
    color: #ef4444;
    margin: 0;
  }
  .ts3-hint {
    font-size: 11px;
    color: var(--n-400, #9ca3af);
  }
  .ts3-hint--warn {
    color: #b45309;
  }

  /* Submit card */
  .ts3-submit-card {
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 12px;
    background: #fff;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .ts3-submit-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--n-900, #111827);
  }

  /* Entries */
  .ts3-entries {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ts3-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--n-500, #6b7280);
    text-align: center;
    padding: 36px 0;
    gap: 2px;
  }
  .ts3-entry-card {
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-left: 3px solid #6366f1;
    border-radius: 10px;
    background: #fff;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .ts3-entry-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ts3-entry-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--n-900, #111827);
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ts3-entry-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .ts3-project-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 99px;
    white-space: nowrap;
  }
  .ts3-entry-time {
    font-size: 11px;
    color: var(--n-500, #6b7280);
  }
  .ts3-live-badge {
    font-size: 10px;
    font-weight: 700;
    background: #dcfce7;
    color: #166534;
    padding: 1px 6px;
    border-radius: 99px;
    letter-spacing: 0.05em;
  }
  .ts3-entry-hours {
    font-size: 14px;
    font-weight: 700;
    color: var(--n-900, #111827);
    white-space: nowrap;
    min-width: 40px;
    text-align: right;
  }
  .ts3-entry-actions {
    display: flex;
    gap: 4px;
  }
  .ts3-icon-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    background: #fff;
    color: var(--n-500, #6b7280);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .ts3-icon-btn:hover {
    background: #f3f4f6;
    border-color: #6366f1;
    color: #6366f1;
  }
  .ts3-icon-btn--danger:hover {
    background: #fef2f2;
    border-color: #ef4444;
    color: #ef4444;
  }
  .ts3-entry-card--locked {
    background: #fafafa;
    opacity: 0.85;
  }
  .ts3-entry-card--approved {
    border-left-color: rgb(5, 150, 105) !important;
    background: #f0fdf4;
  }
  .ts3-lock-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--n-400, #9ca3af);
    flex-shrink: 0;
  }

  /* Day summary bar */
  .ts3-day-bar {
    background: linear-gradient(135deg, #4338ca, #6366f1);
    border-radius: 12px;
    padding: 10px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    margin-top: 4px;
  }
  .ts3-day-bar--approved {
    background: linear-gradient(135deg, rgb(5, 150, 105), rgb(16, 185, 129));
  }
  .ts3-day-bar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ts3-day-mini-prog {
    width: 60px;
    height: 4px;
    background: rgba(255,255,255,0.25);
    border-radius: 99px;
    overflow: hidden;
  }
  .ts3-day-mini-prog-fill {
    height: 100%;
    background: rgba(255,255,255,0.9);
    border-radius: 99px;
    transition: width 0.3s;
  }

  /* Semantic status banners */
  .ts3-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 13px;
  }
  .ts3-banner--approved {
    background: #f0fdf4;
    border: 1.5px solid #6ee7b7;
    color: #065f46;
  }
  .ts3-banner--submitted {
    background: #eff6ff;
    border: 1.5px solid #93c5fd;
    color: #1e40af;
  }
  .ts3-banner--rejected {
    background: #fef2f2;
    border: 1.5px solid #fca5a5;
    color: #991b1b;
  }
  .ts3-banner-sub {
    font-weight: 400;
    opacity: 0.85;
  }
  .ts3-success-banner {
    background: #f0fdf4;
    border: 1.5px solid #86efac;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #166534;
  }

  /* Sidebar cards */
  .ts3-sidebar-card {
    background: #fff;
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ts3-sidebar-section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--n-400, #9ca3af);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ts3-green-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    display: inline-block;
    flex-shrink: 0;
  }
  .ts3-elapsed-clock {
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--n-900, #111827);
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .ts3-elapsed-sub {
    font-size: 12px;
    color: var(--n-500, #6b7280);
    margin-top: -6px;
  }
  .ts3-not-checked-in {
    font-size: 15px;
    color: var(--n-400, #9ca3af);
    font-style: italic;
  }
  .ts3-timer-actions {
    display: flex;
    gap: 8px;
  }
  .ts3-checkin-btn {
    align-self: flex-start;
  }
  .ts3-btn-stop {
    border: 1.5px solid #ef4444 !important;
    color: #ef4444 !important;
    background: #fff !important;
  }
  .ts3-btn-stop:hover {
    background: #fef2f2 !important;
  }
  .ts3-elapsed-clock--task {
    font-size: 24px;
    color: #6366f1;
  }
  .ts3-green-dot--pulse {
    animation: ts3-pulse 1.5s ease-in-out infinite;
  }
  @keyframes ts3-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Task timer — start form */
  .ts3-timer-select {
    width: 100%;
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 13px;
    color: var(--n-900, #111827);
    background: var(--surface, #fff);
    margin-bottom: 6px;
    outline: none;
  }
  .ts3-timer-select:focus {
    border-color: #6366f1;
  }
  .ts3-timer-note {
    width: 100%;
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 13px;
    color: var(--n-900, #111827);
    background: var(--surface, #fff);
    outline: none;
    box-sizing: border-box;
  }
  .ts3-timer-note:focus {
    border-color: #6366f1;
  }

  /* Stopped timer — convert panel */
  .ts3-timer-convert {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ts3-timer-convert-badge {
    display: inline-flex;
    align-items: center;
    background: #f0fdf4;
    color: #059669;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 700;
    width: fit-content;
  }
  .ts3-timer-convert-detail {
    font-size: 12px;
    color: var(--n-900, #111827);
    line-height: 1.4;
  }
  .ts3-timer-convert-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
  }
  .ts3-timer-date-input {
    border: 1.5px solid var(--border-subtle, #e5e7eb);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--n-900, #111827);
    background: var(--surface, #fff);
    outline: none;
  }
  .ts3-timer-date-input:focus {
    border-color: #6366f1;
  }

  /* Timer history */
  .ts3-timer-history-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    padding: 3px 0;
    border-bottom: 1px solid var(--border-subtle, #f3f4f6);
  }
  .ts3-timer-history-proj {
    color: var(--n-700, #374151);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    margin-right: 6px;
  }
  .ts3-timer-history-dur {
    color: var(--n-500, #6b7280);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Week summary rows */
  .ts3-summary-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ts3-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  .ts3-summary-key {
    color: var(--n-500, #6b7280);
  }
  .ts3-summary-val {
    font-weight: 600;
    color: var(--n-900, #111827);
  }
  .ts3-overtime-pos {
    color: #16a34a;
  }
  .ts3-overtime-neg {
    color: #ef4444;
  }
  .ts3-overtime-deficit {
    color: #b45309;
  }

  /* Week progress bar */
  .ts3-week-prog-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ts3-week-prog-bar {
    flex: 1;
    height: 6px;
    background: var(--n-100, #f3f4f6);
    border-radius: 99px;
    overflow: hidden;
    position: relative;
  }
  .ts3-week-prog-fill {
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, #6366f1, #818cf8);
    transition: width 0.4s cubic-bezier(0.16,1,0.3,1);
  }
  .ts3-week-prog-pct {
    font-size: 10px;
    font-weight: 700;
    color: var(--brand-600, #4f46e5);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Confirmation modal */
  .ts3-modal-backdrop { position: fixed; inset: 0; background: rgba(17,24,39,0.45); z-index: 1000;
    display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
  .ts3-modal { background: #fff; border-radius: 16px; padding: 24px 24px 20px;
    max-width: 360px; width: calc(100% - 32px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10);
    display: flex; flex-direction: column; gap: 10px; }
  .ts3-modal--wide { max-width: 480px; }
  .ts3-modal-icon { width: 42px; height: 42px; border-radius: 11px; background: #fef2f2;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ts3-modal-title { font-size: 15px; font-weight: 700; color: var(--n-900, #111827); }
  .ts3-modal-body { font-size: 13px; color: var(--n-600, #4b5563); line-height: 1.55; }
  .ts3-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }

  /* Overtime info icon */
  .ts3-info-tip {
    font-size: 10px;
    color: var(--n-400, #9ca3af);
    cursor: default;
    margin-left: 2px;
    font-style: normal;
  }

  /* Today by project */
  .ts3-proj-rows {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ts3-proj-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ts3-proj-row-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ts3-proj-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .ts3-proj-name {
    flex: 1;
    font-size: 12px;
    color: var(--n-700, #374151);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ts3-proj-hours {
    font-size: 12px;
    font-weight: 600;
    color: var(--n-900, #111827);
    white-space: nowrap;
  }
  .ts3-proj-track {
    height: 4px;
    background: var(--n-100, #f3f4f6);
    border-radius: 99px;
    overflow: hidden;
  }
  .ts3-proj-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.3s;
  }
`;
