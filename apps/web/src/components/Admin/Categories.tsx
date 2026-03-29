/**
 * Categories.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { TaskCategory } from "../../types";
import { AppButton, AppCheckbox, AppIconButton, AppInput, AppPagination, AppTableShell } from "../ui";

type CatForm = { name: string; isBillable: boolean; isActive: boolean };
const BLANK: CatForm = { name: "", isBillable: false, isActive: true };
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="opacity-40 text-[0.7rem] ml-[3px]">↕</span>;
  return <span className="text-[0.75rem] ml-[3px] text-brand-600">{dir === "asc" ? "↑" : "↓"}</span>;
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
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sortCol, setSortCol] = useState<"name" | "isBillable" | "isActive">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

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
    if (r.ok || r.status === 204) {
      showToast(`${c.name} marked as ${!c.isBillable ? "billable" : "non-billable"}`);
      void load();
    } else {
      showToast("Failed to update billability", false);
    }
  }

  async function toggleActive(c: TaskCategory) {
    const body = { name: c.name, isBillable: c.isBillable, isActive: !c.isActive };
    const r = await apiFetch(`/task-categories/${c.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) {
      showToast(`${c.name} ${!c.isActive ? "activated" : "deactivated"}`);
      void load();
    } else {
      showToast("Failed to update status", false);
    }
  }

  const f = (k: keyof CatForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const filtered = categories.filter(c =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "name") return mul * a.name.localeCompare(b.name);
    if (sortCol === "isBillable") return mul * (Number(b.isBillable) - Number(a.isBillable));
    if (sortCol === "isActive") return mul * (Number(b.isActive) - Number(a.isActive));
    return 0;
  });

  const drawerTitle = editing === "new" ? "New Category" : editing ? `Edit: ${(editing as TaskCategory).name}` : "";

  return (
    <section className="flex flex-col gap-6">
      {/* Toast */}
      {toast && <div className={`toast${toast.ok ? " toast--ok" : " toast--err"}`}>{toast.ok ? "✓" : "✗"} {toast.msg}</div>}

      {/* Drawer */}
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

      {/* Confirm delete modal */}
      <ConfirmModal
        open={!!deleteId}
        title="Delete Category?"
        body="This will permanently delete the category. This action cannot be undone."
        onConfirm={() => deleteId && void doDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Page header */}
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

      {/* Table */}
      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Categories
            <span className="mgmt-count-pill">{categories.length} categor{categories.length === 1 ? "y" : "ies"}</span>
          </div>
          <AppButton variant="outline" size="sm">Export</AppButton>
        </div>
        <div className="mgmt-toolbar px-4 pb-3">
          <div className="input-icon-wrap mgmt-search-wrap">
            <span className="input-icon">🔍</span>
            <AppInput className="mgmt-search" placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <AppTableShell>
          <table className="table-base mgmt-table">
            <thead>
              <tr>
                <th className="th-sort" onClick={() => toggleSort("name")} aria-sort={sortCol === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Name <SortIcon active={sortCol === "name"} dir={sortDir} />
                </th>
                <th className="th-sort w-[110px]" onClick={() => toggleSort("isBillable")} aria-sort={sortCol === "isBillable" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Billable <SortIcon active={sortCol === "isBillable"} dir={sortDir} />
                </th>
                <th className="th-sort w-[110px]" onClick={() => toggleSort("isActive")} aria-sort={sortCol === "isActive" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Active <SortIcon active={sortCol === "isActive"} dir={sortDir} />
                </th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className={c.isActive ? "" : "opacity-[0.55]"}>
                  <td>
                    <AppButton className="btn-table-link" variant="ghost" size="sm" onClick={() => openEdit(c)}>{c.name}</AppButton>
                  </td>
                  <td><ToggleSwitch checked={c.isBillable} onChange={() => void toggleBillable(c)} /></td>
                  <td><ToggleSwitch checked={c.isActive} onChange={() => void toggleActive(c)} /></td>
                  <td>
                    <div className="flex gap-2">
                      <AppIconButton
                        tone="edit"
                        onClick={() => openEdit(c)}
                        title={`Edit ${c.name}`}
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil size={14} />
                      </AppIconButton>
                      <AppIconButton
                        tone="danger"
                        onClick={() => setDeleteId(c.id)}
                        title={`Delete ${c.name}`}
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 size={14} />
                      </AppIconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && <tr className="empty-row"><td colSpan={4}>{search ? "No categories match your search." : "No categories found."}</td></tr>}
            </tbody>
          </table>
        </AppTableShell>
        <div className="mgmt-card-foot">
          <span>Showing 1-{sorted.length} of {sorted.length} categor{sorted.length === 1 ? "y" : "ies"}</span>
          <AppPagination page={1} totalPages={1} onPrev={() => {}} onNext={() => {}} />
        </div>
      </div>
    </section>
  );
}
