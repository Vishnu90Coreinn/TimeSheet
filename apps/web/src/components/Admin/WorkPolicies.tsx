/**
 * WorkPolicies.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { PagedResponse, WorkPolicy } from "../../types";
import { AppButton, AppCheckbox, AppDrawer, AppIconButton, AppInput, AppModal, AppSelect, ServerDataTable, type ServerColumnDef, type ServerTableQuery } from "../ui";
import { useToast } from "../../contexts/ToastContext";

type PolicyForm = {
  name: string;
  dailyHours: string;
  workDaysPerWeek: number;
  isActive: boolean;
  dailyOvertimeAfterHours: string;
  weeklyOvertimeAfterHours: string;
  overtimeMultiplier: string;
  compOffEnabled: boolean;
  compOffExpiryDays: string;
};
const BLANK: PolicyForm = {
  name: "",
  dailyHours: "8",
  workDaysPerWeek: 5,
  isActive: true,
  dailyOvertimeAfterHours: "8",
  weeklyOvertimeAfterHours: "40",
  overtimeMultiplier: "1.5",
  compOffEnabled: false,
  compOffExpiryDays: "90",
};

const FALLBACK_OVERTIME = {
  dailyOvertimeAfterHours: 8,
  weeklyOvertimeAfterHours: 40,
  overtimeMultiplier: 1.5,
  compOffEnabled: false,
  compOffExpiryDays: 90,
};

export function WorkPolicies() {
  const toast = useToast();
  const [policies, setPolicies] = useState<WorkPolicy[]>([]);
  const [editing, setEditing] = useState<WorkPolicy | "new" | null>(null);
  const [form, setForm] = useState<PolicyForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkPolicy | null>(null);
  const [overtimeRulesOpen, setOvertimeRulesOpen] = useState(true);
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
    const r = await apiFetch(`/masters/work-policies?${params.toString()}`);
    if (r.ok) {
      const d = await r.json() as PagedResponse<WorkPolicy>;
      setPolicies(d.items);
      setTotalCount(d.totalCount);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [tableQuery]);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); setOvertimeRulesOpen(true); }
  function openEdit(p: WorkPolicy) {
    setForm({
      name: p.name,
      dailyHours: String(p.dailyExpectedMinutes / 60),
      workDaysPerWeek: p.workDaysPerWeek ?? 5,
      isActive: p.isActive,
      dailyOvertimeAfterHours: String(p.dailyOvertimeAfterHours ?? FALLBACK_OVERTIME.dailyOvertimeAfterHours),
      weeklyOvertimeAfterHours: String(p.weeklyOvertimeAfterHours ?? FALLBACK_OVERTIME.weeklyOvertimeAfterHours),
      overtimeMultiplier: String(p.overtimeMultiplier ?? FALLBACK_OVERTIME.overtimeMultiplier),
      compOffEnabled: p.compOffEnabled ?? FALLBACK_OVERTIME.compOffEnabled,
      compOffExpiryDays: String(p.compOffExpiryDays ?? FALLBACK_OVERTIME.compOffExpiryDays),
    });
    setError(""); setEditing(p); setOvertimeRulesOpen(true);
  }

  async function save() {
    setError("");
    const hours = parseFloat(form.dailyHours);
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (isNaN(hours) || hours <= 0 || hours > 24) { setError("Enter a valid daily hours (e.g. 2, 4, 8)."); return; }
    const dailyOvertimeAfterHours = parseFloat(form.dailyOvertimeAfterHours);
    const weeklyOvertimeAfterHours = parseFloat(form.weeklyOvertimeAfterHours);
    const overtimeMultiplier = parseFloat(form.overtimeMultiplier);
    const compOffExpiryDays = parseInt(form.compOffExpiryDays, 10);
    if (isNaN(dailyOvertimeAfterHours) || dailyOvertimeAfterHours < 0) { setError("Enter a valid daily overtime threshold."); return; }
    if (isNaN(weeklyOvertimeAfterHours) || weeklyOvertimeAfterHours < 0) { setError("Enter a valid weekly overtime threshold."); return; }
    if (isNaN(overtimeMultiplier) || overtimeMultiplier <= 0) { setError("Enter a valid overtime multiplier."); return; }
    if (isNaN(compOffExpiryDays) || compOffExpiryDays < 0) { setError("Enter a valid comp-off expiry in days."); return; }
    const body = {
      id: editing === "new" ? "00000000-0000-0000-0000-000000000000" : (editing as WorkPolicy).id,
      name: form.name.trim(),
      dailyExpectedMinutes: Math.round(hours * 60),
      workDaysPerWeek: form.workDaysPerWeek,
      isActive: form.isActive,
      dailyOvertimeAfterHours,
      weeklyOvertimeAfterHours,
      overtimeMultiplier,
      compOffEnabled: form.compOffEnabled,
      compOffExpiryDays,
    };
    const isNew = editing === "new";
    const r = isNew
      ? await apiFetch("/masters/work-policies", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/masters/work-policies/${(editing as WorkPolicy).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok) {
      setEditing(null);
      void load();
      toast.success(isNew ? "Policy created" : "Policy updated", form.name.trim());
    } else {
      const d = await r.json().catch(() => ({}));
      const msg = (d as { message?: string }).message ?? "Save failed.";
      setError(msg);
      toast.error("Save failed", msg);
    }
  }

  async function doDelete(p: WorkPolicy) {
    const r = await apiFetch(`/masters/work-policies/${p.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    void load();
    if (r.ok || r.status === 204) toast.success("Work policy deleted", p.name);
    else toast.error("Failed to delete work policy");
  }

  const f = (k: keyof PolicyForm, v: string | boolean | number) => setForm((prev) => ({ ...prev, [k]: v }));

  const hours = parseFloat(form.dailyHours);
  const dailyOvertimeAfterHours = parseFloat(form.dailyOvertimeAfterHours);
  const weeklyOvertimeAfterHours = parseFloat(form.weeklyOvertimeAfterHours);
  const overtimeMultiplier = parseFloat(form.overtimeMultiplier);
  const compOffExpiryDays = parseInt(form.compOffExpiryDays, 10);
  const daysLabel = form.workDaysPerWeek === 6 ? "Mon–Sat" : "Mon–Fri";
  const weeklyHours = isNaN(hours) ? null : (hours * form.workDaysPerWeek).toFixed(1).replace(/\.0$/, "");
  const weeklyPreview = weeklyHours ? `= ${hours}h × ${form.workDaysPerWeek} / week (${daysLabel})` : "";
  const overtimePreview = [
    `Daily after ${isNaN(dailyOvertimeAfterHours) ? FALLBACK_OVERTIME.dailyOvertimeAfterHours : dailyOvertimeAfterHours}h`,
    `Weekly after ${isNaN(weeklyOvertimeAfterHours) ? FALLBACK_OVERTIME.weeklyOvertimeAfterHours : weeklyOvertimeAfterHours}h`,
    `${isNaN(overtimeMultiplier) ? FALLBACK_OVERTIME.overtimeMultiplier : overtimeMultiplier}x overtime`,
    form.compOffEnabled ? `Comp-off expires in ${isNaN(compOffExpiryDays) ? FALLBACK_OVERTIME.compOffExpiryDays : compOffExpiryDays} days` : "Comp-off disabled",
  ].join(" · ");

  function formatOvertimeSummary(policy: WorkPolicy): string {
    const dailyThreshold = policy.dailyOvertimeAfterHours ?? FALLBACK_OVERTIME.dailyOvertimeAfterHours;
    const weeklyThreshold = policy.weeklyOvertimeAfterHours ?? FALLBACK_OVERTIME.weeklyOvertimeAfterHours;
    const multiplier = policy.overtimeMultiplier ?? FALLBACK_OVERTIME.overtimeMultiplier;
    const compOffExpiry = policy.compOffExpiryDays ?? FALLBACK_OVERTIME.compOffExpiryDays;
    const compOff = policy.compOffEnabled ?? FALLBACK_OVERTIME.compOffEnabled;
    return `OT after ${dailyThreshold}h/day, ${weeklyThreshold}h/week · ${multiplier}x · ${compOff ? `Comp-off ${compOffExpiry}d` : "No comp-off"}`;
  }

  const columns: ServerColumnDef<WorkPolicy>[] = [
    {
      key: "name",
      label: "Policy Name",
      sortable: true,
      sortValue: p => p.name,
      render: p => (
        <div>
          <AppButton className="btn-table-link text-left" variant="ghost" size="sm" onClick={() => openEdit(p)}>{p.name}</AppButton>
          <div className="text-[0.75rem] text-text-tertiary mt-1 leading-5">{formatOvertimeSummary(p)}</div>
        </div>
      ),
    },
    {
      key: "dailyExpectedMinutes",
      label: "Daily Hours",
      sortable: true,
      sortValue: p => p.dailyExpectedMinutes,
      width: "130px",
      render: p => `${(p.dailyExpectedMinutes / 60).toFixed(1)}h / day`,
    },
    {
      key: "weeklyTarget",
      label: "Weekly Target",
      width: "160px",
      render: p => (
        <span>
          {((p.dailyExpectedMinutes / 60) * (p.workDaysPerWeek ?? 5)).toFixed(0)}h / week
          <span className="text-text-tertiary text-[0.75rem] ml-1">({p.workDaysPerWeek === 6 ? "Mon–Sat" : "Mon–Fri"})</span>
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      sortValue: p => Number(p.isActive),
      width: "100px",
      render: p => (
        <span className={`badge ${p.isActive ? "badge-success" : "badge-neutral"}`}>{p.isActive ? "Active" : "Inactive"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      render: p => (
        <div className="flex gap-2 justify-end">
          <AppIconButton tone="edit" onClick={() => openEdit(p)} title={`Edit ${p.name}`} aria-label={`Edit ${p.name}`}>
            <Pencil size={14} />
          </AppIconButton>
          <AppIconButton tone="danger" onClick={() => setDeleteTarget(p)} title={`Delete ${p.name}`} aria-label={`Delete ${p.name}`}>
            <Trash2 size={14} />
          </AppIconButton>
        </div>
      ),
    },
  ];

  const drawerTitle = editing === "new" ? "New Work Policy" : editing ? `Edit — ${(editing as WorkPolicy).name}` : "";

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
        {error && <p className="text-danger text-[0.825rem] m-0">{error}</p>}
        <div className="drawer-section">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-field col-span-2">
              <label className="form-label">Policy Name <span className="required">*</span></label>
              <AppInput placeholder="e.g. Standard 8h, Consultant 2h" value={form.name} onChange={(e) => f("name", e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Daily Hours <span className="required">*</span></label>
              <AppInput type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 8" value={form.dailyHours} onChange={(e) => f("dailyHours", e.target.value)} />
              {weeklyPreview && <div className="text-[0.75rem] text-text-tertiary mt-1">{weeklyPreview}</div>}
            </div>
            <div className="form-field">
              <label className="form-label">Work Days / Week</label>
              <AppSelect value={form.workDaysPerWeek} onChange={(e) => f("workDaysPerWeek", Number(e.target.value))}>
                <option value={5}>5 days (Mon–Fri)</option>
                <option value={6}>6 days (Mon–Sat)</option>
              </AppSelect>
            </div>
            <div className="form-field">
              <label className="form-label">Status</label>
              <label className="flex items-center gap-2 h-[38px] cursor-pointer text-[0.825rem] text-text-secondary">
                <AppCheckbox checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} />
                Active
              </label>
            </div>
          </div>
        </div>
        <div className="border border-border-subtle rounded-xl bg-n-0 overflow-hidden">
            <AppButton
              type="button"
              variant="ghost"
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => setOvertimeRulesOpen((open) => !open)}
            >
              <div>
                <div className="text-[0.85rem] font-semibold text-text-primary">Overtime Rules</div>
                <div className="text-[0.75rem] text-text-tertiary mt-0.5">Set daily and weekly thresholds plus comp-off handling</div>
              </div>
              <span className="text-text-tertiary text-[0.9rem]">{overtimeRulesOpen ? "−" : "+"}</span>
            </AppButton>
            {overtimeRulesOpen && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field">
                    <label className="form-label">Daily OT After (hours)</label>
                    <AppInput type="number" min="0" step="0.5" value={form.dailyOvertimeAfterHours} onChange={(e) => f("dailyOvertimeAfterHours", e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Weekly OT After (hours)</label>
                    <AppInput type="number" min="0" step="0.5" value={form.weeklyOvertimeAfterHours} onChange={(e) => f("weeklyOvertimeAfterHours", e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Overtime Multiplier</label>
                    <AppInput type="number" min="1" step="0.1" value={form.overtimeMultiplier} onChange={(e) => f("overtimeMultiplier", e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Comp-Off Expiry (days)</label>
                    <AppInput type="number" min="0" step="1" value={form.compOffExpiryDays} onChange={(e) => f("compOffExpiryDays", e.target.value)} />
                  </div>
                  <div className="form-field col-span-2">
                    <label className="flex items-center gap-2 h-[38px] cursor-pointer text-[0.825rem] text-text-secondary">
                      <AppCheckbox checked={form.compOffEnabled} onChange={(e) => f("compOffEnabled", e.target.checked)} />
                      Enable comp-off accrual
                    </label>
                  </div>
                  <div className="col-span-2 text-[0.75rem] text-text-tertiary leading-5">
                    {overtimePreview}
                  </div>
                </div>
              </div>
            )}
          </div>
        </AppDrawer>

      <AppModal
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        body="Users assigned to this policy will lose their schedule. This action cannot be undone."
        onConfirm={() => deleteTarget && void doDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="page-header">
        <div>
          <div className="page-title">Work Policy Management</div>
          <div className="page-subtitle">Define daily expected hours for different employee types</div>
        </div>
        <div className="page-actions">
          <AppButton variant="outline" onClick={() => void load()}>Refresh</AppButton>
          <AppButton variant="primary" onClick={openCreate}>+ New Policy</AppButton>
        </div>
      </div>

      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Work Policies
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
          emptyText="No work policies. Click &quot;+ New Policy&quot; to create one."
          loading={loading}
        />
      </div>

      <div className="card bg-n-50 border border-border-subtle">
        <div className="card-body px-5 py-4">
          <p className="text-[0.825rem] text-text-secondary m-0 leading-[1.6]">
            <strong className="text-text-primary">How it works:</strong> Each employee is assigned a Work Policy in the{" "}
            <strong className="text-brand-600">Users</strong> admin page.
            The policy defines their daily expected hours, which determines the weekly target shown in the Timesheet.
            Create separate policies for consultants (2h), part-time (4h), and full-time employees (8h).
          </p>
        </div>
      </div>
    </section>
  );
}
