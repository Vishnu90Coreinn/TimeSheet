/**
 * LeavePolicies.tsx — Pulse SaaS design v3.0
 */
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { LeavePolicy, LeavePolicyAlloc, LeaveType } from "../../types";

type PolicyForm = {
  name: string;
  isActive: boolean;
  allocations: Record<string, number>;
};

const BLANK: PolicyForm = { name: "", isActive: true, allocations: {} };
type SortDir = "asc" | "desc";

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
  if (nonZero.length === 0) return <span className="text-text-tertiary text-[0.8rem]">No allocations</span>;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {nonZero.map(a => (
        <span key={a.leaveTypeId} className="alloc-pill" title={`${a.leaveTypeName}: ${a.daysPerYear} days/year`}>
          {a.leaveTypeName} · {a.daysPerYear}d
        </span>
      ))}
      {hasZero && <span className="text-[0.7rem] text-text-tertiary">+{allocs.filter(a => a.daysPerYear === 0).length} unset</span>}
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
  const [sortCol, setSortCol] = useState<"name" | "isActive">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

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

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "name") return mul * a.name.localeCompare(b.name);
    if (sortCol === "isActive") return mul * (Number(b.isActive) - Number(a.isActive));
    return 0;
  });

  const drawerTitle = editing === "new" ? "New Leave Policy" : editing ? `Edit: ${(editing as LeavePolicy).name}` : "";

  return (
    <section className="flex flex-col gap-6">
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
        <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            className="[accent-color:var(--brand-600)]"
          />
          Active
        </label>

        <div className="border-t border-border-subtle my-2" />

        {activeLeaveTypes.length > 0 && (
          <div>
            <div className="form-label mb-2">Leave Allocations (days/year)</div>
            {hasZeroAlloc && (
              <div className="text-[0.78rem] text-warning-dark bg-warning-light border border-[rgba(245,158,11,0.3)] rounded-md px-3 py-2 mb-3">
                ⚠ Some leave types have 0 days allocated. Employees on this policy will have no entitlement for those types.
              </div>
            )}
            <div className="flex flex-col gap-2">
              {activeLeaveTypes.map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr_90px] gap-3 items-center">
                  <span className="text-[0.85rem] text-text-primary">{t.name}</span>
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
          <button className="btn btn-outline" onClick={() => void load()}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Policy</button>
        </div>
      </div>

      {/* Policies table */}
      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Leave Policies
            <span className="mgmt-count-pill">{policies.length} polic{policies.length === 1 ? "y" : "ies"}</span>
          </div>
          <button className="btn btn-outline btn-sm">Export</button>
        </div>
        <div className="mgmt-toolbar px-4 pb-3">
          <div className="input-icon-wrap mgmt-search-wrap">
            <span className="input-icon">🔍</span>
            <input className="input-field mgmt-search" placeholder="Search policies..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap mgmt-table-wrap">
          <table className="table-base mgmt-table">
            <thead>
              <tr>
                <th className="th-sort" onClick={() => toggleSort("name")} aria-sort={sortCol === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Name <SortIcon active={sortCol === "name"} dir={sortDir} />
                </th>
                <th>Allocations</th>
                <th className="th-sort w-[100px]" onClick={() => toggleSort("isActive")} aria-sort={sortCol === "isActive" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Status <SortIcon active={sortCol === "isActive"} dir={sortDir} />
                </th>
                <th className="w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td><button className="btn-table-link" onClick={() => openEdit(p)}>{p.name}</button></td>
                  <td><AllocPills allocs={p.allocations} /></td>
                  <td>{p.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="mgmt-icon-action mgmt-icon-action-edit"
                        onClick={() => openEdit(p)}
                        title={`Edit ${p.name}`}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="mgmt-icon-action mgmt-icon-action-danger"
                        onClick={() => setDeleteId(p.id)}
                        title={`Delete ${p.name}`}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && <tr className="empty-row"><td colSpan={4}>{search ? "No policies match your search." : "No leave policies found."}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mgmt-card-foot">
          <span>Showing 1-{sorted.length} of {sorted.length} polic{sorted.length === 1 ? "y" : "ies"}</span>
          <div className="mgmt-pagination">
            <button className="btn btn-outline btn-sm px-2" aria-label="Previous page">&lt;</button>
            <button className="btn btn-primary btn-sm px-3">1</button>
            <button className="btn btn-outline btn-sm px-2" aria-label="Next page">&gt;</button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border-subtle" />
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-text-tertiary">Leave Types</span>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>

      {/* Leave Types management */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Leave Types</div>
            <div className="card-subtitle">Add or update leave categories used across all policies</div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={(e) => void saveLeaveType(e)} className="flex gap-3 items-end flex-wrap mb-4">
            <div className="form-field flex-1 min-w-[200px]">
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
            <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary pb-[2px]">
              <input
                type="checkbox"
                checked={ltActive}
                onChange={(e) => setLtActive(e.target.checked)}
                className="[accent-color:var(--brand-600)]"
              />
              Active
            </label>
            <button type="submit" className="btn btn-primary">Save Leave Type</button>
          </form>

          {ltError && (
            <div className="text-[0.8rem] text-red-700 bg-red-50 border border-red-300 rounded-[7px] px-3 py-2 mb-3">
              {ltError}
            </div>
          )}
          {ltSuccess && (
            <div className="text-[0.8rem] text-green-800 bg-green-50 border border-green-300 rounded-[7px] px-3 py-2 mb-3">
              {ltSuccess}
            </div>
          )}

          <div className="table-wrap mgmt-table-wrap">
            <table className="table-base mgmt-table">
              <thead>
                <tr><th>Name</th><th className="w-[100px]">Status</th></tr>
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
