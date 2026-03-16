/**
 * Holidays.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { Holiday } from "../../types";

type HolidayForm = { name: string; date: string; isRecurring: boolean };
const BLANK: HolidayForm = { name: "", date: "", isRecurring: false };

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function Drawer({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div className="drawer-title">{title}</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </>
  );
}

function ConfirmModal({ open, title, body, onConfirm, onCancel }: { open: boolean; title: string; body: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);
  const [form, setForm] = useState<HolidayForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

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

  async function doDelete(id: string) {
    await apiFetch(`/holidays/${id}`, { method: "DELETE" });
    setDeleteId(null);
    void load(year);
  }

  async function importHolidays() {
    setImportError("");
    const lines = importText.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const entries: { name: string; date: string; isRecurring: boolean }[] = [];
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 2) { setImportError(`Invalid line: "${line}" — expected "Name, YYYY-MM-DD"`); return; }
      entries.push({ name: parts[0], date: parts[1], isRecurring: parts[2]?.toLowerCase() === "true" });
    }
    for (const entry of entries) {
      await apiFetch("/holidays", { method: "POST", body: JSON.stringify(entry) });
    }
    setShowImport(false);
    setImportText("");
    void load(year);
  }

  const f = (k: keyof HolidayForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const filtered = holidays.filter(h =>
    !search.trim() || h.name.toLowerCase().includes(search.toLowerCase())
  );

  const drawerTitle = editing === "new" ? "Add Holiday" : editing ? `Edit: ${(editing as Holiday).name}` : "";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Drawer form */}
      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => void save()}>Save</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
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
      </Drawer>

      {/* Bulk import drawer */}
      <Drawer open={showImport} title="Bulk Import Holidays" onClose={() => setShowImport(false)}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => void importHolidays()}>Import</button>
            <button className="btn btn-ghost" onClick={() => setShowImport(false)}>Cancel</button>
          </>
        }
      >
        <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          Paste one holiday per line in the format:<br />
          <code style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>Holiday Name, YYYY-MM-DD, true/false</code><br />
          The third column (recurring) is optional and defaults to false.
        </p>
        {importError && <div className="alert alert-error" style={{ marginBottom: "var(--space-3)" }}>{importError}</div>}
        <textarea
          className="input-field"
          rows={10}
          placeholder={"Christmas Day, 2026-12-25, true\nNew Year's Day, 2026-01-01, true"}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          style={{ fontFamily: "monospace", fontSize: "0.8rem", resize: "vertical" }}
        />
      </Drawer>

      {/* Confirm delete modal */}
      <ConfirmModal
        open={!!deleteId}
        title="Delete Holiday?"
        body="This will permanently remove this holiday from the calendar."
        onConfirm={() => deleteId && void doDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Holiday Management</div>
          <div className="page-subtitle">Manage public holidays and recurring observances</div>
        </div>
        <div className="page-actions">
          {/* Year stepper */}
          <div className="year-stepper">
            <button className="year-stepper-btn" onClick={() => setYear(y => y - 1)}>‹</button>
            <span className="year-stepper-val">{year}</span>
            <button className="year-stepper-btn" onClick={() => setYear(y => y + 1)}>›</button>
          </div>
          <button className="btn btn-ghost" onClick={() => void load(year)}>Refresh</button>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>Bulk Import</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Holiday</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">Holidays — {year}</div>
            <div className="card-subtitle">{holidays.length} holiday{holidays.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="table-search-bar">
          <input className="input-field table-search-input" placeholder="Search holidays…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr><th>Name</th><th style={{ width: 200 }}>Date</th><th style={{ width: 140 }}>Recurrence</th><th style={{ width: 100 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id}>
                  <td>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 600, padding: 0, textAlign: "left", fontSize: "inherit" }} onClick={() => openEdit(h)}>
                      {h.name}
                    </button>
                  </td>
                  <td>{fmtDate(h.date)}</td>
                  <td>
                    {h.isRecurring
                      ? <span className="badge" style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd" }}>↻ Annual</span>
                      : <span className="badge badge-neutral">Once</span>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(h)}>Edit</button>
                      <button className="btn btn-subtle-danger btn-sm" onClick={() => setDeleteId(h.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr className="empty-row"><td colSpan={4}>{search ? "No holidays match your search." : `No holidays for ${year}.`}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
