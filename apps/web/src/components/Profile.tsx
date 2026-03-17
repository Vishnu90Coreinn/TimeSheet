/**
 * Profile.tsx — Self-service profile page (Sprint 13)
 * All roles. Accessible from topbar avatar.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { MyProfile, NotificationPreferences } from "../types";

function pwdStrength(pwd: string): "weak" | "medium" | "strong" | null {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return "weak";
  if (score <= 2) return "medium";
  return "strong";
}

const STRENGTH_COLOR = { weak: "var(--danger)", medium: "var(--warning)", strong: "var(--success)" };

export function Profile({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  // Profile edit state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // Notification prefs state
  const [prefsMsg, setPrefsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    apiFetch("/profile").then(async r => { if (r.ok) { const d = await r.json() as MyProfile; setProfile(d); setUsername(d.username); setEmail(d.email); } });
    apiFetch("/profile/notification-preferences").then(async r => { if (r.ok) setPrefs(await r.json() as NotificationPreferences); });
  }, []);

  async function saveProfile() {
    setSavingProfile(true); setProfileMsg(null);
    const r = await apiFetch("/profile", { method: "PUT", body: JSON.stringify({ username, email }) });
    if (r.ok || r.status === 204) {
      setProfile(p => p ? { ...p, username, email } : p);
      setProfileMsg({ ok: true, text: "Profile updated." });
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      setProfileMsg({ ok: false, text: d.message ?? "Save failed." });
    }
    setSavingProfile(false);
  }

  async function changePassword() {
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: "Passwords do not match." }); return; }
    setSavingPwd(true); setPwdMsg(null);
    const r = await apiFetch("/profile/password", { method: "PUT", body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
    if (r.ok || r.status === 204) {
      setPwdMsg({ ok: true, text: "Password changed successfully." });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      setPwdMsg({ ok: false, text: d.message ?? "Change failed." });
    }
    setSavingPwd(false);
  }

  async function savePrefs(updated: NotificationPreferences) {
    setPrefs(updated); setSavingPrefs(true); setPrefsMsg(null);
    const r = await apiFetch("/profile/notification-preferences", { method: "PUT", body: JSON.stringify(updated) });
    setPrefsMsg(r.ok || r.status === 204 ? { ok: true, text: "Preferences saved." } : { ok: false, text: "Save failed." });
    setSavingPrefs(false);
  }

  if (!profile || !prefs) {
    return <div className="page-content" style={{ padding: "var(--space-8)" }}><span style={{ color: "var(--text-tertiary)" }}>Loading…</span></div>;
  }

  const strength = pwdStrength(newPwd);
  const avatarBg = "linear-gradient(135deg, var(--brand-500), var(--brand-700))";
  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">My Profile</div>
          <div className="page-subtitle">Manage your account details and preferences</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)", alignItems: "start" }}>

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

          {/* Identity card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Account Details</div>
            </div>
            <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              {/* Avatar row */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                <div style={{ width: 56, height: 56, borderRadius: "var(--r-lg)", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{profile.username}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textTransform: "capitalize" }}>{profile.role}</div>
                </div>
              </div>

              {/* Editable fields */}
              <div style={{ display: "grid", gap: "var(--space-4)" }}>
                <div className="form-field">
                  <label className="form-label">Username</label>
                  <input className="input-field" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-label">Email</label>
                  <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              {profileMsg && (
                <div className={`alert ${profileMsg.ok ? "alert-success" : "alert-error"}`}>{profileMsg.text}</div>
              )}
              <button className="btn btn-primary" onClick={() => void saveProfile()} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save Changes"}
              </button>

              {/* Read-only org info */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                {[
                  ["Employee ID", profile.employeeId || "—"],
                  ["Department", profile.departmentName ?? "—"],
                  ["Work Policy", profile.workPolicyName ?? "—"],
                  ["Leave Policy", profile.leavePolicyName ?? "—"],
                  ["Manager", profile.managerUsername ?? "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Password card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Change Password</div>
            </div>
            <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div className="form-field">
                <label className="form-label">Current Password</label>
                <input className="input-field" type={showPwd ? "text" : "password"} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">New Password</label>
                <input className="input-field" type={showPwd ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                {strength && (
                  <>
                    <div className={`pwd-strength-bar pwd-strength-bar--${strength}`} />
                    <div style={{ fontSize: "0.72rem", color: STRENGTH_COLOR[strength], marginTop: 2 }}>{strength.charAt(0).toUpperCase() + strength.slice(1)} password</div>
                  </>
                )}
              </div>
              <div className="form-field">
                <label className="form-label">Confirm New Password</label>
                <input className="input-field" type={showPwd ? "text" : "password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
                {confirmPwd && newPwd !== confirmPwd && (
                  <div style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: 2 }}>Passwords do not match</div>
                )}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} style={{ accentColor: "var(--brand-600)" }} />
                Show passwords
              </label>
              {pwdMsg && <div className={`alert ${pwdMsg.ok ? "alert-success" : "alert-error"}`}>{pwdMsg.text}</div>}
              <button
                className="btn btn-primary"
                onClick={() => void changePassword()}
                disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd}
              >
                {savingPwd ? "Changing…" : "Change Password"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Notification Preferences</div>
              <div className="card-subtitle">Choose which notifications you receive in-app</div>
            </div>
          </div>
          <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

            {/* Channels */}
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Channels</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <ToggleRow
                  label="In-app notifications"
                  sub="Bell icon in the top navigation"
                  checked={prefs.inAppEnabled}
                  onChange={v => void savePrefs({ ...prefs, inAppEnabled: v })}
                />
                <ToggleRow
                  label="Email notifications"
                  sub="Sent to your registered email address"
                  checked={prefs.emailEnabled}
                  onChange={v => void savePrefs({ ...prefs, emailEnabled: v })}
                />
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

            {/* Notification types */}
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Notification Types</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <ToggleRow
                  label="Timesheet approved"
                  sub="When a manager approves your timesheet"
                  checked={prefs.onApproval}
                  onChange={v => void savePrefs({ ...prefs, onApproval: v })}
                />
                <ToggleRow
                  label="Timesheet rejected"
                  sub="When a manager rejects or pushes back"
                  checked={prefs.onRejection}
                  onChange={v => void savePrefs({ ...prefs, onRejection: v })}
                />
                <ToggleRow
                  label="Leave status updates"
                  sub="When your leave request is approved or rejected"
                  checked={prefs.onLeaveStatus}
                  onChange={v => void savePrefs({ ...prefs, onLeaveStatus: v })}
                />
                <ToggleRow
                  label="Reminders"
                  sub="Missing timesheet, missing check-out, pending approval alerts"
                  checked={prefs.onReminder}
                  onChange={v => void savePrefs({ ...prefs, onReminder: v })}
                />
              </div>
            </div>

            {prefsMsg && (
              <div className={`alert ${prefsMsg.ok ? "alert-success" : "alert-error"}`} style={{ marginTop: "var(--space-2)" }}>
                {savingPrefs ? "Saving…" : prefsMsg.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", cursor: "pointer", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)", background: checked ? "var(--brand-50)" : "var(--n-50)" }}>
      <div>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{
        width: 40, height: 22, borderRadius: 11, background: checked ? "var(--brand-500)" : "var(--n-300)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", margin: 0 }} />
      </div>
    </label>
  );
}
