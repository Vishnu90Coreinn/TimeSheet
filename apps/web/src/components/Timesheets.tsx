import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { Project, TaskCategory, TimesheetDay } from "../types";

export function Timesheets() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [timesheetDate, setTimesheetDate] = useState(new Date().toISOString().slice(0, 10));
  const [timesheetDay, setTimesheetDay] = useState<TimesheetDay | null>(null);
  const [entryForm, setEntryForm] = useState({ projectId: "", taskCategoryId: "", minutes: 60, notes: "" });
  const [submitNotes, setSubmitNotes] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");

  useEffect(() => {
    apiFetch("/timesheets/entry-options").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setProjects(d.projects);
      setCategories(d.taskCategories);
      if (d.projects.length > 0) setEntryForm((p) => ({ ...p, projectId: p.projectId || d.projects[0].id }));
      if (d.taskCategories.length > 0) setEntryForm((p) => ({ ...p, taskCategoryId: p.taskCategoryId || d.taskCategories[0].id }));
    });
    loadDay(timesheetDate);
  }, []);

  function loadDay(date: string) {
    apiFetch(`/timesheets/day?workDate=${date}`).then(async (r) => {
      if (r.ok) setTimesheetDay(await r.json());
    });
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    const r = await apiFetch("/timesheets/entries", {
      method: "POST",
      body: JSON.stringify({ workDate: timesheetDate, entryId: null, ...entryForm }),
    });
    if (r.ok) setTimesheetDay(await r.json());
  }

  async function deleteEntry(entryId: string) {
    const r = await apiFetch(`/timesheets/entries/${entryId}`, { method: "DELETE" });
    if (r.ok) setTimesheetDay(await r.json());
  }

  async function submitTimesheet() {
    const r = await apiFetch("/timesheets/submit", {
      method: "POST",
      body: JSON.stringify({ workDate: timesheetDate, notes: submitNotes, mismatchReason }),
    });
    if (r.ok) setTimesheetDay(await r.json());
  }

  return (
    <section>
      <h2>Timesheets</h2>
      <div className="card">
        <label>
          Work Date{" "}
          <input
            type="date"
            value={timesheetDate}
            onChange={(e) => {
              setTimesheetDate(e.target.value);
              loadDay(e.target.value);
            }}
          />
        </label>
        <p>Status: {timesheetDay?.status ?? "\u2014"}</p>
        <p>
          Attendance / Expected / Entered / Remaining:{" "}
          {timesheetDay?.attendanceNetMinutes ?? 0} / {timesheetDay?.expectedMinutes ?? 0} /{" "}
          {timesheetDay?.enteredMinutes ?? 0} / {timesheetDay?.remainingMinutes ?? 0}
        </p>
      </div>

      {timesheetDay?.status === "draft" && (
        <form className="card" onSubmit={saveEntry}>
          <div className="actions wrap">
            <select value={entryForm.projectId} onChange={(e) => setEntryForm((p) => ({ ...p, projectId: e.target.value }))}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={entryForm.taskCategoryId} onChange={(e) => setEntryForm((p) => ({ ...p, taskCategoryId: e.target.value }))}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" min={1} max={1440} value={entryForm.minutes} onChange={(e) => setEntryForm((p) => ({ ...p, minutes: Number(e.target.value) }))} />
            <input placeholder="Notes (optional)" maxLength={1000} value={entryForm.notes} onChange={(e) => setEntryForm((p) => ({ ...p, notes: e.target.value }))} />
            <button type="submit">Add Entry</button>
          </div>
        </form>
      )}

      <ul>
        {timesheetDay?.entries.map((entry) => (
          <li key={entry.id}>
            {entry.projectName} / {entry.taskCategoryName}: {entry.minutes}m
            {timesheetDay.status === "draft" && (
              <button onClick={() => void deleteEntry(entry.id)} style={{ marginLeft: 8 }}>Delete</button>
            )}
          </li>
        ))}
      </ul>

      {timesheetDay?.status === "draft" && (
        <div className="card">
          <textarea
            placeholder="Submission notes"
            value={submitNotes}
            onChange={(e) => setSubmitNotes(e.target.value)}
          />
          {timesheetDay.hasMismatch && (
            <textarea
              placeholder="Mismatch reason (required when attendance and entered minutes differ)"
              value={mismatchReason}
              onChange={(e) => setMismatchReason(e.target.value)}
            />
          )}
          <button onClick={() => void submitTimesheet()}>Submit Timesheet</button>
        </div>
      )}
    </section>
  );
}
