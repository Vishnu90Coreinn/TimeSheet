import { useEffect, useState, type ReactNode } from "react";
import { Pencil, PauseCircle, PlayCircle } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";
import { AppButton, AppCheckbox, AppIconButton, AppInput, AppSelect } from "../ui";
import { AppDataTable, type ColumnDef } from "../ui/AppDataTable";

type ProjectForm = { name: string; code: string; isActive: boolean };
const BLANK: ProjectForm = { name: "", code: "", isActive: true };

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
          <AppButton className="drawer-close" variant="ghost" size="sm" onClick={onClose}>x</AppButton>
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
  const [statusFilter, setStatusFilter] = useState("");

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
    if (r.ok || r.status === 204) { setEditing(null); void load(); return; }
    const d = await r.json().catch(() => ({}));
    setError((d as { message?: string }).message ?? "Save failed");
  }

  async function toggleProjectActive(p: Project) {
    if (p.isArchived) return;
    const body = { name: p.name, code: p.code, isActive: !p.isActive };
    const r = await apiFetch(`/projects/${p.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) void load();
  }

  const statusOf = (p: Project) => (p.isArchived ? "archived" : p.isActive ? "active" : "inactive");
  const f = (k: keyof ProjectForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const preFiltered = statusFilter ? projects.filter(p => statusOf(p) === statusFilter) : projects;

  const columns: ColumnDef<Project>[] = [
    {
      key: "name",
      label: "Project Name",
      sortable: true,
      sortValue: p => p.name,
      searchValue: p => `${p.name} ${p.code}`,
      render: p => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-bold text-[0.72rem]" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</div>
          <div>
            <div className="font-semibold text-text-primary">{p.name}</div>
            <div className="td-muted text-[0.72rem]">Created by admin</div>
          </div>
        </div>
      ),
    },
    {
      key: "code",
      label: "Code",
      sortable: true,
      sortValue: p => p.code,
      width: "180px",
      render: p => <code className="font-mono text-[0.75rem] bg-n-100 px-[6px] py-0.5 rounded-sm">{p.code}</code>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: p => statusOf(p),
      width: "160px",
      render: p => p.isArchived
        ? <span className="badge badge-neutral">Archived</span>
        : p.isActive
          ? <span className="badge badge-success">Active</span>
          : <span className="badge badge-warning">Inactive</span>,
    },
    {
      key: "budget",
      label: "Budget",
      width: "140px",
      render: () => <span className="td-muted">—</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      render: p => (
        <div className="flex gap-2 items-center">
          <AppIconButton tone="edit" onClick={() => openEdit(p)} title={`Edit ${p.name}`} aria-label={`Edit ${p.name}`}>
            <Pencil size={14} />
          </AppIconButton>
          <AppIconButton
            tone={p.isActive ? "danger" : "success"}
            onClick={() => void toggleProjectActive(p)}
            title={p.isArchived ? "Archived project cannot be activated/deactivated" : `${p.isActive ? "Deactivate" : "Activate"} ${p.name}`}
            aria-label={p.isArchived ? `Archived project ${p.name}` : `${p.isActive ? "Deactivate" : "Activate"} ${p.name}`}
            disabled={p.isArchived}
          >
            {p.isActive ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          </AppIconButton>
        </div>
      ),
    },
  ];

  const drawerTitle = editing === "new" ? "New Project" : editing ? `Edit: ${(editing as Project).name}` : "";

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
          <label className="form-label" htmlFor="p-name">Name <span className="required">*</span></label>
          <AppInput id="p-name" value={form.name} onChange={(e) => f("name", e.target.value)} maxLength={200} required />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="p-code">Code <span className="required">*</span></label>
          <AppInput id="p-code" value={form.code} onChange={(e) => f("code", e.target.value.toUpperCase())} maxLength={50} required />
        </div>
        <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
          <AppCheckbox checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} />
          Active
        </label>
      </Drawer>

      <div className="page-header">
        <div>
          <div className="page-title">Project Management</div>
          <div className="page-subtitle">Manage projects available for timesheet entries</div>
        </div>
        <div className="page-actions">
          <AppButton variant="outline" onClick={() => void load()}>Refresh</AppButton>
          <AppButton variant="primary" onClick={openCreate}>+ New Project</AppButton>
        </div>
      </div>

      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Projects
            <span className="mgmt-count-pill">{projects.length} project{projects.length === 1 ? "" : "s"}</span>
          </div>
          <AppButton variant="outline" size="sm">Export</AppButton>
        </div>
        <AppDataTable
          columns={columns}
          data={preFiltered}
          rowKey={p => p.id}
          searchPlaceholder="Search by name or code…"
          emptyText={statusFilter ? "No projects match your filters." : "No projects found."}
          rowOpacity={p => p.isActive ? 1 : 0.6}
          toolbar={
            <AppSelect style={{ height: 34, fontSize: 13 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </AppSelect>
          }
        />
      </div>
    </section>
  );
}
