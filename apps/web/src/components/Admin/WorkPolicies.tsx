/**
 * WorkPolicies.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { WorkPolicy } from "../../types";

type PolicyForm = { name: string; dailyHours: string; workDaysPerWeek: number; isActive: boolean };
const BLANK: PolicyForm = { name: "", dailyHours: "8", workDaysPerWeek: 5, isActive: true };
type SortDir = "asc" | "desc";

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

function ConfirmModal({ open, title, body, onConfirm, onCancel }: { open: boolean; title: string; body: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export function WorkPolicies() {
  const [policies, setPolicies] = useState<WorkPolicy[]>([]);
  const [editing, setEditing] = useState<WorkPolicy | "new" | null>(null);
  const [form, setForm] = useState<PolicyForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkPolicy | null>(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "dailyExpectedMinutes" | "isActive">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  async function load() {
    const r = await apiFetch("/masters/work-policies");
    if (r.ok) setPolicies(await r.json());
  }

  useEffect(() => { void load(); }, []);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }
  function openEdit(p: WorkPolicy) {
    setForm({ name: p.name, dailyHours: String(p.dailyExpectedMinutes / 60), workDaysPerWeek: p.workDaysPerWeek ?? 5, isActive: p.isActive });
    setError(""); setEditing(p);
  }

  async function save() {
    setError("");
    const hours = parseFloat(form.dailyHours);
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (isNaN(hours) || hours <= 0 || hours > 24) { setError("Enter a valid daily hours (e.g. 2, 4, 8)."); return; }
    const body = {
      id: editing === "new" ? "00000000-0000-0000-0000-000000000000" : (editing as WorkPolicy).id,
      name: form.name.trim(),
      dailyExpectedMinutes: Math.round(hours * 60),
      workDaysPerWeek: form.workDaysPerWeek,
      isActive: form.isActive,
    };
    const r = editing === "new"
      ? await apiFetch("/masters/work-policies", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/masters/work-policies/${(editing as WorkPolicy).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed."); }
  }

  async function doDelete(p: WorkPolicy) {
    await apiFetch(`/masters/work-policies/${p.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    void load();
  }

  const f = (k: keyof PolicyForm, v: string | boolean | number) => setForm((prev) => ({ ...prev, [k]: v }));

  // Live weekly preview
  const hours = parseFloat(form.dailyHours);
  const daysLabel = form.workDaysPerWeek === 6 ? "Mon–Sat" : "Mon–Fri";
  const weeklyHours = isNaN(hours) ? null : (hours * form.workDaysPerWeek).toFixed(1).replace(/\.0$/, "");
  const weeklyPreview = weeklyHours ? `= ${hours}h × ${form.workDaysPerWeek} / week (${daysLabel})` : "";

  const filtered = policies.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "name") return mul * a.name.localeCompare(b.name);
    if (sortCol === "dailyExpectedMinutes") return mul * (a.dailyExpectedMinutes - b.dailyExpectedMinutes);
    if (sortCol === "isActive") return mul * (Number(b.isActive) - Number(a.isActive));
    return 0;
  });

  const drawerTitle = editing === "new" ? "New Work Policy" : editing ? `Edit — ${(editing as WorkPolicy).name}` : "";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Drawer */}
      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => void save()}>Save Policy</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </>
        }
      >
        {error && <p style={{ color: "var(--danger)", fontSize: "0.825rem", margin: 0 }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Policy Name <span className="required">*</span></label>
            <input className="input-field" placeholder="e.g. Standard 8h, Consultant 2h" value={form.name} onChange={(e) => f("name", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Daily Hours <span className="required">*</span></label>
            <input className="input-field" type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 8" value={form.dailyHours} onChange={(e) => f("dailyHours", e.target.value)} />
            {weeklyPreview && <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 4 }}>{weeklyPreview}</div>}
          </div>
          <div className="form-field">
            <label className="form-label">Work Days / Week</label>
            <select className="input-field" value={form.workDaysPerWeek} onChange={(e) => f("workDaysPerWeek", Number(e.target.value))}>
              <option value={5}>5 days (Mon–Fri)</option>
              <option value={6}>6 days (Mon–Sat)</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Status</label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", height: 38, cursor: "pointer", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} style={{ accentColor: "var(--brand-600)" }} />
              Active
            </label>
          </div>
        </div>
      </Drawer>

      {/* Confirm delete */}
      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        body="Users assigned to this policy will lose their schedule. This action cannot be undone."
        onConfirm={() => deleteTarget && void doDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Work Policy Management</div>
          <div className="page-subtitle">Define daily expected hours for different employee types</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Policy</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "visible" }}>
        <div className="card-header">
          <div>
            <div className="card-title">All Work Policies</div>
            <div className="card-subtitle">{policies.length} polic{policies.length === 1 ? "y" : "ies"}</div>
          </div>
        </div>
        <div className="table-search-bar">
          <input className="input-field table-search-input" placeholder="Search policies…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr>
                <th className="th-sort" onClick={() => toggleSort("name")} aria-sort={sortCol === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Policy Name <SortIcon active={sortCol === "name"} dir={sortDir} />
                </th>
                <th className="th-sort" style={{ width: 130 }} onClick={() => toggleSort("dailyExpectedMinutes")} aria-sort={sortCol === "dailyExpectedMinutes" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Daily Hours <SortIcon active={sortCol === "dailyExpectedMinutes"} dir={sortDir} />
                </th>
                <th style={{ width: 160 }}>Weekly Target</th>
                <th className="th-sort" style={{ width: 100 }} onClick={() => toggleSort("isActive")} aria-sort={sortCol === "isActive" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Status <SortIcon active={sortCol === "isActive"} dir={sortDir} />
                </th>
                <th style={{ width: 100, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr className="empty-row"><td colSpan={5}>{search ? "No policies match your search." : "No work policies. Click \"+ New Policy\" to create one."}</td></tr>
              )}
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 600, padding: 0, textAlign: "left", fontSize: "inherit" }} onClick={() => openEdit(p)}>
                      {p.name}
                    </button>
                  </td>
                  <td>{(p.dailyExpectedMinutes / 60).toFixed(1)}h / day</td>
                  <td>
                    <span>{((p.dailyExpectedMinutes / 60) * (p.workDaysPerWeek ?? 5)).toFixed(0)}h / week</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.75rem", marginLeft: 4 }}>({p.workDaysPerWeek === 6 ? "Mon–Sat" : "Mon–Fri"})</span>
                  </td>
                  <td>
                    <span className={`badge ${p.isActive ? "badge-success" : "badge-neutral"}`}>{p.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-subtle-danger btn-sm" onClick={() => setDeleteTarget(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ background: "var(--n-50)", border: "1px solid var(--border-subtle)" }}>
        <div className="card-body" style={{ padding: "var(--space-4) var(--space-5)" }}>
          <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "var(--text-primary)" }}>How it works:</strong> Each employee is assigned a Work Policy in the{" "}
            <strong style={{ color: "var(--brand-600)" }}>Users</strong> admin page.
            The policy defines their daily expected hours, which determines the weekly target shown in the Timesheet.
            Create separate policies for consultants (2h), part-time (4h), and full-time employees (8h).
          </p>
        </div>
      </div>
    </section>
  );
}
