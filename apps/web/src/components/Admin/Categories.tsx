/**
 * Categories.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { TaskCategory } from "../../types";
import { AppButton, AppCheckbox, AppIconButton, AppInput } from "../ui";
import { AppDataTable, type ColumnDef } from "../ui/AppDataTable";

type CatForm = { name: string; isBillable: boolean; isActive: boolean };
const BLANK: CatForm = { name: "", isBillable: false, isActive: true };

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

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-wrap cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`toggle-track${checked ? " on" : ""}`}>
        <div className="toggle-thumb" />
      </div>
    </div>
  );
}

export function Categories() {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [editing, setEditing] = useState<TaskCategory | "new" | null>(null);
  const [form, setForm] = useState<CatForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    const r = await apiFetch("/task-categories/admin");
    if (r.ok) setCategories(await r.json());
  }

  useEffect(() => { void load(); }, []);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }
  function openEdit(c: TaskCategory) { setForm({ name: c.name, isBillable: c.isBillable, isActive: c.isActive }); setError(""); setEditing(c); }

  async function save() {
    setError("");
    const body = { name: form.name, isBillable: form.isBillable, isActive: form.isActive };
    const r = editing === "new"
      ? await apiFetch("/task-categories", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/task-categories/${(editing as TaskCategory).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function doDelete(id: string) {
    await apiFetch(`/task-categories/${id}`, { method: "DELETE" });
    setDeleteId(null);
    void load();
  }

  async function toggleBillable(c: TaskCategory) {
    const body = { name: c.name, isBillable: !c.isBillable, isActive: c.isActive };
    const r = await apiFetch(`/task-categories/${c.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { showToast(`${c.name} marked as ${!c.isBillable ? "billable" : "non-billable"}`); void load(); }
    else showToast("Failed to update billability", false);
  }

  async function toggleActive(c: TaskCategory) {
    const body = { name: c.name, isBillable: c.isBillable, isActive: !c.isActive };
    const r = await apiFetch(`/task-categories/${c.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { showToast(`${c.name} ${!c.isActive ? "activated" : "deactivated"}`); void load(); }
    else showToast("Failed to update status", false);
  }

  const f = (k: keyof CatForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const columns: ColumnDef<TaskCategory>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      sortValue: c => c.name,
      render: c => (
        <AppButton className="btn-table-link" variant="ghost" size="sm" onClick={() => openEdit(c)}>{c.name}</AppButton>
      ),
    },
    {
      key: "isBillable",
      label: "Billable",
      sortable: true,
      sortValue: c => Number(c.isBillable),
      width: "110px",
      render: c => <ToggleSwitch checked={c.isBillable} onChange={() => void toggleBillable(c)} />,
    },
    {
      key: "isActive",
      label: "Active",
      sortable: true,
      sortValue: c => Number(c.isActive),
      width: "110px",
      render: c => <ToggleSwitch checked={c.isActive} onChange={() => void toggleActive(c)} />,
    },
    {
      key: "actions",
      label: "Actions",
      width: "80px",
      render: c => (
        <div className="flex gap-2">
          <AppIconButton tone="edit" onClick={() => openEdit(c)} title={`Edit ${c.name}`} aria-label={`Edit ${c.name}`}>
            <Pencil size={14} />
          </AppIconButton>
          <AppIconButton tone="danger" onClick={() => setDeleteId(c.id)} title={`Delete ${c.name}`} aria-label={`Delete ${c.name}`}>
            <Trash2 size={14} />
          </AppIconButton>
        </div>
      ),
    },
  ];

  const drawerTitle = editing === "new" ? "New Category" : editing ? `Edit: ${(editing as TaskCategory).name}` : "";

  return (
    <section className="flex flex-col gap-6">
      {toast && <div className={`toast${toast.ok ? " toast--ok" : " toast--err"}`}>{toast.ok ? "✓" : "✗"} {toast.msg}</div>}

      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <AppButton variant="primary" onClick={() => void save()}>Save</AppButton>
            <AppButton variant="ghost" onClick={() => setEditing(null)}>Cancel</AppButton>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-field">
          <label className="form-label" htmlFor="cat-name">Name <span className="required">*</span></label>
          <AppInput id="cat-name" value={form.name} onChange={(e) => f("name", e.target.value)} maxLength={120} required />
        </div>
        <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
          <AppCheckbox checked={form.isBillable} onChange={(e) => f("isBillable", e.target.checked)} />
          Billable
        </label>
        <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
          <AppCheckbox checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} />
          Active
        </label>
      </Drawer>

      <ConfirmModal
        open={!!deleteId}
        title="Delete Category?"
        body="This will permanently delete the category. This action cannot be undone."
        onConfirm={() => deleteId && void doDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <div className="page-header">
        <div>
          <div className="page-title">Category Management</div>
          <div className="page-subtitle">Manage task categories and billability flags</div>
        </div>
        <div className="page-actions">
          <AppButton variant="outline" onClick={() => void load()}>Refresh</AppButton>
          <AppButton variant="primary" onClick={openCreate}>+ New Category</AppButton>
        </div>
      </div>

      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Categories
            <span className="mgmt-count-pill">{categories.length} categor{categories.length === 1 ? "y" : "ies"}</span>
          </div>
          <AppButton variant="outline" size="sm">Export</AppButton>
        </div>
        <AppDataTable
          columns={columns}
          data={categories}
          rowKey={c => c.id}
          searchPlaceholder="Search categories…"
          emptyText="No categories found."
          rowOpacity={c => c.isActive ? 1 : 0.55}
        />
      </div>
    </section>
  );
}
