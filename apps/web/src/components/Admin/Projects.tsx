/**
 * Projects.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";

type ProjectForm = { name: string; code: string; isActive: boolean };
const BLANK: ProjectForm = { name: "", code: "", isActive: true };
type SortDir = "asc" | "desc";

// Inline types for budget data
type ProjectBudgetHealthItem = {
  id: string;
  name: string;
  code: string;
  budgetedHours: number;
  loggedHours: number;
  pctUsed: number;
  status: "on-track" | "warning" | "critical" | "over-budget" | "no-budget";
};

type WeeklyBurnEntry = { weekStart: string; hours: number };

type ProjectBudgetSummaryResponse = {
  id: string;
  name: string;
  budgetedHours: number;
  loggedHours: number;
  remainingHours: number;
  burnRateHoursPerWeek: number;
  projectedWeeksRemaining: number | null;
  weeklyBreakdown: WeeklyBurnEntry[];
};

// ISO week Monday helper: date - (day+6)%7 days
function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function budgetColor(pct: number): string {
  if (pct >= 95) return "#ef4444"; // red
  if (pct >= 80) return "#f59e0b"; // amber
  return "#22c55e"; // green
}

function BurnBar({ pct, width = 80, height = 6 }: { pct: number; width?: number; height?: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      style={{
        display: "inline-block",
        width,
        height,
        background: "var(--n-200, #e5e7eb)",
        borderRadius: height / 2,
        overflow: "hidden",
        verticalAlign: "middle",
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: "100%",
          background: budgetColor(pct),
          borderRadius: height / 2,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function Sparkline({ weeks }: { weeks: WeeklyBurnEntry[] }) {
  const maxH = Math.max(...weeks.map(w => w.hours), 0.01);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 32, marginTop: 6 }}>
      {weeks.map(w => {
        const frac = w.hours / maxH;
        const barH = Math.max(frac * 28, w.hours > 0 ? 2 : 1);
        return (
          <div
            key={w.weekStart}
            title={`${w.weekStart}: ${w.hours.toFixed(1)}h`}
            style={{
              flex: 1,
              height: barH,
              background: w.hours > 0 ? "var(--brand-400, #818cf8)" : "var(--n-200, #e5e7eb)",
              borderRadius: 2,
              alignSelf: "flex-end",
              minHeight: 1,
            }}
          />
        );
      })}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span style={{ opacity: 0.4, fontSize: "0.7rem", marginLeft: 3 }}>↕</span>;
  return <span style={{ fontSize: "0.75rem", marginLeft: 3, color: "var(--brand-600)" }}>{dir === "asc" ? "↑" : "↓"}</span>;
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
          <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
          <div
            className="overflow-menu"
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 200 }}
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

  // Budget health state (for table column + summary card)
  const [budgetHealth, setBudgetHealth] = useState<ProjectBudgetHealthItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Budget summary state (for edit drawer)
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
    setConfirm(null);
    void load();
    void loadBudgetHealth();
  }

  async function doDelete(id: string) {
    await apiFetch(`/projects/${id}`, { method: "DELETE" });
    setConfirm(null);
    void load();
    void loadBudgetHealth();
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const f = (k: keyof ProjectForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const statusOf = (p: Project) => p.isArchived ? "archived" : p.isActive ? "active" : "inactive";

  const budgetHealthMap = new Map(budgetHealth.map(h => [h.id, h]));

  // Budget Health card counts
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

  // Budget summary panel rendered inside the edit drawer
  function BudgetPanel() {
    if (budgetSummaryLoading) {
      return (
        <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "var(--n-50, #f9fafb)", borderRadius: "var(--r-md)", fontSize: "0.8rem", color: "var(--text-tertiary, #9ca3af)" }}>
          Loading budget data…
        </div>
      );
    }
    if (!budgetSummary || budgetSummary.budgetedHours === 0) return null;

    const { budgetedHours, loggedHours, burnRateHoursPerWeek, projectedWeeksRemaining, weeklyBreakdown } = budgetSummary;
    const pct = budgetedHours > 0 ? (loggedHours / budgetedHours) * 100 : 0;
    const color = budgetColor(pct);

    return (
      <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "var(--n-50, #f9fafb)", borderRadius: "var(--r-md)", border: "1px solid var(--n-200, #e5e7eb)" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Budget Health
        </div>
        {/* Burn bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          <div style={{ flex: 1, height: 8, background: "var(--n-200, #e5e7eb)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s ease" }} />
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color, whiteSpace: "nowrap" }}>{pct.toFixed(1)}% used</span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary, #9ca3af)", marginBottom: "var(--space-1)" }}>
          {loggedHours.toFixed(1)}h logged of {budgetedHours}h budgeted
        </div>
        {projectedWeeksRemaining !== null && projectedWeeksRemaining !== undefined && burnRateHoursPerWeek > 0 && (
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
            ~{projectedWeeksRemaining} weeks remaining at current burn rate ({burnRateHoursPerWeek.toFixed(1)}h/wk)
          </div>
        )}
        {/* 8-week sparkline */}
        {weeklyBreakdown.length > 0 && (
          <>
            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary, #9ca3af)", marginTop: "var(--space-2)" }}>Last 8 weeks</div>
            <Sparkline weeks={weeklyBreakdown} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-tertiary, #9ca3af)", marginTop: 2 }}>
              <span>{weeklyBreakdown[0]?.weekStart.slice(5)}</span>
              <span>{weeklyBreakdown[weeklyBreakdown.length - 1]?.weekStart.slice(5)}</span>
            </div>
          </>
        )}
      </div>
    );
  }

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
        {/* Budget Health panel — only shown when editing an existing project */}
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

      {/* TSK-BDG-006: Budget Health summary card */}
      {showHealthCard && (
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-secondary)", marginRight: "var(--space-1)" }}>Budget Health</span>
            {onTrackCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "on-track" ? null : "on-track")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                  background: statusFilter === "on-track" ? "#16a34a" : "#dcfce7",
                  color: statusFilter === "on-track" ? "#fff" : "#16a34a",
                  transition: "background 0.15s",
                }}
              >
                {onTrackCount} on-track
              </button>
            )}
            {warningCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "warning" ? null : "warning")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                  background: statusFilter === "warning" ? "#d97706" : "#fef3c7",
                  color: statusFilter === "warning" ? "#fff" : "#d97706",
                  transition: "background 0.15s",
                }}
              >
                {warningCount} warning
              </button>
            )}
            {criticalCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "critical" ? null : "critical")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                  background: statusFilter === "critical" ? "#dc2626" : "#fee2e2",
                  color: statusFilter === "critical" ? "#fff" : "#dc2626",
                  transition: "background 0.15s",
                }}
              >
                {criticalCount} critical
              </button>
            )}
            {overBudgetCount > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === "over-budget" ? null : "over-budget")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                  background: statusFilter === "over-budget" ? "#7f1d1d" : "#fecaca",
                  color: statusFilter === "over-budget" ? "#fff" : "#7f1d1d",
                  transition: "background 0.15s",
                }}
              >
                {overBudgetCount} over-budget
              </button>
            )}
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid var(--n-300)", background: "none", cursor: "pointer", fontSize: "0.7rem", color: "var(--text-tertiary)" }}
              >
                Clear filter ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: "visible" }}>
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
                <th
                  className="th-sort"
                  onClick={() => toggleSort("name")}
                  aria-sort={sortCol === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Name <SortIcon active={sortCol === "name"} dir={sortDir} />
                </th>
                <th
                  className="th-sort"
                  style={{ width: 120 }}
                  onClick={() => toggleSort("code")}
                  aria-sort={sortCol === "code" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <span title="Project code used in reports" style={{ borderBottom: "1px dashed var(--n-300)", cursor: "help" }}>Code</span>
                  <SortIcon active={sortCol === "code"} dir={sortDir} />
                </th>
                <th
                  className="th-sort"
                  style={{ width: 110 }}
                  onClick={() => toggleSort("status")}
                  aria-sort={sortCol === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Status <SortIcon active={sortCol === "status"} dir={sortDir} />
                </th>
                {/* TSK-BDG-005: Budget column */}
                <th style={{ width: 120 }}>Budget</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const health = budgetHealthMap.get(p.id);
                return (
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
                    {/* Budget cell */}
                    <td>
                      {!health || health.budgetedHours === 0 ? (
                        <span style={{ color: "var(--text-tertiary, #9ca3af)", fontSize: "0.8rem" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <BurnBar pct={health.pctUsed} width={40} height={6} />
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: budgetColor(health.pctUsed), whiteSpace: "nowrap" }}>
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
