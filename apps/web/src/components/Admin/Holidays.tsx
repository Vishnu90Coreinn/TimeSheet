import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { Holiday } from "../../types";
import { AppButton, AppCheckbox, AppIconButton, AppInput, AppTextarea } from "../ui";
import { AppDataTable, type ColumnDef } from "../ui/AppDataTable";

type HolidayForm = { name: string; date: string; isRecurring: boolean };
const BLANK: HolidayForm = { name: "", date: "", isRecurring: false };

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
    if (r.ok) { setEditing(null); void load(year); return; }
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
      if (parts.length < 2) { setImportError(`Invalid line: "${line}" - expected "Name, YYYY-MM-DD"`); return; }
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

  const columns: ColumnDef<Holiday>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      sortValue: h => h.name,
      render: h => (
        <AppButton className="btn-table-link" variant="ghost" size="sm" onClick={() => openEdit(h)}>{h.name}</AppButton>
      ),
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      sortValue: h => h.date,
      width: "200px",
      render: h => fmtDate(h.date),
    },
    {
      key: "isRecurring",
      label: "Recurrence",
      sortable: true,
      sortValue: h => Number(h.isRecurring),
      width: "140px",
      render: h => h.isRecurring
        ? <span className="badge bg-purple-100 text-purple-700 border border-purple-300">Annual</span>
        : <span className="badge badge-neutral">Once</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "110px",
      render: h => (
        <div className="flex gap-2">
          <AppIconButton tone="edit" onClick={() => openEdit(h)} title={`Edit ${h.name}`} aria-label={`Edit ${h.name}`}>
            <Pencil size={14} />
          </AppIconButton>
          <AppIconButton tone="danger" onClick={() => setDeleteId(h.id)} title={`Delete ${h.name}`} aria-label={`Delete ${h.name}`}>
            <Trash2 size={14} />
          </AppIconButton>
        </div>
      ),
    },
  ];

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
        <AppDataTable
          columns={columns}
          data={holidays}
          rowKey={h => h.id}
          searchPlaceholder="Search holidays…"
          emptyText={`No holidays for ${year}.`}
        />
      </div>
    </section>
  );
}
