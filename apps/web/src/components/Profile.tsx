/**
 * Profile.tsx — Self-service profile page (Sprint 13, UX v2)
 * All roles. Accessible from topbar avatar.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, EyeOff, Lock, Camera } from "lucide-react";
import { apiFetch } from "../api/client";
import type { MyProfile, NotificationPreferences } from "../types";

// ── Template types ─────────────────────────────────────────────────────────────
interface TemplateEntryRow { projectId: string; categoryId: string; minutes: number; note: string; }
interface TemplateItem { id: string; name: string; createdAtUtc: string; entries: { projectId: string; categoryId: string; minutes: number; note: string | null }[]; }
interface EntryOption { id: string; name: string; }
interface EntryOptions { projects: EntryOption[]; taskCategories: EntryOption[]; }

// ── Toast system ─────────────────────────────────────────────────────────────

type Toast = { id: number; ok: boolean; text: string };
let _toastSeq = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((ok: boolean, text: string) => {
    const id = ++_toastSeq;
    setToasts(prev => [...prev, { id, ok, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  return { toasts, show };
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: "var(--space-6)", right: "var(--space-6)",
      display: "flex", flexDirection: "column", gap: "var(--space-2)",
      zIndex: 9999, pointerEvents: "none",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: "var(--space-3) var(--space-5)",
          borderRadius: "var(--r-md)",
          background: t.ok ? "var(--success)" : "var(--danger)",
          color: "#fff",
          fontSize: "0.85rem",
          fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          animation: "page-enter var(--transition-base) both",
        }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── Password strength ─────────────────────────────────────────────────────────

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

// ── Eye-icon password field ───────────────────────────────────────────────────

function PwdField({
  label, value, onChange, onBlur, error, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <div style={{ position: "relative" }}>
        <input
          className={`input-field${error ? " error" : ""}`}
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{ paddingRight: "2.5rem" }}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-tertiary)", padding: 0, display: "flex",
          }}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <div style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: 2 }}>{error}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Profile({ onBack }: { onBack: () => void }) {
  const { toasts, show: showToast } = useToast();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  // Profile edit state
  const [username, setUsername]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail]             = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Touched states for inline validation
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [touchedEmail, setTouchedEmail]       = useState(false);

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Password state
  const [currentPwd, setCurrentPwd]   = useState("");
  const [newPwd, setNewPwd]           = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [savingPwd, setSavingPwd]     = useState(false);

  // Notification prefs
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [entryOptions, setEntryOptions] = useState<EntryOptions | null>(null);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateRows, setNewTemplateRows] = useState<TemplateEntryRow[]>([
    { projectId: "", categoryId: "", minutes: 60, note: "" },
  ]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/profile").then(async r => {
      if (r.ok) {
        const d = await r.json() as MyProfile;
        setProfile(d);
        setUsername(d.username);
        setDisplayName(d.displayName ?? "");
        setEmail(d.email);
      }
    });
    apiFetch("/profile/notification-preferences").then(async r => {
      if (r.ok) setPrefs(await r.json() as NotificationPreferences);
    });
    apiFetch("/timesheets/templates").then(async r => {
      if (r.ok) setTemplates(await r.json() as TemplateItem[]);
    });
    apiFetch("/timesheets/entry-options").then(async r => {
      if (r.ok) setEntryOptions(await r.json() as EntryOptions);
    });
  }, []);

  // ── Profile save ────────────────────────────────────────────────────────────

  async function saveProfile() {
    setTouchedUsername(true); setTouchedEmail(true);
    if (!username.trim() || !email.trim()) return;
    setSavingProfile(true);
    const r = await apiFetch("/profile", {
      method: "PUT",
      body: JSON.stringify({ username: username.trim(), displayName: displayName.trim(), email: email.trim() }),
    });
    if (r.ok || r.status === 204) {
      setProfile(p => p ? { ...p, username: username.trim(), displayName: displayName.trim(), email: email.trim() } : p);
      showToast(true, "Profile updated successfully.");
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      showToast(false, d.message ?? "Failed to save profile.");
    }
    setSavingProfile(false);
  }

  // ── Avatar upload ───────────────────────────────────────────────────────────

  async function handleAvatarFile(file: File) {
    if (!file.type.startsWith("image/")) { showToast(false, "Please select an image file."); return; }
    if (file.size > 400_000) { showToast(false, "Image must be smaller than 400 KB."); return; }
    setSavingAvatar(true);
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target?.result as string;
      const r = await apiFetch("/profile/avatar", { method: "PUT", body: JSON.stringify({ avatarDataUrl: dataUrl }) });
      if (r.ok || r.status === 204) {
        setProfile(p => p ? { ...p, avatarDataUrl: dataUrl } : p);
        showToast(true, "Avatar updated.");
      } else {
        showToast(false, "Failed to update avatar.");
      }
      setSavingAvatar(false);
    };
    reader.readAsDataURL(file);
  }

  async function removeAvatar() {
    setSavingAvatar(true);
    const r = await apiFetch("/profile/avatar", { method: "PUT", body: JSON.stringify({ avatarDataUrl: null }) });
    if (r.ok || r.status === 204) {
      setProfile(p => p ? { ...p, avatarDataUrl: null } : p);
      showToast(true, "Avatar removed.");
    } else {
      showToast(false, "Failed to remove avatar.");
    }
    setSavingAvatar(false);
  }

  // ── Password change ─────────────────────────────────────────────────────────

  async function changePassword() {
    setTouchedConfirm(true);
    if (newPwd !== confirmPwd || !currentPwd || !newPwd) return;
    setSavingPwd(true);
    const r = await apiFetch("/profile/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
    });
    if (r.ok || r.status === 204) {
      showToast(true, "Password changed successfully.");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setTouchedConfirm(false);
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      showToast(false, d.message ?? "Password change failed.");
    }
    setSavingPwd(false);
  }

  // ── Notification prefs ──────────────────────────────────────────────────────

  async function savePrefs(updated: NotificationPreferences) {
    setPrefs(updated);
    setSavingPrefs(true);
    const r = await apiFetch("/profile/notification-preferences", { method: "PUT", body: JSON.stringify(updated) });
    if (r.ok || r.status === 204) showToast(true, "Preferences saved.");
    else showToast(false, "Failed to save preferences.");
    setSavingPrefs(false);
  }

  // ── Template actions ─────────────────────────────────────────────────────────

  async function saveNewTemplate() {
    if (!newTemplateName.trim()) return;
    const validRows = newTemplateRows.filter(r => r.projectId && r.categoryId && r.minutes > 0);
    if (validRows.length === 0) return;
    setSavingTemplate(true);
    const r = await apiFetch("/timesheets/templates", {
      method: "POST",
      body: JSON.stringify({
        name: newTemplateName.trim(),
        entries: validRows.map(row => ({
          projectId: row.projectId,
          categoryId: row.categoryId,
          minutes: row.minutes,
          note: row.note.trim() || null,
        })),
      }),
    });
    setSavingTemplate(false);
    if (r.ok) {
      const created = await r.json() as TemplateItem;
      setTemplates(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowNewTemplateForm(false);
      setNewTemplateName("");
      setNewTemplateRows([{ projectId: "", categoryId: "", minutes: 60, note: "" }]);
      showToast(true, "Template saved.");
    } else {
      const d = await r.json().catch(() => ({})) as { message?: string };
      showToast(false, d.message ?? "Failed to save template.");
    }
  }

  async function deleteTemplate(id: string) {
    setDeletingTemplateId(id);
    const r = await apiFetch(`/timesheets/templates/${id}`, { method: "DELETE" });
    setDeletingTemplateId(null);
    setConfirmDeleteTemplateId(null);
    if (r.ok || r.status === 204) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      showToast(true, "Template deleted.");
    } else {
      showToast(false, "Failed to delete template.");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!profile || !prefs) {
    return (
      <div style={{ padding: "var(--space-8)", color: "var(--text-tertiary)" }}>Loading…</div>
    );
  }

  const initials      = (profile.displayName || profile.username).slice(0, 2).toUpperCase();
  const strength      = pwdStrength(newPwd);
  const usernameError = touchedUsername && !username.trim() ? "Username is required" : undefined;
  const emailError    = touchedEmail && !email.trim() ? "Email is required" : undefined;
  const confirmError  = touchedConfirm && newPwd !== confirmPwd ? "Passwords do not match" : undefined;
  const pwdDisabled   = savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd;

  return (
    <>
      <ToastStack toasts={toasts} />

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

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "var(--space-6)", alignItems: "start" }}>

          {/* ── Left: Account Details + Password ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

            {/* Account Details card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Account Details</div>
              </div>
              <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

                {/* Avatar */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {/* Avatar circle */}
                    <div style={{
                      width: 72, height: 72, borderRadius: "var(--r-lg)",
                      background: profile.avatarDataUrl
                        ? undefined
                        : "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
                      backgroundImage: profile.avatarDataUrl ? `url(${profile.avatarDataUrl})` : undefined,
                      backgroundSize: "cover", backgroundPosition: "center",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.4rem", fontWeight: 700, color: "#fff",
                      border: "2px solid var(--border-subtle)",
                      overflow: "hidden",
                    }}>
                      {!profile.avatarDataUrl && initials}
                    </div>
                    {/* Camera overlay button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={savingAvatar}
                      style={{
                        position: "absolute", inset: 0, borderRadius: "var(--r-lg)",
                        background: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 0, transition: "opacity 0.15s",
                        color: "#fff",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                      aria-label="Upload avatar"
                      title="Upload avatar"
                    >
                      <Camera size={20} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) void handleAvatarFile(f); e.target.value = ""; }}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {profile.displayName || profile.username}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textTransform: "capitalize" }}>{profile.role}</div>
                    {profile.avatarDataUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ marginTop: "var(--space-2)", padding: "2px 8px", fontSize: "0.72rem" }}
                        onClick={() => void removeAvatar()}
                        disabled={savingAvatar}
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Editable fields */}
                <div style={{ display: "grid", gap: "var(--space-4)" }}>
                  <div className="form-field">
                    <label className="form-label">Display Name</label>
                    <input
                      className="input-field"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="How your name appears to others"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Username <span style={{ color: "var(--danger)" }}>*</span></label>
                    <input
                      className={`input-field${usernameError ? " error" : ""}`}
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onBlur={() => setTouchedUsername(true)}
                    />
                    {usernameError && <div style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: 2 }}>{usernameError}</div>}
                  </div>
                  <div className="form-field">
                    <label className="form-label">Email <span style={{ color: "var(--danger)" }}>*</span></label>
                    <input
                      className={`input-field${emailError ? " error" : ""}`}
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setTouchedEmail(true)}
                    />
                    {emailError && <div style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: 2 }}>{emailError}</div>}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => void saveProfile()}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Employment Info — read-only */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Lock size={14} style={{ color: "var(--text-tertiary)" }} />
                  <div className="card-title">Employment Info</div>
                </div>
                <div className="card-subtitle" style={{ marginTop: 2 }}>Managed by your administrator</div>
              </div>
              <div style={{
                margin: "0 var(--space-5) var(--space-5)",
                background: "var(--n-50)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--r-md)",
                padding: "var(--space-4) var(--space-5)",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)",
              }}>
                {([
                  ["Employee ID",  profile.employeeId || "—"],
                  ["Role",         profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "—"],
                  ["Department",   profile.departmentName ?? "—"],
                  ["Work Policy",  profile.workPolicyName ?? "—"],
                  ["Leave Policy", profile.leavePolicyName ?? "—"],
                  ["Manager",      profile.managerUsername ?? "—"],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Password + Notifications ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

            {/* Change Password card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Change Password</div>
              </div>
              <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <PwdField
                  label="Current Password"
                  value={currentPwd}
                  onChange={setCurrentPwd}
                  placeholder="Enter your current password"
                />
                <PwdField
                  label="New Password"
                  value={newPwd}
                  onChange={setNewPwd}
                  placeholder="At least 8 characters"
                />
                {strength && (
                  <div style={{ marginTop: -8 }}>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--n-200)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        background: STRENGTH_COLOR[strength],
                        width: strength === "weak" ? "33%" : strength === "medium" ? "66%" : "100%",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <div style={{ fontSize: "0.72rem", color: STRENGTH_COLOR[strength], marginTop: 3 }}>
                      {strength.charAt(0).toUpperCase() + strength.slice(1)} password
                    </div>
                  </div>
                )}
                <PwdField
                  label="Confirm New Password"
                  value={confirmPwd}
                  onChange={setConfirmPwd}
                  onBlur={() => setTouchedConfirm(true)}
                  error={confirmError}
                  placeholder="Re-enter new password"
                />
                <button
                  className="btn btn-primary"
                  onClick={() => void changePassword()}
                  disabled={pwdDisabled}
                >
                  {savingPwd ? "Changing…" : "Change Password"}
                </button>
              </div>
            </div>

            {/* Notification Preferences card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Notification Preferences</div>
                  <div className="card-subtitle">Control which alerts you receive</div>
                </div>
              </div>
              <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Channels</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <ToggleRow
                      label="In-app notifications"
                      sub="Bell icon in the top navigation"
                      checked={prefs.inAppEnabled}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, inAppEnabled: v })}
                    />
                    <ToggleRow
                      label="Email notifications"
                      sub="Sent to your registered email address"
                      checked={prefs.emailEnabled}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, emailEnabled: v })}
                    />
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Notification Types</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <ToggleRow
                      label="Timesheet approved"
                      sub="When a manager approves your timesheet"
                      checked={prefs.onApproval}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, onApproval: v })}
                    />
                    <ToggleRow
                      label="Timesheet rejected"
                      sub="When a manager rejects or pushes back"
                      checked={prefs.onRejection}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, onRejection: v })}
                    />
                    <ToggleRow
                      label="Leave status updates"
                      sub="When your leave request is approved or rejected"
                      checked={prefs.onLeaveStatus}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, onLeaveStatus: v })}
                    />
                    <ToggleRow
                      label="Reminders"
                      sub="Missing timesheet, pending approvals"
                      checked={prefs.onReminder}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, onReminder: v })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Timesheet Templates section ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Timesheet Templates</div>
              <div className="card-subtitle">Save and reuse common sets of time entries</div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setNewTemplateName("");
                setNewTemplateRows([{ projectId: entryOptions?.projects[0]?.id ?? "", categoryId: entryOptions?.taskCategories[0]?.id ?? "", minutes: 60, note: "" }]);
                setShowNewTemplateForm(v => !v);
              }}
            >
              {showNewTemplateForm ? "Cancel" : "+ New Template"}
            </button>
          </div>

          {/* New template form */}
          {showNewTemplateForm && (
            <div style={{ padding: "0 var(--space-5) var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div className="form-field">
                <label className="form-label">Template name <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  className="input-field"
                  placeholder="e.g. Standard work day"
                  maxLength={120}
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                />
              </div>

              {/* Entry rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Entries</div>
                {newTemplateRows.map((row, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 1fr auto", gap: "var(--space-2)", alignItems: "center" }}>
                    <select
                      className="input-field"
                      style={{ fontSize: "0.82rem" }}
                      value={row.projectId}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, projectId: e.target.value } : r))}
                    >
                      <option value="">— Project —</option>
                      {(entryOptions?.projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                      className="input-field"
                      style={{ fontSize: "0.82rem" }}
                      value={row.categoryId}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, categoryId: e.target.value } : r))}
                    >
                      <option value="">— Category —</option>
                      {(entryOptions?.taskCategories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input
                      className="input-field"
                      type="number"
                      min={1}
                      max={1440}
                      placeholder="min"
                      style={{ fontSize: "0.82rem" }}
                      value={row.minutes}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, minutes: parseInt(e.target.value) || 0 } : r))}
                    />
                    <input
                      className="input-field"
                      placeholder="Note (optional)"
                      maxLength={500}
                      style={{ fontSize: "0.82rem" }}
                      value={row.note}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, note: e.target.value } : r))}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "4px 8px", color: "var(--danger)", fontSize: "0.8rem" }}
                      onClick={() => setNewTemplateRows(prev => prev.filter((_, i) => i !== idx))}
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ alignSelf: "flex-start", fontSize: "0.82rem", color: "var(--brand-500)" }}
                  onClick={() => setNewTemplateRows(prev => [
                    ...prev,
                    { projectId: entryOptions?.projects[0]?.id ?? "", categoryId: entryOptions?.taskCategories[0]?.id ?? "", minutes: 60, note: "" },
                  ])}
                >
                  + Add Row
                </button>
              </div>

              <button
                className="btn btn-primary"
                style={{ alignSelf: "flex-start" }}
                disabled={savingTemplate || !newTemplateName.trim() || newTemplateRows.filter(r => r.projectId && r.categoryId && r.minutes > 0).length === 0}
                onClick={() => void saveNewTemplate()}
              >
                {savingTemplate ? "Saving…" : "Save Template"}
              </button>
            </div>
          )}

          {/* Template list */}
          <div style={{ padding: "0 var(--space-5) var(--space-5)" }}>
            {templates.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem", padding: "var(--space-6) 0" }}>
                No templates yet. Create one to speed up time logging.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {templates.map(t => (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "var(--space-3) var(--space-4)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--r-md)",
                    background: "var(--n-50)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>{t.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                        {t.entries.length} entr{t.entries.length === 1 ? "y" : "ies"}
                      </div>
                    </div>
                    {confirmDeleteTemplateId === t.id ? (
                      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Delete?</span>
                        <button
                          className="btn btn-sm"
                          style={{ background: "var(--danger)", color: "#fff", border: "none", padding: "3px 10px" }}
                          disabled={deletingTemplateId === t.id}
                          onClick={() => void deleteTemplate(t.id)}
                        >
                          {deletingTemplateId === t.id ? "…" : "Yes"}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setConfirmDeleteTemplateId(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => setConfirmDeleteTemplateId(t.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </section>
    </>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label, sub, checked, disabled, onChange,
}: {
  label: string; sub: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: "var(--space-4)", cursor: disabled ? "default" : "pointer",
      padding: "var(--space-3) var(--space-4)",
      borderRadius: "var(--r-md)",
      border: "1px solid var(--border-subtle)",
      background: checked ? "var(--brand-50)" : "var(--n-50)",
      opacity: disabled ? 0.7 : 1,
      transition: "background 0.15s",
    }}>
      <div>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? "var(--brand-500)" : "var(--n-300)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
        <input
          type="checkbox" checked={checked} disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: disabled ? "default" : "pointer", margin: 0 }}
        />
      </div>
    </label>
  );
}
