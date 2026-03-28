/**
 * Profile.tsx — Self-service profile page (Sprint 13, UX v2)
 * All roles. Accessible from topbar avatar.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, EyeOff, Lock, Camera, Download, Trash2 } from "lucide-react";
import { apiFetch } from "../api/client";
import type { MyProfile, NotificationPreferences } from "../types";
import { TimezoneSelect, type TimezoneOption } from "./TimezoneSelect";

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
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9999] pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="px-5 py-3 rounded-md text-white text-[0.85rem] font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.18)] [animation:page-enter_var(--transition-base)_both]"
          style={{ background: t.ok ? "var(--success)" : "var(--danger)" }}
        >
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
      <div className="relative">
        <input
          className={`input-field pr-10${error ? " error" : ""}`}
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-[10px] top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-text-tertiary p-0 flex"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <div className="text-[0.72rem] text-danger mt-[2px]">{error}</div>}
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
  const [timeZoneId, setTimeZoneId]   = useState("UTC");
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);
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
        setTimeZoneId(d.timeZoneId ?? "UTC");
        localStorage.setItem("timeZoneId", d.timeZoneId ?? "UTC");
      }
    });
    apiFetch("/timezones").then(async r => {
      if (r.ok) setTimezones(await r.json() as TimezoneOption[]);
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
      body: JSON.stringify({ username: username.trim(), displayName: displayName.trim(), email: email.trim(), timeZoneId }),
    });
    if (r.ok || r.status === 204) {
      setProfile(p => p ? { ...p, username: username.trim(), displayName: displayName.trim(), email: email.trim(), timeZoneId } : p);
      localStorage.setItem("timeZoneId", timeZoneId);
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

  // ── Privacy & Data ──────────────────────────────────────────────────────────

  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [requestingExport, setRequestingExport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleRequestExport() {
    setRequestingExport(true);
    const r = await apiFetch("/privacy/export-request", { method: "POST" });
    if (r.ok) {
      const data = await r.json() as { status: string; downloadUrl?: string | null };
      setExportStatus(data.status);
      setExportUrl(data.downloadUrl ?? null);
      showToast(true, "Export queued. You'll receive a notification when ready.");
    } else {
      showToast(false, "Failed to request export.");
    }
    setRequestingExport(false);
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    const r = await apiFetch("/privacy/delete-account", { method: "POST" });
    setDeletingAccount(false);
    if (r.ok || r.status === 204) {
      showToast(true, "Account anonymised. You will be signed out.");
      setTimeout(() => window.location.href = "/", 2000);
    } else {
      showToast(false, "Failed to delete account.");
    }
    setConfirmDelete(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!profile || !prefs) {
    return (
      <div className="p-8 text-text-tertiary">Loading…</div>
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

      <section className="flex flex-col gap-6">

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
        <div className="grid grid-cols-2 gap-6 items-start">

          {/* ── Left: Account Details + Password ── */}
          <div className="flex flex-col gap-6">

            {/* Account Details card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Account Details</div>
              </div>
              <div className="p-6 flex flex-col gap-5">

                {/* Avatar */}
                <div className="flex items-center gap-5">
                  <div className="group relative shrink-0">
                    {/* Avatar circle */}
                    <div
                      className="w-[72px] h-[72px] rounded-lg flex items-center justify-center text-[1.4rem] font-bold text-white border-2 border-border-subtle overflow-hidden"
                      style={{
                        background: profile.avatarDataUrl
                          ? undefined
                          : "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
                        backgroundImage: profile.avatarDataUrl ? `url(${profile.avatarDataUrl})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      {!profile.avatarDataUrl && initials}
                    </div>
                    {/* Camera overlay button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={savingAvatar}
                      className="absolute inset-0 rounded-lg bg-[rgba(0,0,0,0.45)] border-0 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-white disabled:cursor-not-allowed"
                      aria-label="Upload avatar"
                      title="Upload avatar"
                    >
                      <Camera size={20} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) void handleAvatarFile(f); e.target.value = ""; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[1rem] text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                      {profile.displayName || profile.username}
                    </div>
                    <div className="text-[0.8rem] text-text-tertiary capitalize">{profile.role}</div>
                    {profile.avatarDataUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost mt-2 py-[2px] px-2 text-[0.72rem]"
                        onClick={() => void removeAvatar()}
                        disabled={savingAvatar}
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Editable fields */}
                <div className="grid gap-4">
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
                    <label className="form-label">Username <span className="text-danger">*</span></label>
                    <input
                      className={`input-field${usernameError ? " error" : ""}`}
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onBlur={() => setTouchedUsername(true)}
                    />
                    {usernameError && <div className="text-[0.72rem] text-danger mt-[2px]">{usernameError}</div>}
                  </div>
                  <div className="form-field">
                    <label className="form-label">Email <span className="text-danger">*</span></label>
                    <input
                      className={`input-field${emailError ? " error" : ""}`}
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setTouchedEmail(true)}
                    />
                    {emailError && <div className="text-[0.72rem] text-danger mt-[2px]">{emailError}</div>}
                  </div>
                  <div className="form-field">
                    <label className="form-label">Timezone</label>
                    <TimezoneSelect
                      value={timeZoneId}
                      options={timezones}
                      onChange={setTimeZoneId}
                      disabled={savingProfile || timezones.length === 0}
                    />
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
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-text-tertiary" />
                  <div className="card-title">Employment Info</div>
                </div>
                <div className="card-subtitle mt-[2px]">Managed by your administrator</div>
              </div>
              <div className="mx-[var(--space-5)] mb-[var(--space-5)] bg-n-50 border border-border-subtle rounded-md py-[var(--space-4)] px-[var(--space-5)] grid grid-cols-2 gap-[var(--space-4)]">
                {([
                  ["Employee ID",  profile.employeeId || "—"],
                  ["Role",         profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "—"],
                  ["Department",   profile.departmentName ?? "—"],
                  ["Work Policy",  profile.workPolicyName ?? "—"],
                  ["Leave Policy", profile.leavePolicyName ?? "—"],
                  ["Manager",      profile.managerUsername ?? "—"],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[0.68rem] font-bold text-text-tertiary uppercase tracking-[0.05em]">{label}</div>
                    <div className="text-[0.85rem] text-text-primary mt-[2px]">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Password + Notifications ── */}
          <div className="flex flex-col gap-6">

            {/* Change Password card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Change Password</div>
              </div>
              <div className="p-6 flex flex-col gap-4">
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
                  <div className="-mt-2">
                    <div className="h-1 rounded-sm bg-n-200 overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-[width] duration-300"
                        style={{
                          background: STRENGTH_COLOR[strength],
                          width: strength === "weak" ? "33%" : strength === "medium" ? "66%" : "100%",
                        }}
                      />
                    </div>
                    <div className="text-[0.72rem] mt-[3px]" style={{ color: STRENGTH_COLOR[strength] }}>
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
              <div className="p-6 flex flex-col gap-5">
                <div>
                  <div className="text-[0.72rem] font-bold text-text-tertiary uppercase tracking-[0.05em] mb-3">Channels</div>
                  <div className="flex flex-col gap-2">
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

                <div className="border-t border-border-subtle" />

                <div>
                  <div className="text-[0.72rem] font-bold text-text-tertiary uppercase tracking-[0.05em] mb-3">Notification Types</div>
                  <div className="flex flex-col gap-2">
                    <ToggleRow
                      label="Timesheet approved"
                      sub="When a manager approves your timesheet."
                      checked={prefs.onApproval}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, onApproval: v })}
                    />
                    <ToggleRow
                      label="Timesheet rejected"
                      sub="When a manager rejects your timesheet or asks for changes."
                      checked={prefs.onRejection}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, onRejection: v })}
                    />
                    <ToggleRow
                      label="Leave approved or rejected"
                      sub="When your leave request is approved or rejected."
                      checked={prefs.onLeaveStatus}
                      disabled={savingPrefs}
                      onChange={v => void savePrefs({ ...prefs, onLeaveStatus: v })}
                    />
                    <ToggleRow
                      label="Anomaly alerts"
                      sub="Missing timesheets, unusual attendance patterns, and other reminders."
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
            <div className="px-5 pb-5 flex flex-col gap-4">
              <div className="form-field">
                <label className="form-label">Template name <span className="text-danger">*</span></label>
                <input
                  className="input-field"
                  placeholder="e.g. Standard work day"
                  maxLength={120}
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                />
              </div>

              {/* Entry rows */}
              <div className="flex flex-col gap-2">
                <div className="text-[0.72rem] font-bold text-text-tertiary uppercase tracking-[0.05em]">Entries</div>
                {newTemplateRows.map((row, idx) => (
                  <div key={idx} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 1fr 80px 1fr auto" }}>
                    <select
                      className="input-field text-[0.82rem]"
                      value={row.projectId}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, projectId: e.target.value } : r))}
                    >
                      <option value="">— Project —</option>
                      {(entryOptions?.projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                      className="input-field text-[0.82rem]"
                      value={row.categoryId}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, categoryId: e.target.value } : r))}
                    >
                      <option value="">— Category —</option>
                      {(entryOptions?.taskCategories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input
                      className="input-field text-[0.82rem]"
                      type="number"
                      min={1}
                      max={1440}
                      placeholder="min"
                      value={row.minutes}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, minutes: parseInt(e.target.value) || 0 } : r))}
                    />
                    <input
                      className="input-field text-[0.82rem]"
                      placeholder="Note (optional)"
                      maxLength={500}
                      value={row.note}
                      onChange={e => setNewTemplateRows(prev => prev.map((r, i) => i === idx ? { ...r, note: e.target.value } : r))}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost py-[4px] px-2 text-danger text-[0.8rem]"
                      onClick={() => setNewTemplateRows(prev => prev.filter((_, i) => i !== idx))}
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost self-start text-[0.82rem] text-brand-500"
                  onClick={() => setNewTemplateRows(prev => [
                    ...prev,
                    { projectId: entryOptions?.projects[0]?.id ?? "", categoryId: entryOptions?.taskCategories[0]?.id ?? "", minutes: 60, note: "" },
                  ])}
                >
                  + Add Row
                </button>
              </div>

              <button
                className="btn btn-primary self-start"
                disabled={savingTemplate || !newTemplateName.trim() || newTemplateRows.filter(r => r.projectId && r.categoryId && r.minutes > 0).length === 0}
                onClick={() => void saveNewTemplate()}
              >
                {savingTemplate ? "Saving…" : "Save Template"}
              </button>
            </div>
          )}

          {/* Template list */}
          <div className="px-5 pb-5">
            {templates.length === 0 ? (
              <div className="text-center text-text-tertiary text-[0.85rem] py-6">
                No templates yet. Create one to speed up time logging.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-[var(--space-3)] px-[var(--space-4)] border border-border-subtle rounded-md bg-n-50">
                    <div>
                      <div className="font-semibold text-[0.85rem] text-text-primary">{t.name}</div>
                      <div className="text-[0.75rem] text-text-tertiary mt-[2px]">
                        {t.entries.length} entr{t.entries.length === 1 ? "y" : "ies"}
                      </div>
                    </div>
                    {confirmDeleteTemplateId === t.id ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-[0.75rem] text-text-tertiary">Delete?</span>
                        <button
                          className="btn btn-sm [background:var(--danger)] text-white border-0 py-[3px] px-[10px]"
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
                        className="btn btn-ghost btn-sm text-danger"
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

        {/* ── Privacy & Data card ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Privacy &amp; Data</div>
            <div className="card-subtitle">Manage your personal data and account</div>
          </div>
          <div className="card-body flex flex-col gap-4">

            {/* Download my data */}
            <div className="flex items-start justify-between gap-4 py-3 border-b border-border-subtle">
              <div>
                <div className="text-[0.85rem] font-semibold text-text-primary">Download my data</div>
                <div className="text-[0.75rem] text-text-tertiary mt-[2px]">
                  Export all your timesheets, leave records and profile as a JSON file.
                </div>
                {exportStatus === "Completed" && exportUrl && (
                  <a
                    href={`http://localhost:5000${exportUrl}`}
                    download
                    className="inline-flex items-center gap-1 text-[0.75rem] text-brand-600 hover:underline mt-1"
                  >
                    <Download size={12} /> Download export
                  </a>
                )}
                {exportStatus === "Pending" && (
                  <span className="text-[0.75rem] text-text-tertiary mt-1 block">Processing… check back shortly.</span>
                )}
              </div>
              <button
                className="btn btn-secondary btn-sm shrink-0"
                onClick={() => void handleRequestExport()}
                disabled={requestingExport || exportStatus === "Pending"}
              >
                {requestingExport ? "Requesting…" : "Request export"}
              </button>
            </div>

            {/* Delete account */}
            <div className="flex items-start justify-between gap-4 py-2">
              <div>
                <div className="text-[0.85rem] font-semibold text-danger">Delete my account</div>
                <div className="text-[0.75rem] text-text-tertiary mt-[2px]">
                  Anonymises your name and email. Timesheet data is retained for reporting.
                </div>
              </div>
              {!confirmDelete ? (
                <button
                  className="btn btn-sm border border-danger text-danger bg-transparent hover:bg-danger-light shrink-0"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={13} className="mr-1" /> Delete account
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[0.75rem] text-text-tertiary">Are you sure?</span>
                  <button
                    className="btn btn-sm [background:var(--color-danger)] text-white border-0"
                    disabled={deletingAccount}
                    onClick={() => void handleDeleteAccount()}
                  >
                    {deletingAccount ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>

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
    <label
      className={`flex items-center justify-between gap-4 py-[var(--space-3)] px-[var(--space-4)] rounded-md border border-border-subtle transition-[background] duration-150 ${disabled ? "cursor-default" : "cursor-pointer"}`}
      style={{
        background: checked ? "var(--brand-50)" : "var(--n-50)",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <div>
        <div className="text-[0.85rem] font-semibold text-text-primary">{label}</div>
        <div className="text-[0.75rem] text-text-tertiary mt-[1px]">{sub}</div>
      </div>
      <div
        className="w-[40px] h-[22px] rounded-[11px] relative shrink-0 transition-[background] duration-200"
        style={{ background: checked ? "var(--brand-500)" : "var(--n-300)" }}
      >
        <div
          className="absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white transition-[left] duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
          style={{ left: checked ? 21 : 3 }}
        />
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className={`absolute opacity-0 w-full h-full m-0 ${disabled ? "cursor-default" : "cursor-pointer"}`}
        />
      </div>
    </label>
  );
}
