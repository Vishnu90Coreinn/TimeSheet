/**
 * WorkPolicies.tsx — Admin page to manage work schedule policies.
 * Allows creating / editing policies that define daily expected hours per user type
 * (e.g. "Standard 8h", "Consultant 2h", "Part-time 4h").
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { WorkPolicy } from "../../types";

type PolicyForm = { name: string; dailyHours: string; isActive: boolean };
const BLANK: PolicyForm = { name: "", dailyHours: "8", isActive: true };

export function WorkPolicies() {
  const [policies, setPolicies] = useState<WorkPolicy[]>([]);
  const [editing, setEditing] = useState<WorkPolicy | "new" | null>(null);
  const [form, setForm] = useState<PolicyForm>(BLANK);
  const [error, setError] = useState("");

  async function load() {
    const r = await apiFetch("/masters/work-policies");
    if (r.ok) setPolicies(await r.json());
  }

  useEffect(() => { void load(); }, []);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }
  function openEdit(p: WorkPolicy) {
    setForm({ name: p.name, dailyHours: String(p.dailyExpectedMinutes / 60), isActive: p.isActive });
    setError(""); setEditing(p);
  }

  async function save() {
    setError("");
    const hours = parseFloat(form.dailyHours);
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (isNaN(hours) || hours <= 0 || hours > 24) { setError("Enter a valid daily hours (e.g. 2, 4, 8)."); return; }
    const body = { id: editing === "new" ? "00000000-0000-0000-0000-000000000000" : (editing as WorkPolicy).id, name: form.name.trim(), dailyExpectedMinutes: Math.round(hours * 60), isActive: form.isActive };
    const r = editing === "new"
      ? await apiFetch("/masters/work-policies", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/masters/work-policies/${(editing as WorkPolicy).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed."); }
  }

  async function remove(p: WorkPolicy) {
    if (!confirm(`Delete "${p.name}"? Users assigned to this policy will lose their schedule.`)) return;
    await apiFetch(`/masters/work-policies/${p.id}`, { method: "DELETE" });
    void load();
  }

  const f = (k: keyof PolicyForm, v: string | boolean) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div className="page-header">
        <div>
          <div className="page-title">Work Policies</div>
          <div className="page-subtitle">Define daily expected hours for different employee types (consultants, full-time, part-time)</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Policy</button>
        </div>
      </div>

      {editing && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">{editing === "new" ? "New Work Policy" : `Edit — ${(editing as WorkPolicy).name}`}</div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 12, alignItems: "end" }}>
              <div className="form-field">
                <label className="form-label">Policy Name</label>
                <input className="input-field" placeholder="e.g. Standard 8h, Consultant 2h" value={form.name} onChange={(e) => f("name", e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Daily Hours</label>
                <input className="input-field" type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 8" value={form.dailyHours} onChange={(e) => f("dailyHours", e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Active</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Active</span>
                </label>
              </div>
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => void save()}>Save Policy</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid var(--border-subtle)" }}>
              <th style={TH}>Policy Name</th>
              <th style={TH}>Daily Hours</th>
              <th style={TH}>Weekly Target</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-tertiary)", fontSize: 13 }}>No work policies. Click "+ New Policy" to create one.</td></tr>
            )}
            {policies.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={TD}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span></td>
                <td style={TD}>{(p.dailyExpectedMinutes / 60).toFixed(1)}h / day</td>
                <td style={TD}>{((p.dailyExpectedMinutes / 60) * 6).toFixed(0)}h / week <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>(Mon–Sat)</span></td>
                <td style={TD}>
                  <span className={`badge ${p.isActive ? "badge-success" : "badge-neutral"}`}>{p.isActive ? "Active" : "Inactive"}</span>
                </td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "#ef4444" }} onClick={() => void remove(p)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ background: "var(--n-50, #f9fafb)", border: "1px solid var(--border-subtle)" }}>
        <div className="card-body">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            <strong>How it works:</strong> Each employee is assigned a Work Policy in the Users admin page.
            The policy defines their daily expected hours, which determines the weekly target shown in the Timesheet.
            Create separate policies for consultants (2h), part-time (4h), and full-time employees (8h).
          </p>
        </div>
      </div>
    </section>
  );
}

const TH: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)" };
const TD: React.CSSProperties = { padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" };
