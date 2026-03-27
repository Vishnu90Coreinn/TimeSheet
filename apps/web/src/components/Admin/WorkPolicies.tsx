/**
 * WorkPolicies.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { WorkPolicy } from "../../types";

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
type SortDir = "asc" | "desc";

const FALLBACK_OVERTIME = {
  dailyOvertimeAfterHours: 8,
  weeklyOvertimeAfterHours: 40,
  overtimeMultiplier: 1.5,
  compOffEnabled: false,
  compOffExpiryDays: 90,
};

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

export function WorkPolicies() {
  const [policies, setPolicies] = useState<WorkPolicy[]>([]);
  const [editing, setEditing] = useState<WorkPolicy | "new" | null>(null);
  const [form, setForm] = useState<PolicyForm>(BLANK);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkPolicy | null>(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "dailyExpectedMinutes" | "isActive">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [overtimeRulesOpen, setOvertimeRulesOpen] = useState(true);

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  async function load() {
    const r = await apiFetch("/masters/work-policies");
    if (r.ok) setPolicies(await r.json());
  }

  useEffect(() => { void load(); }, []);

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
    setError(""); setEditing(p);
    setOvertimeRulesOpen(true);
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
    <section className="flex flex-col gap-6">
      {/* Drawer */}
      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => void save()}>Save Policy</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </>
        }
      >
        {error && <p className="text-danger text-[0.825rem] m-0">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-field col-span-2">
              <label className="form-label">Policy Name <span className="required">*</span></label>
              <input className="input-field" placeholder="e.g. Standard 8h, Consultant 2h" value={form.name} onChange={(e) => f("name", e.target.value)} />
            </div>
          <div className="form-field">
            <label className="form-label">Daily Hours <span className="required">*</span></label>
            <input className="input-field" type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 8" value={form.dailyHours} onChange={(e) => f("dailyHours", e.target.value)} />
            {weeklyPreview && <div className="text-[0.75rem] text-text-tertiary mt-1">{weeklyPreview}</div>}
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
              <label className="flex items-center gap-2 h-[38px] cursor-pointer text-[0.825rem] text-text-secondary">
                <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} className="[accent-color:var(--brand-600)]" />
                Active
              </label>
            </div>
          </div>
          <div className="mt-4 border border-border-subtle rounded-xl bg-n-50 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => setOvertimeRulesOpen((open) => !open)}
            >
              <div>
                <div className="text-[0.85rem] font-semibold text-text-primary">Overtime Rules</div>
                <div className="text-[0.75rem] text-text-tertiary mt-0.5">Set daily and weekly thresholds plus comp-off handling</div>
              </div>
              <span className="text-text-tertiary text-[0.9rem]">{overtimeRulesOpen ? "−" : "+"}</span>
            </button>
            {overtimeRulesOpen && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field">
                    <label className="form-label">Daily OT After (hours)</label>
                    <input className="input-field" type="number" min="0" step="0.5" value={form.dailyOvertimeAfterHours} onChange={(e) => f("dailyOvertimeAfterHours", e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Weekly OT After (hours)</label>
                    <input className="input-field" type="number" min="0" step="0.5" value={form.weeklyOvertimeAfterHours} onChange={(e) => f("weeklyOvertimeAfterHours", e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Overtime Multiplier</label>
                    <input className="input-field" type="number" min="1" step="0.1" value={form.overtimeMultiplier} onChange={(e) => f("overtimeMultiplier", e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Comp-Off Expiry (days)</label>
                    <input className="input-field" type="number" min="0" step="1" value={form.compOffExpiryDays} onChange={(e) => f("compOffExpiryDays", e.target.value)} />
                  </div>
                  <div className="form-field col-span-2">
                    <label className="flex items-center gap-2 h-[38px] cursor-pointer text-[0.825rem] text-text-secondary">
                      <input type="checkbox" checked={form.compOffEnabled} onChange={(e) => f("compOffEnabled", e.target.checked)} className="[accent-color:var(--brand-600)]" />
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
      <div className="card overflow-visible">
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
                <th className="th-sort w-[130px]" onClick={() => toggleSort("dailyExpectedMinutes")} aria-sort={sortCol === "dailyExpectedMinutes" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Daily Hours <SortIcon active={sortCol === "dailyExpectedMinutes"} dir={sortDir} />
                </th>
                <th className="w-[160px]">Weekly Target</th>
                <th className="th-sort w-[100px]" onClick={() => toggleSort("isActive")} aria-sort={sortCol === "isActive" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  Status <SortIcon active={sortCol === "isActive"} dir={sortDir} />
                </th>
                <th className="w-[100px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr className="empty-row"><td colSpan={5}>{search ? "No policies match your search." : "No work policies. Click \"+ New Policy\" to create one."}</td></tr>
              )}
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="btn-table-link text-left" onClick={() => openEdit(p)}>{p.name}</button>
                    <div className="text-[0.75rem] text-text-tertiary mt-1 leading-5">{formatOvertimeSummary(p)}</div>
                  </td>
                  <td>{(p.dailyExpectedMinutes / 60).toFixed(1)}h / day</td>
                  <td>
                    <span>{((p.dailyExpectedMinutes / 60) * (p.workDaysPerWeek ?? 5)).toFixed(0)}h / week</span>
                    <span className="text-text-tertiary text-[0.75rem] ml-1">({p.workDaysPerWeek === 6 ? "Mon–Sat" : "Mon–Fri"})</span>
                  </td>
                  <td>
                    <span className={`badge ${p.isActive ? "badge-success" : "badge-neutral"}`}>{p.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="text-right">
                    <div className="flex gap-2 justify-end">
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
