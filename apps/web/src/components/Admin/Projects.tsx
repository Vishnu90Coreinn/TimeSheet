/**
 * Projects.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";

type ProjectForm = { name: string; code: string; isActive: boolean };
const BLANK: ProjectForm = { name: "", code: "", isActive: true };

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

function ConfirmModal({ open, title, body, confirmLabel = "Delete", onConfirm, onCancel }: { open: boolean; title: string; body: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function OverflowMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean; warning?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-wrap">
      <button className="overflow-btn" onClick={() => setOpen(o => !o)}>···</button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div className="overflow-menu">
            {items.map(item => (
              <button key={item.label}
                className={`overflow-item${item.danger ? " overflow-item--danger" : item.warning ? " overflow-item--warning" : ""}`}
                onClick={() => { item.onClick(); setOpen(false); }}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [form, setForm] = useState<ProjectForm>(BLANK);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; action: "archive" | "delete" } | null>(null);

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

  async function doArchive(id: string) {
    await apiFetch(`/projects/${id}/archive`, { method: "POST" });
    setConfirm(null);
    void load();
  }

  async function doDelete(id: string) {
    await apiFetch(`/projects/${id}`, { method: "DELETE" });
    setConfirm(null);
    void load();
  }

  const f = (k: keyof ProjectForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const filtered = projects.filter(p =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  const drawerTitle = editing === "new" ? "New Project" : editing ? `Edit: ${(editing as Project).name}` : "";

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
      </Drawer>

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.action === "archive" ? "Archive Project?" : "Delete Project?"}
        body={confirm?.action === "archive"
          ? "This project will be deactivated and hidden from timesheets."
          : "This will permanently delete the project. This action cannot be undone."}
        confirmLabel={confirm?.action === "archive" ? "Archive" : "Delete"}
        onConfirm={() => confirm && (confirm.action === "archive" ? void doArchive(confirm.id) : void doDelete(confirm.id))}
        onCancel={() => setConfirm(null)}
      />

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Project Management</div>
          <div className="page-subtitle">Manage projects available for timesheet entries</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Project</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">All Projects</div>
            <div className="card-subtitle">{projects.length} project{projects.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="table-search-bar">
          <input className="input-field table-search-input" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 120 }}><span title="Project code used in reports" style={{ borderBottom: "1px dashed var(--n-300)", cursor: "help" }}>Code</span></th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                  <td>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 600, padding: 0, textAlign: "left", fontSize: "inherit" }} onClick={() => openEdit(p)}>
                      {p.name}
                    </button>
                  </td>
                  <td><code style={{ fontFamily: "monospace", background: "var(--n-100)", padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "0.75rem" }}>{p.code}</code></td>
                  <td>
                    {p.isArchived
                      ? <span className="badge badge-neutral">archived</span>
                      : p.isActive
                        ? <span className="badge badge-success">active</span>
                        : <span className="badge badge-warning">inactive</span>}
                  </td>
                  <td>
                    <OverflowMenu items={[
                      { label: "Edit", onClick: () => openEdit(p) },
                      ...(!p.isArchived ? [{ label: "Archive", onClick: () => setConfirm({ id: p.id, action: "archive" }), warning: true }] : []),
                      { label: "Delete", onClick: () => setConfirm({ id: p.id, action: "delete" }), danger: true },
                    ]} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr className="empty-row"><td colSpan={4}>{search ? "No projects match your search." : "No projects found."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
