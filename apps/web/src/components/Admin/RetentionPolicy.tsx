/**
 * RetentionPolicy.tsx — Admin page to configure data retention periods.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";

interface PolicyItem {
  dataType: string;
  retentionDays: number;
}

const LABELS: Record<string, { label: string; hint: string }> = {
  timesheets:    { label: "Timesheets",      hint: "Timesheet entries and submissions (default 7 years)" },
  auditlogs:     { label: "Audit Logs",      hint: "User action audit trail (default 1 year)" },
  notifications: { label: "Notifications",   hint: "In-app notification records (default 90 days)" },
  sessions:      { label: "Work Sessions",   hint: "Clock-in/out session records (default 180 days)" },
};

export function RetentionPolicy() {
  const toast = useToast();
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/admin/retention-policy")
      .then(r => r.ok ? r.json() : null)
      .then((data: { policies: PolicyItem[] } | null) => {
        if (data) setPolicies(data.policies);
      })
      .finally(() => setLoading(false));
  }, []);

  function setDays(dataType: string, days: number) {
    setPolicies(prev => prev.map(p => p.dataType === dataType ? { ...p, retentionDays: days } : p));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await apiFetch("/admin/retention-policy", {
      method: "PUT",
      body: JSON.stringify(policies),
    });
    if (r.ok) {
      toast.success("Retention policies saved");
    } else {
      toast.error("Failed to save retention policies");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="skeleton w-48 h-6 rounded mb-4" />
        <div className="skeleton w-full h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Data Retention</h1>
        <p className="page-subtitle">Configure how long each type of data is kept before automatic deletion</p>
      </div>

      <form onSubmit={e => void handleSave(e)} className="card p-6 max-w-2xl">
        <div className="flex flex-col gap-5">
          {policies.map(policy => {
            const meta = LABELS[policy.dataType] ?? { label: policy.dataType, hint: "" };
            const years = (policy.retentionDays / 365).toFixed(1);
            return (
              <div key={policy.dataType} className="flex items-start justify-between gap-6 py-3 border-b border-border-subtle last:border-0">
                <div className="min-w-0">
                  <div className="text-[0.85rem] font-semibold text-text-primary">{meta.label}</div>
                  <div className="text-[0.75rem] text-text-tertiary mt-[2px]">{meta.hint}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    className="form-input w-24 text-right"
                    value={policy.retentionDays}
                    onChange={e => setDays(policy.dataType, Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span className="text-[0.8rem] text-text-tertiary w-16">
                    days <span className="text-text-disabled">({years}y)</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save policies"}
          </button>
        </div>
      </form>
    </div>
  );
}
