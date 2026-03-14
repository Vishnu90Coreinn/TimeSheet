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

  function openEdit(h: Holiday) {
    setForm({ name: h.name, date: h.date, isRecurring: h.isRecurring });
    setError("");
    setEditing(h);
  }

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
    <section>
      <h2>Holiday Calendar</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        <label>Year:
          <input type="number" value={year} min={2020} max={2099} onChange={(e) => setYear(Number(e.target.value))} style={{ width: "80px", marginLeft: "6px" }} />
        </label>
        <button onClick={() => void load(year)}>Refresh</button>
        <button onClick={openCreate}>+ Add Holiday</button>
      </div>

      {editing && (
        <div style={{ border: "1px solid #ccc", padding: "16px", borderRadius: "4px", marginBottom: "16px" }}>
          <h3>{editing === "new" ? "Add Holiday" : `Edit: ${(editing as Holiday).name}`}</h3>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "340px" }}>
            <label>Name<input value={form.name} onChange={(e) => f("name", e.target.value)} /></label>
            <label>Date<input type="date" value={form.date} onChange={(e) => f("date", e.target.value)} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={form.isRecurring} onChange={(e) => f("isRecurring", e.target.checked)} /> Recurring annually
            </label>
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button onClick={() => void save()}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            {["Name", "Date", "Recurring", "Actions"].map((h) => (
              <th key={h} style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holidays.map((h) => (
            <tr key={h.id}>
              <td style={{ padding: "6px 8px" }}>{h.name}</td>
              <td style={{ padding: "6px 8px" }}>{h.date}</td>
              <td style={{ padding: "6px 8px" }}>{h.isRecurring ? "Yes" : "No"}</td>
              <td style={{ padding: "6px 8px", display: "flex", gap: "4px" }}>
                <button onClick={() => openEdit(h)}>Edit</button>
                <button onClick={() => void remove(h.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {holidays.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "16px", color: "#888" }}>No holidays for {year}</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
