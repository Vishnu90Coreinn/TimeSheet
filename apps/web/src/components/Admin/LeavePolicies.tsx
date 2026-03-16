/**
 * LeavePolicies.tsx — Pulse SaaS design v3.0
 */
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { LeavePolicy, LeavePolicyAlloc, LeaveType } from "../../types";

type PolicyForm = {
  name: string;
  isActive: boolean;
  allocations: Record<string, number>;
};

const BLANK: PolicyForm = { name: "", isActive: true, allocations: {} };

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

function AllocPills({ allocs }: { allocs: LeavePolicyAlloc[] }) {
  const nonZero = allocs.filter(a => a.daysPerYear > 0);
  const hasZero = allocs.some(a => a.daysPerYear === 0);
  if (nonZero.length === 0) return <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>No allocations</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {nonZero.map(a => (
        <span key={a.leaveTypeId} className="alloc-pill" title={`${a.leaveTypeName}: ${a.daysPerYear} days/year`}>
          {a.leaveTypeName} · {a.daysPerYear}d
        </span>
      ))}
      {hasZero && <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>+{allocs.filter(a => a.daysPerYear === 0).length} unset</span>}
    </div>
  );
}

export function LeavePolicies() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [editing, setEditing] = useState<LeavePolicy | "new" | null>(null);
  const [form, setForm] = useState<PolicyForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Leave type creation
  const [ltName, setLtName] = useState("");
  const [ltActive, setLtActive] = useState(true);
  const [ltError, setLtError] = useState("");
  const [ltSuccess, setLtSuccess] = useState("");

  async function load() {
    const r = await apiFetch("/leave/policies");
    if (r.ok) setPolicies(await r.json());
  }

  async function loadTypes() {
    const r = await apiFetch("/leave/types");
    if (r.ok) setLeaveTypes(await r.json());
  }

  useEffect(() => {
    void load();
    void loadTypes();
  }, []);

  async function saveLeaveType(e: FormEvent) {
    e.preventDefault();
    setLtError("");
    setLtSuccess("");
    const name = ltName.trim();
    if (!name) { setLtError("Name is required."); return; }
    const r = await apiFetch("/leave/types", { method: "POST", body: JSON.stringify({ name, isActive: ltActive }) });
    if (r.ok) {
      setLtName(""); setLtActive(true);
      setLtSuccess(`Leave type "${name}" saved.`);
      void loadTypes();
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      setLtError(d.message ?? "Failed to save leave type.");
    }
  }

  function openCreate() {
    const allocs: Record<string, number> = {};
    leaveTypes.filter((t) => t.isActive).forEach((t) => { allocs[t.id] = 0; });
    setForm({ name: "", isActive: true, allocations: allocs });
    setError("");
    setEditing("new");
  }

  function openEdit(p: LeavePolicy) {
    const allocs: Record<string, number> = {};
    leaveTypes.filter((t) => t.isActive).forEach((t) => {
      const existing = p.allocations.find((a) => a.leaveTypeId === t.id);
      allocs[t.id] = existing ? existing.daysPerYear : 0;
    });
    setForm({ name: p.name, isActive: p.isActive, allocations: allocs });
    setError("");
    setEditing(p);
  }

  async function save() {
    setError("");
    const allocations = Object.entries(form.allocations).map(([leaveTypeId, daysPerYear]) => ({ leaveTypeId, daysPerYear }));
    const body = { name: form.name, isActive: form.isActive, allocations };
    const r = editing === "new"
      ? await apiFetch("/leave/policies", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/leave/policies/${(editing as LeavePolicy).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function doDelete(id: string) {
    await apiFetch(`/leave/policies/${id}`, { method: "DELETE" });
    setDeleteId(null);
    void load();
  }

  function setAlloc(leaveTypeId: string, days: number) {
    setForm((p) => ({ ...p, allocations: { ...p.allocations, [leaveTypeId]: days } }));
  }

  const activeLeaveTypes = leaveTypes.filter((t) => t.isActive);
  const hasZeroAlloc = editing && Object.values(form.allocations).some(v => v === 0);

  const filtered = policies.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const drawerTitle = editing === "new" ? "New Leave Policy" : editing ? `Edit: ${(editing as LeavePolicy).name}` : "";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Policy form drawer */}
      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => void save()}>Save Policy</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-field">
          <label className="form-label" htmlFor="lp-name">Policy Name <span className="required">*</span></label>
          <input
            id="lp-name"
            className="input-field"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            maxLength={120}
            required
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            style={{ accentColor: "var(--brand-600)" }}
          />
          Active
        </label>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "var(--space-2) 0" }} />

        {/* Allocations */}
        {activeLeaveTypes.length > 0 && (
          <div>
            <div className="form-label" style={{ marginBottom: "var(--space-2)" }}>Leave Allocations (days/year)</div>
            {hasZeroAlloc && (
              <div style={{ fontSize: "0.78rem", color: "var(--warning-dark)", background: "var(--warning-light)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--r-md)", padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-3)" }}>
                ⚠ Some leave types have 0 days allocated. Employees on this policy will have no entitlement for those types.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {activeLeaveTypes.map((t) => (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "var(--space-3)", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{t.name}</span>
                  <input
                    type="number"
                    className="input-field"
                    value={form.allocations[t.id] ?? 0}
                    min={0}
                    max={365}
                    onChange={(e) => setAlloc(t.id, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* Confirm delete modal */}
      <ConfirmModal
        open={!!deleteId}
        title="Delete Leave Policy?"
        body="This will permanently delete the policy. Users assigned to it will lose their leave entitlements."
        onConfirm={() => deleteId && void doDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Leave Policy Management</div>
          <div className="page-subtitle">Define annual leave entitlements by leave type</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ New Policy</button>
        </div>
      </div>

      {/* Policies table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">All Leave Policies</div>
            <div className="card-subtitle">{policies.length} polic{policies.length === 1 ? "y" : "ies"}</div>
          </div>
        </div>
        <div className="table-search-bar">
          <input className="input-field table-search-input" placeholder="Search policies…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr><th>Name</th><th>Allocations</th><th style={{ width: 100 }}>Status</th><th style={{ width: 100 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 600, padding: 0, textAlign: "left", fontSize: "inherit" }} onClick={() => openEdit(p)}>
                      {p.name}
                    </button>
                  </td>
                  <td><AllocPills allocs={p.allocations} /></td>
                  <td>{p.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-subtle-danger btn-sm" onClick={() => setDeleteId(p.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr className="empty-row"><td colSpan={4}>{search ? "No policies match your search." : "No leave policies found."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)" }}>Leave Types</span>
        <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
      </div>

      {/* ── Leave Types management ─────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Leave Types</div>
            <div className="card-subtitle">Add or update leave categories used across all policies</div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={(e) => void saveLeaveType(e)} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label" htmlFor="lt-name">Leave Type Name <span className="required">*</span></label>
              <input
                id="lt-name"
                className="input-field"
                placeholder="e.g. Maternity Leave"
                value={ltName}
                onChange={(e) => setLtName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.825rem", color: "var(--text-secondary)", paddingBottom: 2 }}>
              <input
                type="checkbox"
                checked={ltActive}
                onChange={(e) => setLtActive(e.target.checked)}
                style={{ accentColor: "var(--brand-600)" }}
              />
              Active
            </label>
            <button type="submit" className="btn btn-primary">Save Leave Type</button>
          </form>

          {ltError && (
            <div style={{ fontSize: "0.8rem", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 7, padding: "8px 12px", marginBottom: "var(--space-3)" }}>
              {ltError}
            </div>
          )}
          {ltSuccess && (
            <div style={{ fontSize: "0.8rem", color: "#166534", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7, padding: "8px 12px", marginBottom: "var(--space-3)" }}>
              {ltSuccess}
            </div>
          )}

          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr><th>Name</th><th style={{ width: 100 }}>Status</th></tr>
              </thead>
              <tbody>
                {leaveTypes.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  </tr>
                ))}
                {leaveTypes.length === 0 && <tr className="empty-row"><td colSpan={2}>No leave types defined.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
