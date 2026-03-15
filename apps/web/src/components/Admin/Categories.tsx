/**
 * Categories.tsx — Pulse SaaS design v2.0
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { TaskCategory } from "../../types";

type CatForm = { name: string; isBillable: boolean; isActive: boolean };
const BLANK: CatForm = { name: "", isBillable: false, isActive: true };

export function Categories() {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [editing, setEditing] = useState<TaskCategory | "new" | null>(null);
  const [form, setForm] = useState<CatForm>(BLANK);
  const [error, setError] = useState("");

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

  async function remove(id: string) {
    if (!confirm("Delete this category?")) return;
    await apiFetch(`/task-categories/${id}`, { method: "DELETE" });
    void load();
  }

  const f = (k: keyof CatForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Category Admin</div>
          <div className="page-subtitle">Manage task categories and billability flags</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Category</button>
        </div>
      </div>

      {/* Edit / Create form */}
      {editing && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{editing === "new" ? "Create Category" : `Edit: ${(editing as TaskCategory).name}`}</div>
            </div>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "320px", marginBottom: "var(--space-4)" }}>
              <div className="form-field">
                <label className="form-label" htmlFor="cat-name">Name <span className="required">*</span></label>
                <input id="cat-name" className="input-field" value={form.name} onChange={(e) => f("name", e.target.value)} maxLength={120} required />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={form.isBillable} onChange={(e) => f("isBillable", e.target.checked)} style={{ accentColor: "var(--brand-600)" }} />
                Billable
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} style={{ accentColor: "var(--brand-600)" }} />
                Active
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
            <div className="card-title">All Categories</div>
            <div className="card-subtitle">{categories.length} categories</div>
          </div>
        </div>
        <div className="table-wrap">
        <table className="table-base">
          <thead>
            <tr><th>Name</th><th>Billable</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.55 }}>
                <td><strong>{c.name}</strong></td>
                <td>{c.isBillable ? <span className="badge badge-success">Billable</span> : <span className="badge badge-neutral">Non-billable</span>}</td>
                <td>{c.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-warning">Inactive</span>}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn btn-subtle-danger btn-sm" onClick={() => void remove(c.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && <tr className="empty-row"><td colSpan={4}>No categories found.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}
