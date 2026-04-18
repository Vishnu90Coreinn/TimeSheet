/**
 * PasswordPolicy.tsx — Admin password policy configuration
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { AppButton, AppInput } from "../ui";
import { ToggleSwitch } from "./AdminUI";
import { useToast } from "../../contexts/ToastContext";

interface Policy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  maxAgeDays: number;
}

const DEFAULT: Policy = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSpecialChar: false,
  maxAgeDays: 0,
};

export function PasswordPolicy() {
  const toast = useToast();
  const [policy, setPolicy] = useState<Policy>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/password-policy").then(async r => {
      if (r.ok) setPolicy(await r.json() as Policy);
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const r = await apiFetch("/password-policy", { method: "PUT", body: JSON.stringify(policy) });
    if (r.ok || r.status === 204) {
      toast.success("Policy saved", "Password policy has been updated.");
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      toast.error("Save failed", d.message ?? "Failed to save policy.");
    }
    setSaving(false);
  }

  const p = (k: keyof Policy, v: boolean | number) => setPolicy(prev => ({ ...prev, [k]: v }));

  function previewHints(): string[] {
    const hints: string[] = [];
    hints.push(`At least ${policy.minLength} character${policy.minLength !== 1 ? "s" : ""}`);
    if (policy.requireUppercase) hints.push("At least one uppercase letter (A–Z)");
    if (policy.requireLowercase) hints.push("At least one lowercase letter (a–z)");
    if (policy.requireNumber) hints.push("At least one number (0–9)");
    if (policy.requireSpecialChar) hints.push("At least one special character (!@#$%...)");
    if (policy.maxAgeDays > 0) hints.push(`Password expires every ${policy.maxAgeDays} day${policy.maxAgeDays !== 1 ? "s" : ""}`);
    else hints.push("Passwords never expire");
    return hints;
  }

  if (loading) return <div className="p-8 text-text-tertiary">Loading…</div>;

  return (
    <section className="flex flex-col gap-6">
      <div className="page-header">
        <div>
          <div className="page-title">Password Policy</div>
          <div className="page-subtitle">Rules applied to all user passwords</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Policy form card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Policy Settings</div>
          </div>
          <div className="p-6 flex flex-col gap-5">

            {/* Min length */}
            <div className="form-field">
              <label className="form-label" htmlFor="pp-minlen">Minimum password length</label>
              <AppInput
                id="pp-minlen"
                type="number"
                className="input-field"
                style={{ width: 100 }}
                min={1}
                max={128}
                value={String(policy.minLength)}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n) && n >= 1 && n <= 128) p("minLength", n);
                }}
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[0.85rem] font-medium text-text-primary">Require uppercase letter</div>
                  <div className="text-[0.75rem] text-text-tertiary">At least one A–Z</div>
                </div>
                <ToggleSwitch checked={policy.requireUppercase} onChange={v => p("requireUppercase", v)} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[0.85rem] font-medium text-text-primary">Require lowercase letter</div>
                  <div className="text-[0.75rem] text-text-tertiary">At least one a–z</div>
                </div>
                <ToggleSwitch checked={policy.requireLowercase} onChange={v => p("requireLowercase", v)} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[0.85rem] font-medium text-text-primary">Require number</div>
                  <div className="text-[0.75rem] text-text-tertiary">At least one 0–9</div>
                </div>
                <ToggleSwitch checked={policy.requireNumber} onChange={v => p("requireNumber", v)} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[0.85rem] font-medium text-text-primary">Require special character</div>
                  <div className="text-[0.75rem] text-text-tertiary">At least one !@#$%^&amp;* etc.</div>
                </div>
                <ToggleSwitch checked={policy.requireSpecialChar} onChange={v => p("requireSpecialChar", v)} />
              </div>
            </div>

            {/* Max age */}
            <div className="form-field">
              <label className="form-label" htmlFor="pp-maxage">Maximum password age (days)</label>
              <AppInput
                id="pp-maxage"
                type="number"
                className="input-field"
                style={{ width: 100 }}
                min={0}
                max={365}
                value={String(policy.maxAgeDays)}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n) && n >= 0 && n <= 365) p("maxAgeDays", n);
                }}
              />
              <div className="text-[0.72rem] text-text-tertiary mt-[3px]">0 = passwords never expire</div>
            </div>

            <AppButton variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save Policy"}
            </AppButton>
          </div>
        </div>

        {/* Preview card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Policy Preview</div>
            <div className="card-subtitle">As shown to users during password reset</div>
          </div>
          <div className="p-6">
            <div className="text-[0.82rem] text-text-secondary mb-3">Passwords must meet these requirements:</div>
            <ul className="flex flex-col gap-2">
              {previewHints().map(h => (
                <li key={h} className="flex items-center gap-2 text-[0.85rem] text-text-primary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--brand-500)", flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
