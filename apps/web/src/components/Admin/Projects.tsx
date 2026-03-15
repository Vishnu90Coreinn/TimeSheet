/**
 * Projects.tsx — Pulse SaaS design v2.0
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";

type ProjectForm = { name: string; code: string; isActive: boolean };
const BLANK: ProjectForm = { name: "", code: "", isActive: true };

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [form, setForm] = useState<ProjectForm>(BLANK);
  const [error, setError] = useState("");

  async function load() {
    const r = await apiFetch("/projects");
    if (r.ok) setProjects(await r.json());
  }

  useEffect(() => { void load(); }, []);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }
  function openEdit(p: Project) { setForm({ name: p.name, code: p.code, isActive: p.isActive }); setError(""); setEditing(p); }

  async function save() {
    setError("");
    const body = { name: form.name, code: form.code, isActive: form.isActive };
    const r = editing === "new"
      ? await apiFetch("/projects", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/projects/${(editing as Project).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function archive(id: string) {
    if (!confirm("Archive this project? It will be deactivated and hidden from timesheets.")) return;
    await apiFetch(`/projects/${id}/archive`, { method: "POST" });
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this project permanently?")) return;
    await apiFetch(`/projects/${id}`, { method: "DELETE" });
    void load();
  }

  const f = (k: keyof ProjectForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Project Admin</div>
          <div className="page-subtitle">Manage projects available for timesheet entries</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Project</button>
        </div>
      </div>

      {/* Edit / Create form */}
      {editing && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{editing === "new" ? "Create Project" : `Edit: ${(editing as Project).name}`}</div>
            </div>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", maxWidth: "480px", marginBottom: "var(--space-4)" }}>
              <div className="form-field">
                <label className="form-label" htmlFor="p-name">Name <span className="required">*</span></label>
                <input id="p-name" className="input-field" value={form.name} onChange={(e) => f("name", e.target.value)} maxLength={200} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="p-code">Code <span className="required">*</span></label>
                <input id="p-code" className="input-field" value={form.code} onChange={(e) => f("code", e.target.value.toUpperCase())} maxLength={50} required />
              </div>
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
            <div className="card-title">All Projects</div>
            <div className="card-subtitle">{projects.length} projects</div>
          </div>
        </div>
        <div className="table-wrap">
        <table className="table-base">
          <thead>
            <tr><th>Name</th><th>Code</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                <td><strong>{p.name}</strong></td>
                <td><code style={{ fontFamily: "monospace", background: "var(--n-100)", padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "0.75rem" }}>{p.code}</code></td>
                <td>
                  {p.isArchived
                    ? <span className="badge badge-neutral">archived</span>
                    : p.isActive
                      ? <span className="badge badge-success">active</span>
                      : <span className="badge badge-warning">inactive</span>}
                </td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    {!p.isArchived && <button className="btn btn-ghost btn-sm" onClick={() => void archive(p.id)}>Archive</button>}
                    <button className="btn btn-subtle-danger btn-sm" onClick={() => void remove(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && <tr className="empty-row"><td colSpan={4}>No projects found.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}
