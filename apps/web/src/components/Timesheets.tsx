/**
 * Timesheets.tsx — Tasks 2 & 3:
 *   - Task 2: Clear field labels, helper text, required asterisks.
 *   - Task 3: Redesigned multi-entry form with hh:mm hours, Task Type dropdown,
 *             Task Description textarea, running total, hours-cap warning,
 *             + Add Another Entry / Remove row support.
 *   - Task 4: Attendance widget embedded above the form (available hours cap).
 * All API calls are unchanged.
 */
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { AttendanceWidget, formatMinutes } from "./AttendanceWidget";
import type { AttendanceSummary } from "./AttendanceWidget";
import type { Project, TaskCategory, TimesheetDay } from "../types";

/* ─── Task type options (frontend-only label; stored in notes) ────────────── */
const TASK_TYPES = ["Development", "Testing", "Design", "Meeting", "Support", "Other"] as const;
type TaskType = (typeof TASK_TYPES)[number];

/* ─── Per-row form state ──────────────────────────────────────────────────── */
interface EntryRow {
  id: string; // client-side key only
  projectId: string;
  taskCategoryId: string;
  taskType: TaskType;
  description: string;
  hoursInput: string; // hh:mm string
  hoursError: string;
  projectError: string;
}

function blankRow(projects: Project[], categories: TaskCategory[]): EntryRow {
  return {
    id: crypto.randomUUID(),
    projectId: projects[0]?.id ?? "",
    taskCategoryId: categories[0]?.id ?? "",
    taskType: "Development",
    description: "",
    hoursInput: "01:00",
    hoursError: "",
    projectError: "",
  };
}

/** Parse "hh:mm" → total minutes. Returns null if invalid. */
function parseHhMm(value: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return mins > 0 && mins <= 1440 ? mins : null;
}

/** Total minutes across all rows */
function totalMinutes(rows: EntryRow[]): number {
  return rows.reduce((sum, r) => sum + (parseHhMm(r.hoursInput) ?? 0), 0);
}

export function Timesheets() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [timesheetDate, setTimesheetDate] = useState(new Date().toISOString().slice(0, 10));
  const [timesheetDay, setTimesheetDay] = useState<TimesheetDay | null>(null);

  // Multi-entry rows
  const [rows, setRows] = useState<EntryRow[]>([]);

  // Submit section
  const [submitNotes, setSubmitNotes] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Attendance cap from widget
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);

  useEffect(() => {
    apiFetch("/timesheets/entry-options").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setProjects(d.projects as Project[]);
      setCategories(d.taskCategories as TaskCategory[]);
      setRows([blankRow(d.projects as Project[], d.taskCategories as TaskCategory[])]);
    });
    loadDay(timesheetDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadDay(date: string) {
    apiFetch(`/timesheets/day?workDate=${date}`).then(async (r) => {
      if (r.ok) setTimesheetDay(await r.json());
    });
  }

  /* ── Row helpers ── */
  function updateRow(id: string, patch: Partial<EntryRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(projects, categories)]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function validateRow(row: EntryRow): EntryRow {
    const hoursError = parseHhMm(row.hoursInput) === null
      ? "Enter hours as hh:mm (e.g. 02:30)"
      : "";
    const projectError = !row.projectId ? "Project is required." : "";
    return { ...row, hoursError, projectError };
  }

  /* ── Add all rows as entries ── */
  async function saveEntries(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");

    // Validate all rows first
    const validated = rows.map(validateRow);
    setRows(validated);
    if (validated.some((r) => r.hoursError || r.projectError)) return;

    // Warn if total exceeds attendance (non-blocking — user can still save)
    const cap = attendanceSummary?.netMinutes ?? 0;
    const total = totalMinutes(validated);
    const existingMins = timesheetDay?.enteredMinutes ?? 0;
    if (cap > 0 && existingMins + total > cap) {
      const over = formatMinutes(existingMins + total - cap);
      const ok = window.confirm(
        `You are about to log ${over} more than your attendance time today. Continue?`
      );
      if (!ok) return;
    }

    // Submit each row sequentially; last response updates the day
    let dayData: TimesheetDay | null = null;
    for (const row of validated) {
      const mins = parseHhMm(row.hoursInput)!;
      // Prepend task type to notes so it's visible in the entry list
      const notes = `[${row.taskType}]${row.description ? ` ${row.description}` : ""}`;
      const r = await apiFetch("/timesheets/entries", {
        method: "POST",
        body: JSON.stringify({
          workDate: timesheetDate,
          entryId: null,
          projectId: row.projectId,
          taskCategoryId: row.taskCategoryId,
          minutes: mins,
          notes,
        }),
      });
      if (r.ok) dayData = await r.json();
      else {
        const body = await r.json().catch(() => ({}));
        setSubmitError((body as { message?: string }).message ?? "Failed to save an entry.");
        break;
      }
    }
    if (dayData) {
      setTimesheetDay(dayData);
      // Reset to a single blank row
      setRows([blankRow(projects, categories)]);
    }
  }

  async function deleteEntry(entryId: string) {
    const r = await apiFetch(`/timesheets/entries/${entryId}`, { method: "DELETE" });
    if (r.ok) setTimesheetDay(await r.json());
  }

  async function submitTimesheet() {
    setSubmitError("");
    setSubmitSuccess("");
    const r = await apiFetch("/timesheets/submit", {
      method: "POST",
      body: JSON.stringify({ workDate: timesheetDate, notes: submitNotes, mismatchReason }),
    });
    if (r.ok) {
      setTimesheetDay(await r.json());
      setSubmitSuccess("Timesheet submitted for approval.");
    } else {
      const body = await r.json().catch(() => ({}));
      setSubmitError((body as { detail?: string; message?: string }).detail
        ?? (body as { message?: string }).message
        ?? "Submission failed.");
    }
  }

  /* ── Computed values ── */
  const isDraft = timesheetDay?.status === "draft" || timesheetDay === null;
  const attendanceMinutes = attendanceSummary?.netMinutes ?? timesheetDay?.attendanceNetMinutes ?? 0;
  const pendingMinutes = totalMinutes(rows);
  const enteredMinutes = timesheetDay?.enteredMinutes ?? 0;
  const projectedTotal = enteredMinutes + pendingMinutes;
  const overCap = attendanceMinutes > 0 && projectedTotal > attendanceMinutes;

  return (
    <section className="ts-root">
      {/* ── Attendance widget (Task 4) ── */}
      <AttendanceWidget onSummaryChange={setAttendanceSummary} />

      <h2 className="ts-heading">Timesheets</h2>

      {/* ── Date + status bar ── */}
      <div className="ts-meta card">
        <div className="ts-meta__field">
          <label htmlFor="ts-date" className="ts-label">
            Work Date <span className="ts-required">*</span>
          </label>
          <input
            id="ts-date"
            type="date"
            className="ts-input"
            value={timesheetDate}
            onChange={(e) => {
              setTimesheetDate(e.target.value);
              loadDay(e.target.value);
            }}
          />
        </div>

        <div className="ts-stats">
          <Stat label="Status" value={timesheetDay?.status ?? "—"} />
          <Stat label="Attendance" value={formatMinutes(attendanceMinutes)} />
          <Stat label="Entered" value={formatMinutes(enteredMinutes)} />
          <Stat label="Expected" value={formatMinutes(timesheetDay?.expectedMinutes ?? 0)} />
          <Stat label="Remaining" value={formatMinutes(timesheetDay?.remainingMinutes ?? 0)} />
        </div>

        {attendanceMinutes > 0 && (
          <p className="ts-cap-hint">
            ℹ You have <strong>{formatMinutes(attendanceMinutes)}</strong> available for timesheets today.
          </p>
        )}
      </div>

      {/* ── Saved entries list ── */}
      {(timesheetDay?.entries?.length ?? 0) > 0 && (
        <div className="ts-entries card">
          <h3 className="ts-section-title">Logged Entries</h3>
          <table className="ts-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Category</th>
                <th>Notes</th>
                <th>Time</th>
                {timesheetDay?.status === "draft" && <th />}
              </tr>
            </thead>
            <tbody>
              {timesheetDay!.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.projectName}</td>
                  <td>{entry.taskCategoryName}</td>
                  <td>{entry.notes ?? "—"}</td>
                  <td>{formatMinutes(entry.minutes)}</td>
                  {timesheetDay!.status === "draft" && (
                    <td>
                      <button className="ts-btn-danger" onClick={() => void deleteEntry(entry.id)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add entry form (Tasks 2 & 3) ── */}
      {isDraft && (
        <form className="ts-form card" onSubmit={(e) => void saveEntries(e)}>
          <h3 className="ts-section-title">Add Time Entries</h3>

          {rows.map((row, idx) => (
            <div key={row.id} className="ts-row">
              <div className="ts-row__header">
                <span className="ts-row__label">Entry {idx + 1}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="ts-btn-danger ts-btn-sm"
                    onClick={() => removeRow(row.id)}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              <div className="ts-row__grid">
                {/* Project — Task 1 fix: all projects visible */}
                <div className="ts-field ts-field--wide">
                  <label htmlFor={`proj-${row.id}`} className="ts-label">
                    Project <span className="ts-required">*</span>
                  </label>
                  <select
                    id={`proj-${row.id}`}
                    className={`ts-select${row.projectError ? " ts-input--error" : ""}`}
                    value={row.projectId}
                    onChange={(e) => updateRow(row.id, { projectId: e.target.value, projectError: "" })}
                  >
                    <option value="">— Select project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {row.projectError
                    ? <span className="ts-hint ts-hint--error">{row.projectError}</span>
                    : <span className="ts-hint">Select the project this entry belongs to. Required.</span>
                  }
                </div>

                {/* Task Category */}
                <div className="ts-field">
                  <label htmlFor={`cat-${row.id}`} className="ts-label">
                    Task Category <span className="ts-required">*</span>
                  </label>
                  <select
                    id={`cat-${row.id}`}
                    className="ts-select"
                    value={row.taskCategoryId}
                    onChange={(e) => updateRow(row.id, { taskCategoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Task Type */}
                <div className="ts-field">
                  <label htmlFor={`type-${row.id}`} className="ts-label">Task Type</label>
                  <select
                    id={`type-${row.id}`}
                    className="ts-select"
                    value={row.taskType}
                    onChange={(e) => updateRow(row.id, { taskType: e.target.value as TaskType })}
                  >
                    {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Hours Worked hh:mm */}
                <div className="ts-field ts-field--narrow">
                  <label htmlFor={`hours-${row.id}`} className="ts-label">
                    Hours Worked <span className="ts-required">*</span>
                  </label>
                  <input
                    id={`hours-${row.id}`}
                    className={`ts-input${row.hoursError ? " ts-input--error" : ""}`}
                    placeholder="hh:mm"
                    value={row.hoursInput}
                    onChange={(e) => updateRow(row.id, { hoursInput: e.target.value, hoursError: "" })}
                    onBlur={() => {
                      const err = parseHhMm(row.hoursInput) === null
                        ? "Enter hours as hh:mm (e.g. 02:30)"
                        : "";
                      updateRow(row.id, { hoursError: err });
                    }}
                  />
                  {row.hoursError
                    ? <span className="ts-hint ts-hint--error">{row.hoursError}</span>
                    : <span className="ts-hint">Format: hh:mm (e.g. 02:30)</span>
                  }
                </div>

                {/* Task Description */}
                <div className="ts-field ts-field--full">
                  <label htmlFor={`desc-${row.id}`} className="ts-label">Task Description</label>
                  <textarea
                    id={`desc-${row.id}`}
                    className="ts-textarea"
                    rows={3}
                    placeholder="Describe what you worked on…"
                    maxLength={1000}
                    value={row.description}
                    onChange={(e) => updateRow(row.id, { description: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Running total */}
          <div className={`ts-total${overCap ? " ts-total--warn" : ""}`}>
            <span>
              Pending entries: <strong>{formatMinutes(pendingMinutes)}</strong>
              {attendanceMinutes > 0 && (
                <> &nbsp;|&nbsp; Projected total: <strong>{formatMinutes(projectedTotal)}</strong>
                {" / "}{formatMinutes(attendanceMinutes)} available</>
              )}
            </span>
            {overCap && <span className="ts-warn-badge">⚠ Exceeds attendance hours</span>}
          </div>

          {submitError && <p className="ts-error">{submitError}</p>}

          <div className="ts-form__actions">
            <button type="button" className="ts-btn-secondary" onClick={addRow}>
              + Add Another Entry
            </button>
            <button type="submit" className="ts-btn-primary">
              Save {rows.length > 1 ? `${rows.length} Entries` : "Entry"}
            </button>
          </div>
        </form>
      )}

      {/* ── Submit section ── */}
      {timesheetDay?.status === "draft" && (
        <div className="ts-submit card">
          <h3 className="ts-section-title">Submit for Approval</h3>

          <div className="ts-field">
            <label htmlFor="ts-submit-notes" className="ts-label">Submission Notes</label>
            <textarea
              id="ts-submit-notes"
              className="ts-textarea"
              rows={3}
              placeholder="Optional notes to your manager…"
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
            />
          </div>

          {timesheetDay.hasMismatch && (
            <div className="ts-field">
              <label htmlFor="ts-mismatch" className="ts-label">
                Mismatch Reason <span className="ts-required">*</span>
              </label>
              <textarea
                id="ts-mismatch"
                className="ts-textarea ts-textarea--warn"
                rows={3}
                placeholder="Explain why entered hours differ from attendance hours…"
                value={mismatchReason}
                onChange={(e) => setMismatchReason(e.target.value)}
              />
              <span className="ts-hint ts-hint--warn">
                ⚠ Your logged hours don't match attendance. A reason is required.
              </span>
            </div>
          )}

          {submitError && <p className="ts-error">{submitError}</p>}
          {submitSuccess && <p className="ts-success">{submitSuccess}</p>}

          <button className="ts-btn-primary" onClick={() => void submitTimesheet()}>
            Submit Timesheet
          </button>
        </div>
      )}

      {timesheetDay?.status && timesheetDay.status !== "draft" && (
        <div className="ts-status-banner">
          Timesheet status: <strong>{timesheetDay.status}</strong>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ts-stat">
      <span className="ts-stat__label">{label}</span>
      <span className="ts-stat__value">{value}</span>
    </div>
  );
}

// ts-* styles are defined in design-system.css
