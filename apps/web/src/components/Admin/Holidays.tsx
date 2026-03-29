import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { Holiday } from "../../types";
import { AppButton, AppCheckbox, AppIconButton, AppInput, AppPagination, AppTableShell, AppTextarea } from "../ui";

type HolidayForm = { name: string; date: string; isRecurring: boolean };
const BLANK: HolidayForm = { name: "", date: "", isRecurring: false };
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="opacity-40 text-[0.7rem] ml-[3px]">↕</span>;
  return <span className="text-[0.75rem] ml-[3px] text-brand-600">{dir === "asc" ? "↑" : "↓"}</span>;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
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
          <AppButton className="drawer-close" variant="ghost" size="sm" onClick={onClose}>x</AppButton>
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
          <AppButton variant="ghost" size="sm" onClick={onCancel}>Cancel</AppButton>
          <AppButton variant="danger" size="sm" onClick={onConfirm}>Delete</AppButton>
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
  const [sortCol, setSortCol] = useState<"name" | "date" | "isRecurring">("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  async function load(y: number) {
    const r = await apiFetch(`/holidays?year=${y}`);
    if (r.ok) setHolidays(await r.json());
  }

  useEffect(() => {
    void load(year);
  }, [year]);

  function openCreate() {
    setForm(BLANK);
    setError("");
    setEditing("new");
  }

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
    if (r.ok) {
      setEditing(null);
      void load(year);
      return;
    }
    const d = await r.json().catch(() => ({}));
    setError((d as { message?: string }).message ?? "Save failed");
  }

  async function doDelete(id: string) {
    await apiFetch(`/holidays/${id}`, { method: "DELETE" });
    setDeleteId(null);
    void load(year);
  }

  async function importHolidays() {
    setImportError("");
    const lines = importText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    const entries: { name: string; date: string; isRecurring: boolean }[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) {
        setImportError(`Invalid line: "${line}" - expected "Name, YYYY-MM-DD"`);
        return;
      }
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

  const filtered = holidays.filter((h) => !search.trim() || h.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "name") return mul * a.name.localeCompare(b.name);
    if (sortCol === "date") return mul * a.date.localeCompare(b.date);
    if (sortCol === "isRecurring") return mul * (Number(b.isRecurring) - Number(a.isRecurring));
    return 0;
  });

  const drawerTitle = editing === "new" ? "Add Holiday" : editing ? `Edit: ${(editing as Holiday).name}` : "";

  return (
    <section className="flex flex-col gap-6">
      <Drawer
        open={!!editing}
        title={drawerTitle}
        onClose={() => setEditing(null)}
        footer={
          <>
            <AppButton variant="primary" onClick={() => void save()}>Save</AppButton>
            <AppButton variant="ghost" onClick={() => setEditing(null)}>Cancel</AppButton>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-field">
          <label className="form-label" htmlFor="hol-name">Name <span className="required">*</span></label>
          <AppInput id="hol-name" value={form.name} onChange={(e) => f("name", e.target.value)} maxLength={200} required />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="hol-date">Date <span className="required">*</span></label>
          <AppInput id="hol-date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
          <AppCheckbox checked={form.isRecurring} onChange={(e) => f("isRecurring", e.target.checked)} />
          Recurring annually
        </label>
      </Drawer>

      <Drawer
        open={showImport}
        title="Bulk Import Holidays"
        onClose={() => setShowImport(false)}
        footer={
          <>
            <AppButton variant="primary" onClick={() => void importHolidays()}>Import</AppButton>
            <AppButton variant="ghost" onClick={() => setShowImport(false)}>Cancel</AppButton>
          </>
        }
      >
        <p className="text-[0.825rem] text-text-secondary mb-3">
          Paste one holiday per line in the format:
          <br />
          <code className="font-mono text-[0.8rem]">Holiday Name, YYYY-MM-DD, true/false</code>
          <br />
          The third column (recurring) is optional and defaults to false.
        </p>
        {importError && <div className="alert alert-error mb-3">{importError}</div>}
        <AppTextarea
          className="font-mono text-[0.8rem] resize-y"
          rows={10}
          placeholder={"Christmas Day, 2026-12-25, true\nNew Year's Day, 2026-01-01, true"}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
      </Drawer>

      <ConfirmModal
        open={!!deleteId}
        title="Delete Holiday?"
        body="This will permanently remove this holiday from the calendar."
        onConfirm={() => deleteId && void doDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <div className="page-header">
        <div>
          <div className="page-title">Holiday Management</div>
          <div className="page-subtitle">Manage public holidays and recurring observances</div>
        </div>
        <div className="page-actions">
          <div className="year-stepper">
            <AppButton className="year-stepper-btn" variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>{"<"}</AppButton>
            <span className="year-stepper-val">{year}</span>
            <AppButton className="year-stepper-btn" variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>{">"}</AppButton>
          </div>
          <AppButton variant="outline" onClick={() => void load(year)}>Refresh</AppButton>
          <AppButton variant="outline" onClick={() => setShowImport(true)}>Bulk Import</AppButton>
          <AppButton variant="primary" onClick={openCreate}>+ Add Holiday</AppButton>
        </div>
      </div>

      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            Holidays - {year}
            <span className="mgmt-count-pill">{holidays.length} holiday{holidays.length === 1 ? "" : "s"}</span>
          </div>
          <AppButton variant="outline" size="sm">Export</AppButton>
        </div>
        <div className="mgmt-toolbar px-4 pb-3">
          <div className="input-icon-wrap mgmt-search-wrap">
            <span className="input-icon">🔍</span>
            <AppInput className="mgmt-search" placeholder="Search holidays..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <AppTableShell>
          <table className="table-base mgmt-table">
            <thead>
              <tr>
                <th className="th-sort" onClick={() => toggleSort("name")} aria-sort={sortCol === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Name <SortIcon active={sortCol === "name"} dir={sortDir} />
                </th>
                <th className="th-sort w-[200px]" onClick={() => toggleSort("date")} aria-sort={sortCol === "date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Date <SortIcon active={sortCol === "date"} dir={sortDir} />
                </th>
                <th className="th-sort w-[140px]" onClick={() => toggleSort("isRecurring")} aria-sort={sortCol === "isRecurring" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Recurrence <SortIcon active={sortCol === "isRecurring"} dir={sortDir} />
                </th>
                <th className="w-[110px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <tr key={h.id}>
                  <td><AppButton className="btn-table-link" variant="ghost" size="sm" onClick={() => openEdit(h)}>{h.name}</AppButton></td>
                  <td>{fmtDate(h.date)}</td>
                  <td>{h.isRecurring ? <span className="badge bg-purple-100 text-purple-700 border border-purple-300">Annual</span> : <span className="badge badge-neutral">Once</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <AppIconButton tone="edit" onClick={() => openEdit(h)} title={`Edit ${h.name}`} aria-label={`Edit ${h.name}`}>
                        <Pencil size={14} />
                      </AppIconButton>
                      <AppIconButton tone="danger" onClick={() => setDeleteId(h.id)} title={`Delete ${h.name}`} aria-label={`Delete ${h.name}`}>
                        <Trash2 size={14} />
                      </AppIconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && <tr className="empty-row"><td colSpan={4}>{search ? "No holidays match your search." : `No holidays for ${year}.`}</td></tr>}
            </tbody>
          </table>
        </AppTableShell>
        <div className="mgmt-card-foot">
          <span>Showing 1-{sorted.length} of {sorted.length} holiday{sorted.length === 1 ? "" : "s"}</span>
          <AppPagination page={1} totalPages={1} onPrev={() => {}} onNext={() => {}} />
        </div>
      </div>
    </section>
  );
}
