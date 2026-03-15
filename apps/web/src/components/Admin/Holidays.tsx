/**
 * Holidays.tsx — Pulse SaaS design v2.0
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { Holiday } from "../../types";

type HolidayForm = { name: string; date: string; isRecurring: boolean };
const BLANK: HolidayForm = { name: "", date: "", isRecurring: false };

export function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);
  const [form, setForm] = useState<HolidayForm>(BLANK);
  const [error, setError] = useState("");

  async function load(y: number) {
    const r = await apiFetch(`/holidays?year=${y}`);
    if (r.ok) setHolidays(await r.json());
  }

  useEffect(() => { void load(year); }, [year]);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }
  function openEdit(h: Holiday) { setForm({ name: h.name, date: h.date, isRecurring: h.isRecurring }); setError(""); setEditing(h); }

  async function save() {
    setError("");
    const body = { name: form.name, date: form.date, isRecurring: form.isRecurring };
    const r = editing === "new"
      ? await apiFetch("/holidays", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/holidays/${(editing as Holiday).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok) { setEditing(null); void load(year); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this holiday?")) return;
    await apiFetch(`/holidays/${id}`, { method: "DELETE" });
    void load(year);
  }

  const f = (k: keyof HolidayForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Holiday Calendar</div>
          <div className="page-subtitle">Manage public holidays and recurring observances</div>
        </div>
        <div className="page-actions">
          <div className="form-field" style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-2)", display: "flex" }}>
            <label className="form-label" htmlFor="hol-year" style={{ margin: 0, whiteSpace: "nowrap" }}>Year</label>
            <input
              id="hol-year"
              type="number"
              className="input-field"
              value={year}
              min={2020} max={2099}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ width: "90px" }}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => void load(year)}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Holiday</button>
        </div>
      </div>

      {/* Edit / Create form */}
      {editing && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{editing === "new" ? "Add Holiday" : `Edit: ${(editing as Holiday).name}`}</div>
            </div>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "360px", marginBottom: "var(--space-4)" }}>
              <div className="form-field">
                <label className="form-label" htmlFor="hol-name">Name <span className="required">*</span></label>
                <input id="hol-name" className="input-field" value={form.name} onChange={(e) => f("name", e.target.value)} maxLength={200} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="hol-date">Date <span className="required">*</span></label>
                <input id="hol-date" type="date" className="input-field" value={form.date} onChange={(e) => f("date", e.target.value)} required />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={form.isRecurring} onChange={(e) => f("isRecurring", e.target.checked)} style={{ accentColor: "var(--brand-600)" }} />
                Recurring annually
              </label>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => void save()}>Save</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">Holidays — {year}</div>
            <div className="card-subtitle">{holidays.length} holidays</div>
          </div>
        </div>
        <table className="table-base">
          <thead>
            <tr><th>Name</th><th>Date</th><th>Recurring</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id}>
                <td><strong>{h.name}</strong></td>
                <td>{h.date}</td>
                <td>{h.isRecurring ? <span className="badge badge-brand">Annual</span> : <span className="badge badge-neutral">One-time</span>}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(h)}>Edit</button>
                    <button className="btn btn-subtle-danger btn-sm" onClick={() => void remove(h.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {holidays.length === 0 && <tr className="empty-row"><td colSpan={4}>No holidays for {year}.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
