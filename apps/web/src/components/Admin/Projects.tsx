/**
 * Projects.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";

type ProjectForm = { name: string; code: string; isActive: boolean };
const BLANK: ProjectForm = { name: "", code: "", isActive: true };
type SortDir = "asc" | "desc";

type ProjectBudgetHealthItem = {
  id: string; name: string; code: string;
  budgetedHours: number; loggedHours: number; pctUsed: number;
  status: "on-track" | "warning" | "critical" | "over-budget" | "no-budget";
};

type WeeklyBurnEntry = { weekStart: string; hours: number };

type ProjectBudgetSummaryResponse = {
  id: string; name: string; budgetedHours: number; loggedHours: number;
  remainingHours: number; burnRateHoursPerWeek: number;
  projectedWeeksRemaining: number | null; weeklyBreakdown: WeeklyBurnEntry[];
};

function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
// isoWeekMonday is used by callers; suppress unused warning
void isoWeekMonday;

function budgetColor(pct: number): string {
  if (pct >= 95) return "#ef4444";
  if (pct >= 80) return "#f59e0b";
  return "#22c55e";
}

function BurnBar({ pct, width = 80, height = 6 }: { pct: number; width?: number; height?: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      className="inline-block bg-n-200 overflow-hidden align-middle"
      style={{ width, height, borderRadius: height / 2 }}
    >
      <div
        className="h-full transition-[width] duration-300 ease-in-out"
        style={{ width: `${clamped}%`, background: budgetColor(pct), borderRadius: height / 2 }}
      />
    </div>
  );
}

function Sparkline({ weeks }: { weeks: WeeklyBurnEntry[] }) {
  const maxH = Math.max(...weeks.map(w => w.hours), 0.01);
  return (
    <div className="flex items-end gap-[2px] h-8 mt-[6px]">
      {weeks.map(w => {
        const frac = w.hours / maxH;
        const barH = Math.max(frac * 28, w.hours > 0 ? 2 : 1);
        return (
          <div
            key={w.weekStart}
            title={`${w.weekStart}: ${w.hours.toFixed(1)}h`}
            className={`flex-1 self-end rounded-[2px] min-h-[1px] ${w.hours > 0 ? "bg-brand-400" : "bg-n-200"}`}
            style={{ height: barH }}
          />
        );
      })}
    </div>
  );
}

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
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  }

  return (
    <div className="overflow-wrap">
      <button ref={btnRef} className="overflow-btn" onClick={handleOpen}>···</button>
      {open && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
          <div
            className="overflow-menu fixed z-[200]"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {items.map(item => (
              <button
                key={item.label}
                className={`overflow-item${item.danger ? " overflow-item--danger" : item.warning ? " overflow-item--warning" : ""}`}
                onClick={() => { item.onClick(); setOpen(false); }}
              >
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
  const [sortCol, setSortCol] = useState<"name" | "code" | "status">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [budgetHealth, setBudgetHealth] = useState<ProjectBudgetHealthItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<ProjectBudgetSummaryResponse | null>(null);
  const [budgetSummaryLoading, setBudgetSummaryLoading] = useState(false);

  async function load() {
    const r = await apiFetch("/projects");
    if (r.ok) setProjects(await r.json());
  }

  async function loadBudgetHealth() {
    const r = await apiFetch("/projects/budget-health");
    if (r.ok) setBudgetHealth(await r.json());
  }

  useEffect(() => {
    void load();
    void loadBudgetHealth();
  }, []);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); setBudgetSummary(null); }
  function openEdit(p: Project) {
    setForm({ name: p.name, code: p.code, isActive: p.isActive });
    setError("");
    setEditing(p);
    setBudgetSummary(null);
    void loadBudgetSummary(p.id);
  }

  async function loadBudgetSummary(projectId: string) {
    setBudgetSummaryLoading(true);
    try {
      const r = await apiFetch(`/projects/${projectId}/budget-summary`);
      if (r.ok) setBudgetSummary(await r.json());
    } finally {
      setBudgetSummaryLoading(false);
    }
  }

  async function save() {
    setError("");
    const body = { name: form.name, code: form.code, isActive: form.isActive };
    const r = editing === "new"
      ? await apiFetch("/projects", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/projects/${(editing as Project).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); void loadBudgetHealth(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function doArchive(id: string) {
    await apiFetch(`/projects/${id}/archive`, { method: "POST" });
    setConfirm(null); void load(); void loadBudgetHealth();
  }

  async function doDelete(id: string) {
    await apiFetch(`/projects/${id}`, { method: "DELETE" });
    setConfirm(null); void load(); void loadBudgetHealth();
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const f = (k: keyof ProjectForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));
  const statusOf = (p: Project) => p.isArchived ? "archived" : p.isActive ? "active" : "inactive";
  const budgetHealthMap = new Map(budgetHealth.map(h => [h.id, h]));

  const projectsWithBudget = budgetHealth.filter(h => h.budgetedHours > 0);
  const showHealthCard = projectsWithBudget.length > 0;
  const onTrackCount = budgetHealth.filter(h => h.status === "on-track").length;
  const warningCount = budgetHealth.filter(h => h.status === "warning").length;
  const criticalCount = budgetHealth.filter(h => h.status === "critical").length;
  const overBudgetCount = budgetHealth.filter(h => h.status === "over-budget").length;

  const filtered = projects.filter(p => {
    const matchesSearch = !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || (() => {
      const h = budgetHealthMap.get(p.id);
      return h?.status === statusFilter;
    })();
    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "name") return mul * a.name.localeCompare(b.name);
    if (sortCol === "code") return mul * a.code.localeCompare(b.code);
    if (sortCol === "status") return mul * statusOf(a).localeCompare(statusOf(b));
    return 0;
  });

  const drawerTitle = editing === "new" ? "New Project" : editing ? `Edit: ${(editing as Project).name}` : "";

  function BudgetPanel() {
    if (budgetSummaryLoading) {
      return (
        <div className="mt-4 p-3 bg-n-50 rounded-md text-[0.8rem] text-text-tertiary">
          Loading budget data…
        </div>
      );
    }
    if (!budgetSummary || budgetSummary.budgetedHours === 0) return null;

    const { budgetedHours, loggedHours, burnRateHoursPerWeek, projectedWeeksRemaining, weeklyBreakdown } = budgetSummary;
    const pct = budgetedHours > 0 ? (loggedHours / budgetedHours) * 100 : 0;
    const color = budgetColor(pct);

    return (
      <div className="mt-4 p-3 bg-n-50 rounded-md border border-n-200">
        <div className="text-[0.75rem] font-semibold text-text-secondary mb-2 uppercase tracking-[0.05em]">
          Budget Health
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-2 bg-n-200 rounded overflow-hidden">
            <div
              className="h-full rounded transition-[width] duration-300"
              style={{ width: `${Math.min(100, pct)}%`, background: color }}
            />
          </div>
          <span className="text-[0.8rem] font-bold whitespace-nowrap" style={{ color }}>{pct.toFixed(1)}% used</span>
        </div>
        <div className="text-[0.75rem] text-text-tertiary mb-1">
          {loggedHours.toFixed(1)}h logged of {budgetedHours}h budgeted
        </div>
        {projectedWeeksRemaining !== null && projectedWeeksRemaining !== undefined && burnRateHoursPerWeek > 0 && (
          <div className="text-[0.75rem] text-text-secondary mb-2">
            ~{projectedWeeksRemaining} weeks remaining at current burn rate ({burnRateHoursPerWeek.toFixed(1)}h/wk)
          </div>
        )}
        {weeklyBreakdown.length > 0 && (
          <>
            <div className="text-[0.7rem] text-text-tertiary mt-2">Last 8 weeks</div>
            <Sparkline weeks={weeklyBreakdown} />
            <div className="flex justify-between text-[0.65rem] text-text-tertiary mt-[2px]">
              <span>{weeklyBreakdown[0]?.weekStart.slice(5)}</span>
              <span>{weeklyBreakdown[weeklyBreakdown.length - 1]?.weekStart.slice(5)}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  const pillBase = "inline-flex items-center gap-1 px-[10px] py-[2px] rounded-full border-0 cursor-pointer text-[0.75rem] font-semibold transition-[background] duration-150";

  return (
    <section className="flex flex-col gap-6">
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
        <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
          <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} className="[accent-color:var(--brand-600)]" />
          Active
        </label>
        {editing !== "new" && <BudgetPanel />}
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
          <button className="btn btn-ghost" onClick={() => { void load(); void loadBudgetHealth(); }}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Project</button>
        </div>
      </div>

      {/* Budget Health summary card */}
      {showHealthCard && (
        <div className="card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[0.825rem] font-semibold text-text-secondary mr-1">Budget Health</span>
            {onTrackCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "on-track" ? null : "on-track")}
                className={`${pillBase} ${statusFilter === "on-track" ? "bg-green-600 text-white" : "bg-green-100 text-green-600"}`}
              >
                {onTrackCount} on-track
              </button>
            )}
            {warningCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "warning" ? null : "warning")}
                className={`${pillBase} ${statusFilter === "warning" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-600"}`}
              >
                {warningCount} warning
              </button>
            )}
            {criticalCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "critical" ? null : "critical")}
                className={`${pillBase} ${statusFilter === "critical" ? "bg-red-600 text-white" : "bg-red-100 text-red-600"}`}
              >
                {criticalCount} critical
              </button>
            )}
            {overBudgetCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "over-budget" ? null : "over-budget")}
                className={`${pillBase} ${statusFilter === "over-budget" ? "bg-red-900 text-white" : "bg-red-200 text-red-900"}`}
              >
                {overBudgetCount} over-budget
              </button>
            )}
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                className="px-2 py-[2px] rounded-full border border-n-300 bg-transparent cursor-pointer text-[0.7rem] text-text-tertiary"
              >
                Clear filter ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-visible">
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
                <th className="th-sort" onClick={() => toggleSort("name")} aria-sort={sortCol === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Name <SortIcon active={sortCol === "name"} dir={sortDir} />
                </th>
                <th className="th-sort w-[120px]" onClick={() => toggleSort("code")} aria-sort={sortCol === "code" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <span title="Project code used in reports" className="border-b border-dashed border-n-300 cursor-help">Code</span>
                  <SortIcon active={sortCol === "code"} dir={sortDir} />
                </th>
                <th className="th-sort w-[110px]" onClick={() => toggleSort("status")} aria-sort={sortCol === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Status <SortIcon active={sortCol === "status"} dir={sortDir} />
                </th>
                <th className="w-[120px]">Budget</th>
                <th className="w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const health = budgetHealthMap.get(p.id);
                return (
                  <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                    <td>
                      <button className="btn-table-link" onClick={() => openEdit(p)}>{p.name}</button>
                    </td>
                    <td><code className="font-mono bg-n-100 px-[6px] py-0.5 rounded-sm text-[0.75rem]">{p.code}</code></td>
                    <td>
                      {p.isArchived
                        ? <span className="badge badge-neutral">archived</span>
                        : p.isActive
                          ? <span className="badge badge-success">active</span>
                          : <span className="badge badge-warning">inactive</span>}
                    </td>
                    <td>
                      {!health || health.budgetedHours === 0 ? (
                        <span className="text-text-tertiary text-[0.8rem]">—</span>
                      ) : (
                        <div className="flex items-center gap-[5px]">
                          <BurnBar pct={health.pctUsed} width={40} height={6} />
                          <span className="text-[0.75rem] font-semibold whitespace-nowrap" style={{ color: budgetColor(health.pctUsed) }}>
                            {health.pctUsed.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <OverflowMenu items={[
                        { label: "Edit", onClick: () => openEdit(p) },
                        ...(!p.isArchived ? [{ label: "Archive", onClick: () => setConfirm({ id: p.id, action: "archive" }), warning: true }] : []),
                        { label: "Delete", onClick: () => setConfirm({ id: p.id, action: "delete" }), danger: true },
                      ]} />
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && <tr className="empty-row"><td colSpan={5}>{search ? "No projects match your search." : "No projects found."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
