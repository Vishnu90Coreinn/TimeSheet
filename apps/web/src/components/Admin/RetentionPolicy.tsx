import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { AppButton, AppInput, AppTableShell } from "../ui";

interface PolicyItem {
  dataType: string;
  retentionDays: number;
}

const LABELS: Record<string, { label: string; hint: string }> = {
  timesheets: { label: "Timesheets", hint: "Timesheet entries and submissions (default 7 years)" },
  auditlogs: { label: "Audit Logs", hint: "User action audit trail (default 1 year)" },
  notifications: { label: "Notifications", hint: "In-app notification records (default 90 days)" },
  sessions: { label: "Work Sessions", hint: "Clock-in/out session records (default 180 days)" },
};

function toYears(days: number): string {
  return `${(days / 365).toFixed(1)}y`;
}

export function RetentionPolicy() {
  const toast = useToast();
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [initialPolicies, setInitialPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/admin/retention-policy")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { policies: PolicyItem[] } | null) => {
        if (!data) return;
        setPolicies(data.policies);
        setInitialPolicies(data.policies);
      })
      .finally(() => setLoading(false));
  }, []);

  function setDays(dataType: string, days: number) {
    setPolicies((prev) => prev.map((p) => (p.dataType === dataType ? { ...p, retentionDays: days } : p)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await apiFetch("/admin/retention-policy", {
      method: "PUT",
      body: JSON.stringify(policies),
    });
    if (r.ok) {
      setInitialPolicies(policies);
      toast.success("Retention policies saved");
    } else {
      toast.error("Failed to save retention policies");
    }
    setSaving(false);
  }

  const isDirty = useMemo(() => JSON.stringify(policies) !== JSON.stringify(initialPolicies), [policies, initialPolicies]);

  if (loading) {
    return (
      <section>
        <div className="skeleton w-48 h-6 rounded mb-4" />
        <div className="skeleton w-full h-48 rounded-lg" />
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Retention</h1>
          <p className="page-subtitle">Configure how long each data category is kept before automatic cleanup.</p>
        </div>
        <div className="text-[0.75rem] text-text-tertiary">Changes apply to future cleanup cycles.</div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="card overflow-hidden max-w-4xl">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            Retention Policies
            <span className="mgmt-count-pill">{policies.length} items</span>
          </div>
        </div>
        <AppTableShell>
          <table className="table-base mgmt-table w-full">
            <thead>
              <tr>
                <th>Data Type</th>
                <th className="w-[180px]">Retention (days)</th>
                <th className="w-[120px]">Years</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => {
                const meta = LABELS[policy.dataType] ?? { label: policy.dataType, hint: "" };
                return (
                  <tr key={policy.dataType}>
                    <td>
                      <div className="font-semibold text-text-primary">{meta.label}</div>
                      <div className="text-[0.75rem] text-text-tertiary mt-[2px]">{meta.hint}</div>
                    </td>
                    <td>
                      <AppInput
                        type="number"
                        min={1}
                        max={9999}
                        className="w-[120px] text-right"
                        value={policy.retentionDays}
                        onChange={(e) => setDays(policy.dataType, Math.max(1, parseInt(e.target.value, 10) || 1))}
                      />
                    </td>
                    <td className="text-[0.8rem] text-text-secondary">{toYears(policy.retentionDays)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AppTableShell>
        <div className="mgmt-card-foot">
          <span className="text-[0.75rem] text-text-tertiary">
            {isDirty ? "You have unsaved changes." : "All changes saved."}
          </span>
          <div className="flex items-center gap-2">
            <AppButton
              type="button"
              variant="outline"
              size="sm"
              disabled={!isDirty || saving}
              onClick={() => setPolicies(initialPolicies)}
            >
              Reset
            </AppButton>
            <AppButton type="submit" variant="primary" size="sm" disabled={!isDirty || saving}>
              {saving ? "Saving..." : "Save policies"}
            </AppButton>
          </div>
        </div>
      </form>
    </section>
  );
}
