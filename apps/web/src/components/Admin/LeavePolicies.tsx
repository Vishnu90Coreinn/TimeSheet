/**
 * LeavePolicies.tsx — Pulse SaaS design v3.0
 */
import { FormEvent, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { LeavePolicy, LeavePolicyAlloc, LeaveType, PagedResponse } from "../../types";
import { AppBadge, AppButton, AppCheckbox, AppDrawer, AppIconButton, AppInput, AppModal, AppTableShell } from "../ui";
import { ServerDataTable, type ServerColumnDef, type ServerTableQuery } from "../ui";
import { useToast } from "../../contexts/ToastContext";

type PolicyForm = {
  name: string;
  isActive: boolean;
  allocations: Record<string, number>;
};

const BLANK: PolicyForm = { name: "", isActive: true, allocations: {} };

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
  const toast = useToast();
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [editing, setEditing] = useState<LeavePolicy | "new" | null>(null);
  const [form, setForm] = useState<PolicyForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [ltName, setLtName] = useState("");
  const [ltActive, setLtActive] = useState(true);
  const [ltError, setLtError] = useState("");
  const [ltSuccess, setLtSuccess] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tableQuery, setTableQuery] = useState<ServerTableQuery>({
    page: 1,
    pageSize: 25,
    search: "",
    sortBy: "name",
    sortDir: "asc",
  });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(tableQuery.page),
      pageSize: String(tableQuery.pageSize),
      sortBy: tableQuery.sortBy,
      sortDir: tableQuery.sortDir,
    });
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    const r = await apiFetch(`/leave/policies?${params.toString()}`);
    if (r.ok) {
      const d = await r.json() as PagedResponse<LeavePolicy>;
      setPolicies(d.items);
      setTotalCount(d.totalCount);
    }
    setLoading(false);
  }

  async function loadTypes() {
    const r = await apiFetch("/leave/types");
    if (r.ok) setLeaveTypes(await r.json());
  }

  useEffect(() => { void loadTypes(); }, []);
  useEffect(() => { void load(); }, [tableQuery]);

  async function saveLeaveType(e: FormEvent) {
    e.preventDefault();
    setLtError(""); setLtSuccess("");
    const name = ltName.trim();
    if (!name) { setLtError("Name is required."); return; }
    const r = await apiFetch("/leave/types", { method: "POST", body: JSON.stringify({ name, isActive: ltActive }) });
    if (r.ok) {
      setLtName(""); setLtActive(true);
      setLtSuccess(`Leave type "${name}" saved.`);
      void loadTypes();
      toast.success("Leave type created", name);
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      const msg = d.message ?? "Failed to save leave type.";
      setLtError(msg);
      toast.error("Failed to create leave type", msg);
    }
  }

  function openCreate() {
    const allocs: Record<string, number> = {};
    leaveTypes.filter((t) => t.isActive).forEach((t) => { allocs[t.id] = 0; });
    setForm({ name: "", isActive: true, allocations: allocs });
    setError(""); setEditing("new");
  }

  function openEdit(p: LeavePolicy) {
    const allocs: Record<string, number> = {};
    leaveTypes.filter((t) => t.isActive).forEach((t) => {
      const existing = p.allocations.find((a) => a.leaveTypeId === t.id);
      allocs[t.id] = existing ? existing.daysPerYear : 0;
    });
    setForm({ name: p.name, isActive: p.isActive, allocations: allocs });
    setError(""); setEditing(p);
  }

  async function save() {
    setError("");
    const isNew = editing === "new";
    const allocations = Object.entries(form.allocations).map(([leaveTypeId, daysPerYear]) => ({ leaveTypeId, daysPerYear }));
    const body = { name: form.name, isActive: form.isActive, allocations };
    const r = isNew
      ? await apiFetch("/leave/policies", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/leave/policies/${(editing as LeavePolicy).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) {
      setEditing(null);
      void load();
      toast.success(isNew ? "Policy created" : "Policy updated", form.name);
    } else {
      const d = await r.json().catch(() => ({}));
      const msg = (d as { message?: string }).message ?? "Save failed";
      setError(msg);
      toast.error("Save failed", msg);
    }
  }

  async function doDelete(id: string) {
    const r = await apiFetch(`/leave/policies/${id}`, { method: "DELETE" });
    setDeleteId(null);
    void load();
    if (r.ok || r.status === 204) toast.success("Leave policy deleted");
    else toast.error("Failed to delete leave policy");
  }

  function setAlloc(leaveTypeId: string, days: number) {
    setForm((p) => ({ ...p, allocations: { ...p.allocations, [leaveTypeId]: days } }));
  }

  const activeLeaveTypes = leaveTypes.filter((t) => t.isActive);
  const hasZeroAlloc = editing && Object.values(form.allocations).some(v => v === 0);

  const columns: ServerColumnDef<LeavePolicy>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      sortValue: p => p.name,
      render: p => (
        <AppButton className="btn-table-link" variant="ghost" size="sm" onClick={() => openEdit(p)}>{p.name}</AppButton>
      ),
    },
    {
      key: "allocations",
      label: "Allocations",
      render: p => <AllocPills allocs={p.allocations} />,
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      sortValue: p => Number(p.isActive),
      width: "100px",
      render: p => p.isActive
        ? <AppBadge variant="success">Active</AppBadge>
        : <AppBadge variant="neutral">Inactive</AppBadge>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      render: p => (
        <div className="flex gap-2">
          <AppIconButton tone="edit" onClick={() => openEdit(p)} title={`Edit ${p.name}`} aria-label={`Edit ${p.name}`}>
            <Pencil size={14} />
          </AppIconButton>
          <AppIconButton tone="danger" onClick={() => setDeleteId(p.id)} title={`Delete ${p.name}`} aria-label={`Delete ${p.name}`}>
            <Trash2 size={14} />
          </AppIconButton>
        </div>
      ),
    },
  ];

  const drawerTitle = editing === "new" ? "New Leave Policy" : editing ? `Edit: ${(editing as LeavePolicy).name}` : "";

  return (
    <section className="flex flex-col gap-6">
      <AppDrawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <AppButton variant="primary" onClick={() => void save()}>Save Policy</AppButton>
            <AppButton variant="ghost" onClick={() => setEditing(null)}>Cancel</AppButton>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="drawer-section">
          <div className="form-field">
            <label className="form-label" htmlFor="lp-name">Policy Name <span className="required">*</span></label>
            <AppInput
              id="lp-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              maxLength={120}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
            <AppCheckbox checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
            Active
          </label>
        </div>

        {activeLeaveTypes.length > 0 && (
          <div className="drawer-section">
            <div className="drawer-section-label">Leave Allocations (days/year)</div>
            {hasZeroAlloc && (
              <div className="text-[0.78rem] text-warning-dark bg-warning-light border border-[rgba(245,158,11,0.3)] rounded-md px-3 py-2">
                ⚠ Some leave types have 0 days allocated. Employees on this policy will have no entitlement for those types.
              </div>
            )}
            <div className="flex flex-col gap-2">
              {activeLeaveTypes.map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr_90px] gap-3 items-center">
                  <span className="text-[0.85rem] text-text-primary">{t.name}</span>
                  <AppInput
                    type="number"
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
      </AppDrawer>

      <AppModal
        open={!!deleteId}
        title="Delete Leave Policy?"
        body="This will permanently delete the policy. Users assigned to it will lose their leave entitlements."
        onConfirm={() => deleteId && void doDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <div className="page-header">
        <div>
          <div className="page-title">Leave Policy Management</div>
          <div className="page-subtitle">Define annual leave entitlements by leave type</div>
        </div>
        <div className="page-actions">
          <AppButton variant="outline" onClick={() => void load()}>Refresh</AppButton>
          <AppButton variant="primary" onClick={openCreate}>+ New Policy</AppButton>
        </div>
      </div>

      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Leave Policies
            <span className="mgmt-count-pill">{totalCount} polic{totalCount === 1 ? "y" : "ies"}</span>
          </div>
          <AppButton variant="outline" size="sm">Export</AppButton>
        </div>
        <ServerDataTable
          columns={columns}
          data={policies}
          totalCount={totalCount}
          query={tableQuery}
          onQueryChange={setTableQuery}
          rowKey={p => p.id}
          searchPlaceholder="Search policies…"
          emptyText="No leave policies found."
          loading={loading}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border-subtle" />
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-text-tertiary">Leave Types</span>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>

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
              <AppInput
                id="lt-name"
                placeholder="e.g. Maternity Leave"
                value={ltName}
                onChange={(e) => setLtName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary pb-[2px]">
              <AppCheckbox checked={ltActive} onChange={(e) => setLtActive(e.target.checked)} />
              Active
            </label>
            <AppButton type="submit" variant="primary">Save Leave Type</AppButton>
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

          <AppTableShell>
            <table className="table-base mgmt-table">
              <thead>
                <tr><th>Name</th><th className="w-[100px]">Status</th></tr>
              </thead>
              <tbody>
                {leaveTypes.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.isActive ? <AppBadge variant="success">Active</AppBadge> : <AppBadge variant="neutral">Inactive</AppBadge>}</td>
                  </tr>
                ))}
                {leaveTypes.length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: "center", padding: "24px 16px" }}>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No leave types defined.</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          </AppTableShell>
        </div>
      </div>
    </section>
  );
}
