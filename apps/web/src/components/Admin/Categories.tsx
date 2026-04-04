/**
 * Categories.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { PagedResponse, TaskCategory } from "../../types";
import { AppButton, AppCheckbox, AppIconButton, AppInput } from "../ui";
import { ServerDataTable, type ServerColumnDef, type ServerTableQuery } from "../ui";
import { useToast } from "../../contexts/ToastContext";

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
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
          </button>
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
  const toast = useToast();
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [editing, setEditing] = useState<TaskCategory | "new" | null>(null);
  const [form, setForm] = useState<CatForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tableQuery, setTableQuery] = useState<ServerTableQuery>({
    page: 1,
    pageSize: 25,
    search: "",
    sortBy: "name",
    sortDir: "asc",
  });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(tableQuery.page),
      pageSize: String(tableQuery.pageSize),
      sortBy: tableQuery.sortBy,
      sortDir: tableQuery.sortDir,
    });
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    const r = await apiFetch(`/task-categories/admin?${params.toString()}`);
    if (r.ok) {
      const d = await r.json() as PagedResponse<TaskCategory>;
      setCategories(d.items);
      setTotalCount(d.totalCount);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [tableQuery]);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }
  function openEdit(c: TaskCategory) { setForm({ name: c.name, isBillable: c.isBillable, isActive: c.isActive }); setError(""); setEditing(c); }

  async function save() {
    setError("");
    const isNew = editing === "new";
    const body = { name: form.name, isBillable: form.isBillable, isActive: form.isActive };
    const r = isNew
      ? await apiFetch("/task-categories", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/task-categories/${(editing as TaskCategory).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) {
      setEditing(null);
      void load();
      toast.success(isNew ? "Category created" : "Category updated", form.name);
    } else {
      const d = await r.json().catch(() => ({}));
      const msg = (d as { message?: string }).message ?? "Save failed";
      setError(msg);
      toast.error("Save failed", msg);
    }
  }

  async function doDelete(id: string) {
    const r = await apiFetch(`/task-categories/${id}`, { method: "DELETE" });
    setDeleteId(null);
    void load();
    if (r.ok || r.status === 204) toast.success("Category deleted");
    else toast.error("Failed to delete category");
  }

  async function toggleBillable(c: TaskCategory) {
    const body = { name: c.name, isBillable: !c.isBillable, isActive: c.isActive };
    const r = await apiFetch(`/task-categories/${c.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { toast.success(`${c.name} marked as ${!c.isBillable ? "billable" : "non-billable"}`); void load(); }
    else toast.error("Failed to update billability");
  }

  async function toggleActive(c: TaskCategory) {
    const body = { name: c.name, isBillable: c.isBillable, isActive: !c.isActive };
    const r = await apiFetch(`/task-categories/${c.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { toast.success(`${c.name} ${!c.isActive ? "activated" : "deactivated"}`); void load(); }
    else toast.error("Failed to update status");
  }

  const f = (k: keyof CatForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const columns: ServerColumnDef<TaskCategory>[] = [
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
      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <AppButton variant="primary" onClick={() => void save()}>Save</AppButton>
            <AppButton variant="ghost" onClick={() => setEditing(null)}>Cancel</AppButton>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="drawer-section">
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
        </div>
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
            <span className="mgmt-count-pill">{totalCount} categor{totalCount === 1 ? "y" : "ies"}</span>
          </div>
          <AppButton variant="outline" size="sm">Export</AppButton>
        </div>
        <ServerDataTable
          columns={columns}
          data={categories}
          totalCount={totalCount}
          query={tableQuery}
          onQueryChange={setTableQuery}
          rowKey={c => c.id}
          searchPlaceholder="Search categories…"
          emptyText="No categories found."
          loading={loading}
          rowOpacity={c => c.isActive ? 1 : 0.55}
        />
      </div>
    </section>
  );
}
