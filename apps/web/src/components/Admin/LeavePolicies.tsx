/**
 * LeavePolicies.tsx — Pulse SaaS design v2.0
 */
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { LeavePolicy, LeavePolicyAlloc, LeaveType } from "../../types";

type PolicyForm = {
  name: string;
  isActive: boolean;
  allocations: Record<string, number>; // leaveTypeId -> daysPerYear
};

const BLANK: PolicyForm = { name: "", isActive: true, allocations: {} };

export function LeavePolicies() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [editing, setEditing] = useState<LeavePolicy | "new" | null>(null);
  const [form, setForm] = useState<PolicyForm>(BLANK);
  const [error, setError] = useState("");

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

  async function remove(id: string) {
    if (!confirm("Delete this policy?")) return;
    await apiFetch(`/leave/policies/${id}`, { method: "DELETE" });
    void load();
  }

  function setAlloc(leaveTypeId: string, days: number) {
    setForm((p) => ({ ...p, allocations: { ...p.allocations, [leaveTypeId]: days } }));
  }

  const activeLeaveTypes = leaveTypes.filter((t) => t.isActive);

  function summarise(allocs: LeavePolicyAlloc[]) {
    if (allocs.length === 0) return "—";
    return allocs.map((a) => `${a.leaveTypeName}: ${a.daysPerYear}d`).join(" · ");
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Leave Policies</div>
          <div className="page-subtitle">Define annual leave entitlements by leave type</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ New Policy</button>
        </div>
      </div>

      {/* Create / Edit form */}
      {editing && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{editing === "new" ? "Create Policy" : `Edit: ${(editing as LeavePolicy).name}`}</div>
            </div>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "480px", marginBottom: "var(--space-5)" }}>
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
            </div>

            {/* Allocations table */}
            {activeLeaveTypes.length > 0 && (
              <div style={{ marginBottom: "var(--space-5)" }}>
                <div className="form-label" style={{ marginBottom: "var(--space-2)" }}>Leave Allocations</div>
                <div className="table-wrap" style={{ maxWidth: "480px" }}>
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th style={{ width: "120px" }}>Days / Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLeaveTypes.map((t) => (
                        <tr key={t.id}>
                          <td>{t.name}</td>
                          <td>
                            <input
                              type="number"
                              className="input-field"
                              value={form.allocations[t.id] ?? 0}
                              min={0}
                              max={365}
                              onChange={(e) => setAlloc(t.id, Number(e.target.value))}
                              style={{ width: "80px" }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => void save()}>Save</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Policies table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">All Leave Policies</div>
            <div className="card-subtitle">{policies.length} policies</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr><th>Name</th><th>Allocations Summary</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td className="td-muted">{summarise(p.allocations)}</td>
                  <td>{p.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-subtle-danger btn-sm" onClick={() => void remove(p.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {policies.length === 0 && <tr className="empty-row"><td colSpan={4}>No leave policies found.</td></tr>}
            </tbody>
          </table>
        </div>
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
                <tr><th>Name</th><th>Status</th></tr>
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
