/**
 * Timesheets.tsx — Pulse SaaS design v2.0
 * Multi-entry form with hh:mm hours, Task Type dropdown, running total, hours-cap warning.
 */
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { AttendanceWidget, formatMinutes } from "./AttendanceWidget";
import type { AttendanceSummary } from "./AttendanceWidget";
import type { Project, TaskCategory, TimesheetDay } from "../types";

const TASK_TYPES = ["Development", "Testing", "Design", "Meeting", "Support", "Other"] as const;
type TaskType = (typeof TASK_TYPES)[number];

interface EntryRow {
  id: string;
  projectId: string;
  taskCategoryId: string;
  taskType: TaskType;
  description: string;
  hoursInput: string;
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

function parseHhMm(value: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return mins > 0 && mins <= 1440 ? mins : null;
}

function totalMinutes(rows: EntryRow[]): number {
  return rows.reduce((sum, r) => sum + (parseHhMm(r.hoursInput) ?? 0), 0);
}

export function Timesheets() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [timesheetDate, setTimesheetDate] = useState(new Date().toISOString().slice(0, 10));
  const [timesheetDay, setTimesheetDay] = useState<TimesheetDay | null>(null);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [submitNotes, setSubmitNotes] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
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

  function updateRow(id: string, patch: Partial<EntryRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, blankRow(projects, categories)]); }
  function removeRow(id: string) { setRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== id) : prev); }
  function validateRow(row: EntryRow): EntryRow {
    return {
      ...row,
      hoursError: parseHhMm(row.hoursInput) === null ? "Enter hours as hh:mm (e.g. 02:30)" : "",
      projectError: !row.projectId ? "Project is required." : "",
    };
  }

  async function saveEntries(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const validated = rows.map(validateRow);
    setRows(validated);
    if (validated.some((r) => r.hoursError || r.projectError)) return;

    const cap = attendanceSummary?.netMinutes ?? 0;
    const total = totalMinutes(validated);
    const existingMins = timesheetDay?.enteredMinutes ?? 0;
    if (cap > 0 && existingMins + total > cap) {
      const over = formatMinutes(existingMins + total - cap);
      if (!window.confirm(`You are about to log ${over} more than your attendance time today. Continue?`)) return;
    }

    let dayData: TimesheetDay | null = null;
    for (const row of validated) {
      const mins = parseHhMm(row.hoursInput)!;
      const notes = `[${row.taskType}]${row.description ? ` ${row.description}` : ""}`;
      const r = await apiFetch("/timesheets/entries", {
        method: "POST",
        body: JSON.stringify({ workDate: timesheetDate, entryId: null, projectId: row.projectId, taskCategoryId: row.taskCategoryId, minutes: mins, notes }),
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
      setSubmitError((body as { detail?: string; message?: string }).detail ?? (body as { message?: string }).message ?? "Submission failed.");
    }
  }

  const isDraft = timesheetDay?.status === "draft" || timesheetDay === null;
  const attendanceMinutes = attendanceSummary?.netMinutes ?? timesheetDay?.attendanceNetMinutes ?? 0;
  const pendingMinutes = totalMinutes(rows);
  const enteredMinutes = timesheetDay?.enteredMinutes ?? 0;
  const projectedTotal = enteredMinutes + pendingMinutes;
  const overCap = attendanceMinutes > 0 && projectedTotal > attendanceMinutes;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Timesheets</div>
          <div className="page-subtitle">Log your daily work hours and submit for approval</div>
        </div>
      </div>

      {/* Attendance widget */}
      <AttendanceWidget onSummaryChange={setAttendanceSummary} />

      {/* Date + status card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Work Date</div>
            <div className="card-subtitle">Select the date you are logging time for</div>
          </div>
          {timesheetDay && (
            <span className={`badge ${timesheetDay.status === "approved" ? "badge-success" : timesheetDay.status === "rejected" ? "badge-error" : timesheetDay.status === "submitted" ? "badge-brand" : "badge-warning"}`}>
              {timesheetDay.status}
            </span>
          )}
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <div style={{ marginBottom: "var(--space-4)", maxWidth: "220px" }}>
            <input
              id="ts-date"
              type="date"
              className="input-field"
              value={timesheetDate}
              onChange={(e) => { setTimesheetDate(e.target.value); loadDay(e.target.value); }}
            />
          </div>

          <div className="ts-stats">
            <Stat label="Attendance" value={formatMinutes(attendanceMinutes)} />
            <Stat label="Entered" value={formatMinutes(enteredMinutes)} />
            <Stat label="Expected" value={formatMinutes(timesheetDay?.expectedMinutes ?? 0)} />
            <Stat label="Remaining" value={formatMinutes(timesheetDay?.remainingMinutes ?? 0)} />
          </div>

          {attendanceMinutes > 0 && (
            <p className="ts-cap-hint" style={{ marginTop: "var(--space-3)" }}>
              ℹ You have <strong>{formatMinutes(attendanceMinutes)}</strong> available for timesheets today.
            </p>
          )}
        </div>
      </div>

      {/* Logged entries */}
      {(timesheetDay?.entries?.length ?? 0) > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-header">
            <div>
              <div className="card-title">Logged Entries</div>
              <div className="card-subtitle">{timesheetDay!.entries.length} {timesheetDay!.entries.length === 1 ? "entry" : "entries"} · {formatMinutes(enteredMinutes)} total</div>
            </div>
          </div>
          <table className="table-base">
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
                  <td><strong>{entry.projectName}</strong></td>
                  <td>{entry.taskCategoryName}</td>
                  <td className="td-muted">{entry.notes ?? "—"}</td>
                  <td>{formatMinutes(entry.minutes)}</td>
                  {timesheetDay!.status === "draft" && (
                    <td>
                      <button className="btn btn-subtle-danger btn-sm" onClick={() => void deleteEntry(entry.id)}>
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

      {/* Add entry form */}
      {isDraft && (
        <form className="card" onSubmit={(e) => void saveEntries(e)}>
          <div className="card-header">
            <div>
              <div className="card-title">Add Time Entries</div>
              <div className="card-subtitle">Log what you worked on today</div>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

            {rows.map((row, idx) => (
              <div key={row.id} className="ts-row">
                <div className="ts-row__header">
                  <span className="ts-row__label">Entry {idx + 1}</span>
                  {rows.length > 1 && (
                    <button type="button" className="btn btn-subtle-danger btn-sm" onClick={() => removeRow(row.id)}>
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="ts-row__grid">
                  <div className="ts-field ts-field--wide">
                    <label htmlFor={`proj-${row.id}`} className="ts-label">Project <span className="ts-required">*</span></label>
                    <select
                      id={`proj-${row.id}`}
                      className={`ts-select${row.projectError ? " ts-input--error" : ""}`}
                      value={row.projectId}
                      onChange={(e) => updateRow(row.id, { projectId: e.target.value, projectError: "" })}
                    >
                      <option value="">— Select project —</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {row.projectError
                      ? <span className="ts-hint ts-hint--error">{row.projectError}</span>
                      : <span className="ts-hint">Select the project this entry belongs to. Required.</span>
                    }
                  </div>

                  <div className="ts-field">
                    <label htmlFor={`cat-${row.id}`} className="ts-label">Task Category <span className="ts-required">*</span></label>
                    <select
                      id={`cat-${row.id}`}
                      className="ts-select"
                      value={row.taskCategoryId}
                      onChange={(e) => updateRow(row.id, { taskCategoryId: e.target.value })}
                    >
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

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

                  <div className="ts-field ts-field--narrow">
                    <label htmlFor={`hours-${row.id}`} className="ts-label">Hours Worked <span className="ts-required">*</span></label>
                    <input
                      id={`hours-${row.id}`}
                      className={`ts-input${row.hoursError ? " ts-input--error" : ""}`}
                      placeholder="hh:mm"
                      value={row.hoursInput}
                      onChange={(e) => updateRow(row.id, { hoursInput: e.target.value, hoursError: "" })}
                      onBlur={() => {
                        const err = parseHhMm(row.hoursInput) === null ? "Enter hours as hh:mm (e.g. 02:30)" : "";
                        updateRow(row.id, { hoursError: err });
                      }}
                    />
                    {row.hoursError
                      ? <span className="ts-hint ts-hint--error">{row.hoursError}</span>
                      : <span className="ts-hint">Format: hh:mm (e.g. 02:30)</span>
                    }
                  </div>

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
                  <> &nbsp;·&nbsp; Projected: <strong>{formatMinutes(projectedTotal)}</strong>{" / "}{formatMinutes(attendanceMinutes)}</>
                )}
              </span>
              {overCap && <span className="ts-warn-badge">⚠ Exceeds attendance hours</span>}
            </div>

            {submitError && <p className="ts-error">{submitError}</p>}

            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={addRow}>
                + Add Another Entry
              </button>
              <button type="submit" className="btn btn-primary">
                Save {rows.length > 1 ? `${rows.length} Entries` : "Entry"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Submit for approval */}
      {timesheetDay?.status === "draft" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Submit for Approval</div>
              <div className="card-subtitle">Send your timesheet to your manager for review</div>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
                <span className="ts-hint ts-hint--warn">⚠ Your logged hours don't match attendance. A reason is required.</span>
              </div>
            )}

            {submitError   && <p className="ts-error">{submitError}</p>}
            {submitSuccess && <p className="ts-success">{submitSuccess}</p>}

            <div>
              <button className="btn btn-primary" onClick={() => void submitTimesheet()}>
                Submit Timesheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-draft status banner */}
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
