import { useEffect, useState, type ReactNode } from "react";
import { Pencil, PauseCircle, PlayCircle } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";

type ProjectForm = { name: string; code: string; isActive: boolean };
const BLANK: ProjectForm = { name: "", code: "", isActive: true };
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="opacity-40 text-[0.7rem] ml-[3px]">↕</span>;
  return <span className="text-[0.75rem] ml-[3px] text-brand-600">{dir === "asc" ? "↑" : "↓"}</span>;
}

function initials(name: string): string {
  return name.split(/[\s_]+/).map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}

const AVATAR_PALETTE = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
function avatarColor(name: string): string {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function Drawer({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div className="drawer-title">{title}</div>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </>
  );
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [form, setForm] = useState<ProjectForm>(BLANK);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "code" | "status">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function load() {
    const r = await apiFetch("/projects");
    if (r.ok) setProjects(await r.json());
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setForm(BLANK);
    setError("");
    setEditing("new");
  }

  function openEdit(p: Project) {
    setForm({ name: p.name, code: p.code, isActive: p.isActive });
    setError("");
    setEditing(p);
  }

  async function save() {
    setError("");
    const body = { name: form.name, code: form.code, isActive: form.isActive };
    const r = editing === "new"
      ? await apiFetch("/projects", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/projects/${(editing as Project).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) {
      setEditing(null);
      void load();
      return;
    }
    const d = await r.json().catch(() => ({}));
    setError((d as { message?: string }).message ?? "Save failed");
  }

  async function toggleProjectActive(p: Project) {
    if (p.isArchived) return;
    const body = { name: p.name, code: p.code, isActive: !p.isActive };
    const r = await apiFetch(`/projects/${p.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) void load();
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortCol(col);
    setSortDir("asc");
  }

  function toggleProjectSelect(id: string) {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const statusOf = (p: Project) => (p.isArchived ? "archived" : p.isActive ? "active" : "inactive");
  const f = (k: keyof ProjectForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const filtered = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || statusOf(p) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "name") return mul * a.name.localeCompare(b.name);
    if (sortCol === "code") return mul * a.code.localeCompare(b.code);
    return mul * statusOf(a).localeCompare(statusOf(b));
  });

  const drawerTitle = editing === "new" ? "New Project" : editing ? `Edit: ${(editing as Project).name}` : "";

  return (
    <section className="flex flex-col gap-6">
      <Drawer
        open={!!editing}
        title={drawerTitle}
        onClose={() => setEditing(null)}
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
        <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
          <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} className="[accent-color:var(--brand-600)]" />
          Active
        </label>
      </Drawer>

      <div className="page-header">
        <div>
          <div className="page-title">Project Management</div>
          <div className="page-subtitle">Manage projects available for timesheet entries</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => void load()}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Project</button>
        </div>
      </div>

      <div className="mgmt-toolbar">
        <div className="input-icon-wrap mgmt-search-wrap">
          <span className="input-icon">🔍</span>
          <input className="input-field mgmt-search" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field mgmt-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
        <button className="btn btn-outline mgmt-filter-btn">□ Filter</button>
      </div>

      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Projects
            <span className="mgmt-count-pill">{projects.length} project{projects.length === 1 ? "" : "s"}</span>
          </div>
          <button className="btn btn-outline btn-sm">Export</button>
        </div>
        <div className="table-wrap mgmt-table-wrap">
          <table className="table-base mgmt-table">
            <thead>
              <tr>
                <th className="w-11">
                  <input
                    type="checkbox"
                    aria-label="Select all projects"
                    checked={sorted.length > 0 && selectedProjectIds.size === sorted.length}
                    onChange={() => {
                      if (selectedProjectIds.size === sorted.length) setSelectedProjectIds(new Set());
                      else setSelectedProjectIds(new Set(sorted.map((p) => p.id)));
                    }}
                    className="w-4 h-4 [accent-color:var(--brand-600)]"
                  />
                </th>
                <th className="th-sort" onClick={() => toggleSort("name")} aria-sort={sortCol === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Project Name <SortIcon active={sortCol === "name"} dir={sortDir} />
                </th>
                <th className="th-sort w-[180px]" onClick={() => toggleSort("code")} aria-sort={sortCol === "code" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Code <SortIcon active={sortCol === "code"} dir={sortDir} />
                </th>
                <th className="th-sort w-[160px]" onClick={() => toggleSort("status")} aria-sort={sortCol === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Status <SortIcon active={sortCol === "status"} dir={sortDir} />
                </th>
                <th className="w-[140px]">Budget</th>
                <th className="w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "opacity-[0.6]"}>
                  <td>
                    <input type="checkbox" checked={selectedProjectIds.has(p.id)} onChange={() => toggleProjectSelect(p.id)} className="w-4 h-4 [accent-color:var(--brand-600)]" />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-bold text-[0.72rem]" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</div>
                      <div>
                        <div className="font-semibold text-text-primary">{p.name}</div>
                        <div className="td-muted text-[0.72rem]">Created by admin</div>
                      </div>
                    </div>
                  </td>
                  <td><code className="font-mono text-[0.75rem] bg-n-100 px-[6px] py-0.5 rounded-sm">{p.code}</code></td>
                  <td>
                    {p.isArchived
                      ? <span className="badge badge-neutral">Archived</span>
                      : p.isActive
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-warning">Inactive</span>}
                  </td>
                  <td className="td-muted">—</td>
                  <td>
                    <div className="flex gap-2 items-center">
                      <button
                        className="mgmt-icon-action mgmt-icon-action-edit"
                        onClick={() => openEdit(p)}
                        title={`Edit ${p.name}`}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={`mgmt-icon-action ${p.isActive ? "mgmt-icon-action-danger" : "mgmt-icon-action-success"}`}
                        onClick={() => void toggleProjectActive(p)}
                        title={p.isArchived ? "Archived project cannot be activated/deactivated" : `${p.isActive ? "Deactivate" : "Activate"} ${p.name}`}
                        aria-label={p.isArchived ? `Archived project ${p.name}` : `${p.isActive ? "Deactivate" : "Activate"} ${p.name}`}
                        disabled={p.isArchived}
                      >
                        {p.isActive ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={6}>{search || statusFilter ? "No projects match your filters." : "No projects found."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mgmt-card-foot">
          <span>Showing 1-{sorted.length} of {sorted.length} project{sorted.length === 1 ? "" : "s"}</span>
          <div className="mgmt-pagination">
            <button className="btn btn-outline btn-sm px-2" aria-label="Previous page">&lt;</button>
            <button className="btn btn-primary btn-sm px-3">1</button>
            <button className="btn btn-outline btn-sm px-2" aria-label="Next page">&gt;</button>
          </div>
        </div>
      </div>
    </section>
  );
}
