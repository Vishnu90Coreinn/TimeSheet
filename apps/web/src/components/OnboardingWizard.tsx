import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { normalizeTimeZoneId } from "../hooks/useTimezone";
import type { MyProfile, NotificationPreferences } from "../types";
import { TimezoneSelect, type TimezoneOption } from "./TimezoneSelect";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  onApproval: true,
  onRejection: true,
  onLeaveStatus: true,
  onReminder: true,
  inAppEnabled: true,
  emailEnabled: false,
};

interface OnboardingWizardProps {
  open: boolean;
  role: string;
  username: string;
  onComplete: (completedAt: string) => void;
}

interface ToggleRowProps {
  label: string;
  sub: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

function roleLabel(role: string) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";
}

function formatZoneName(id: string) {
  return id.replace(/_/g, " ");
}

function ToggleRow({ label, sub, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-[var(--border-subtle)] [accent-color:var(--brand-500)]"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.88rem] font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="text-[0.75rem] text-[var(--text-secondary)]">{sub}</span>
      </span>
    </label>
  );
}

export function OnboardingWizard({ open, role, username, onComplete }: OnboardingWizardProps) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);
  const [timeZoneId, setTimeZoneId] = useState(() => normalizeTimeZoneId(localStorage.getItem("timeZoneId")));
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(
    () => [
      { title: "Welcome", sub: "Set up your workspace in a few quick steps." },
      { title: "Timezone", sub: "Keep time tracking aligned to your local day." },
      { title: "Notifications", sub: "Choose how you want to stay in sync." },
      { title: "Review", sub: "Confirm the essentials and finish setup." },
    ],
    [],
  );

  useEffect(() => {
    if (!open) return;

    let active = true;
    setStep(0);
    setLoading(true);
    setSaving(false);
    setError(null);
    setProfile(null);
    setTimeZoneId(normalizeTimeZoneId(localStorage.getItem("timeZoneId")));
    setPreferences(DEFAULT_PREFERENCES);

    async function load() {
      const [profileRes, zoneRes, prefRes] = await Promise.all([
        apiFetch("/profile").catch(() => null),
        apiFetch("/timezones").catch(() => null),
        apiFetch("/profile/notification-preferences").catch(() => null),
      ]);

      if (!active) return;

      if (profileRes?.ok) {
        const profileData = await profileRes.json() as MyProfile;
        setProfile(profileData);
        setTimeZoneId(normalizeTimeZoneId(profileData.timeZoneId));
      }

      if (zoneRes?.ok) {
        const zones = await zoneRes.json() as TimezoneOption[];
        setTimezones(Array.isArray(zones) && zones.length > 0 ? zones : []);
      }

      if (prefRes?.ok) {
        const prefs = await prefRes.json() as NotificationPreferences;
        setPreferences({ ...DEFAULT_PREFERENCES, ...prefs });
      }
    }

    void load()
      .catch(() => {
        if (active) setError("We could not load the onboarding setup yet.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const canGoBack = step > 0;
  const isFinalStep = step === steps.length - 1;
  const roleName = roleLabel(role);
  const displayTimezones = timezones.length > 0 ? timezones : [{ id: timeZoneId, displayName: "Current timezone" }];

  async function saveProfileAndFinish() {
    if (saving) return;
    setSaving(true);
    setError(null);

    let timezoneSaved = false;
    let prefsSaved = true;

    try {
      if (profile) {
        const profileResponse = await apiFetch("/profile", {
          method: "PUT",
          body: JSON.stringify({
            username: profile.username,
            displayName: profile.displayName ?? "",
            email: profile.email,
            timeZoneId,
          }),
        });
        timezoneSaved = profileResponse.ok || profileResponse.status === 204;
      }

      const prefsResponse = await apiFetch("/profile/notification-preferences", {
        method: "PUT",
        body: JSON.stringify(preferences),
      });
      prefsSaved = prefsResponse.ok || prefsResponse.status === 204;

      await apiFetch("/onboarding/complete", { method: "POST" }).catch(() => null);

      if (!timezoneSaved || !prefsSaved) {
        toast.warning("Onboarding finished locally", "Some settings could not be saved right now.");
      } else {
        toast.success("Onboarding complete", "Your workspace is ready.");
      }

      onComplete(new Date().toISOString());
    } catch {
      setError("We could not save every step. Your workspace can still continue.");
      toast.error("Onboarding save failed", "Please try again or complete setup from Profile later.");
      onComplete(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }

  const footerLabel = isFinalStep ? "Finish setup" : "Continue";

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4 py-5">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[10px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sprint 28 onboarding wizard"
        className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[0_30px_80px_rgba(15,23,42,0.22)]"
      >
        <div className="grid min-h-[620px] lg:grid-cols-[0.95fr_1.25fr]">
          <aside
            className="relative flex flex-col justify-between gap-8 overflow-hidden px-6 py-7 text-white lg:px-8"
            style={{ background: "linear-gradient(145deg, #1e293b 0%, #312e81 52%, #0f766e 100%)" }}
          >
            <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 38%), radial-gradient(circle at bottom left, rgba(255,255,255,0.12), transparent 34%)" }} />
            <div className="relative flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold backdrop-blur">
                  {roleName.slice(0, 1)}
                </div>
                <div>
                  <div className="text-[0.72rem] uppercase tracking-[0.2em] text-white/65">Sprint 28</div>
                  <div className="text-lg font-semibold">Onboarding for {roleName}s</div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold leading-tight">
                  Welcome, {username}. Let us shape your workspace.
                </h2>
                <p className="max-w-md text-sm leading-6 text-white/78">
                  We will align your timezone, notification defaults, and role-specific setup so the dashboard feels ready from the first session.
                </p>
              </div>

              <div className="grid gap-3">
                {steps.map((item, index) => {
                  const activeStep = index === step;
                  return (
                    <div
                      key={item.title}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${activeStep ? "border-white/30 bg-white/12" : "border-white/12 bg-white/6"}`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[0.8rem] font-semibold ${activeStep ? "bg-white text-slate-900" : "bg-white/12 text-white"}`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-[0.75rem] text-white/72">{item.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur">
              <div className="text-[0.72rem] uppercase tracking-[0.18em] text-white/60">What this unlocks</div>
              <div className="mt-3 grid gap-2 text-sm text-white/85">
                <div>• A timezone-aware dashboard and attendance flow</div>
                <div>• Notification defaults that match your role</div>
                <div>• A compact checklist on your dashboard</div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-white px-6 py-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Step {step + 1} of {steps.length}
                </div>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">{steps[step].title}</h3>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{steps[step].sub}</p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => void saveProfileAndFinish()} disabled={saving}>
                Skip setup
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.07)] px-4 py-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            <div className="mt-5 flex-1">
              {loading ? (
                <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-6 py-12">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-2xl bg-[var(--brand-100)]" />
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Preparing your workspace</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">Loading timezone and notification defaults...</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {step === 0 && (
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-600)] font-semibold">
                          {roleName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[0.8rem] font-semibold text-[var(--text-secondary)]">Workspace role</div>
                          <div className="text-[1rem] font-semibold text-[var(--text-primary)]">{roleName}</div>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-500">Timezone</div>
                          <div className="mt-2 text-sm text-slate-900">Set your working timezone before you log time.</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-500">Notifications</div>
                          <div className="mt-2 text-sm text-slate-900">Keep approvals and reminders visible.</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-500">Checklist</div>
                          <div className="mt-2 text-sm text-slate-900">Get role-specific setup tasks on the dashboard.</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                      <div className="mb-3 text-sm font-semibold text-slate-950">Choose your timezone</div>
                      <div className="text-sm text-slate-600">This keeps the attendance widget, timesheets, and reminders aligned to your local day.</div>
                      <div className="mt-4 max-w-xl">
                        <TimezoneSelect value={timeZoneId} options={displayTimezones} onChange={setTimeZoneId} disabled={saving} />
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        Saved timezone: {formatZoneName(timeZoneId)}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-slate-950">Notification preferences</div>
                        <div className="mt-1 text-sm text-slate-600">Pick the channels and events that help you stay on top of work.</div>
                      </div>
                      <div className="grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <ToggleRow
                            label="In-app notifications"
                            sub="Show alerts in the header and workspace."
                            checked={preferences.inAppEnabled}
                            disabled={saving}
                            onChange={(value) => setPreferences((current) => ({ ...current, inAppEnabled: value }))}
                          />
                          <ToggleRow
                            label="Email notifications"
                            sub="Send critical updates to your inbox."
                            checked={preferences.emailEnabled}
                            disabled={saving}
                            onChange={(value) => setPreferences((current) => ({ ...current, emailEnabled: value }))}
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <ToggleRow
                            label="Approval updates"
                            sub="Timesheet approval or rejection alerts."
                            checked={preferences.onApproval}
                            disabled={saving}
                            onChange={(value) => setPreferences((current) => ({ ...current, onApproval: value }))}
                          />
                          <ToggleRow
                            label="Rejection updates"
                            sub="Timesheet feedback and pushback alerts."
                            checked={preferences.onRejection}
                            disabled={saving}
                            onChange={(value) => setPreferences((current) => ({ ...current, onRejection: value }))}
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <ToggleRow
                            label="Leave status updates"
                            sub="When a leave request changes state."
                            checked={preferences.onLeaveStatus}
                            disabled={saving}
                            onChange={(value) => setPreferences((current) => ({ ...current, onLeaveStatus: value }))}
                          />
                          <ToggleRow
                            label="Reminders"
                            sub="Missing timesheet and pending approval reminders."
                            checked={preferences.onReminder}
                            disabled={saving}
                            onChange={(value) => setPreferences((current) => ({ ...current, onReminder: value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                      <div className="text-sm font-semibold text-slate-950">Review your setup</div>
                      <div className="mt-1 text-sm text-slate-600">Everything below will be saved before you enter the dashboard.</div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-500">Timezone</div>
                          <div className="mt-2 text-sm font-semibold text-slate-950">{timeZoneId}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-500">Delivery</div>
                          <div className="mt-2 text-sm font-semibold text-slate-950">
                            {preferences.inAppEnabled ? "In-app" : "No in-app"}{preferences.emailEnabled ? " and email" : ""}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-500">Role-aware checklist</div>
                        <div className="mt-2 text-sm text-slate-900">
                          Your dashboard will show a {roleName.toLowerCase()} checklist the first time you land on it.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
              <button className="btn btn-outline btn-sm" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={!canGoBack || saving || loading}>
                Back
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-outline btn-sm" onClick={() => void saveProfileAndFinish()} disabled={saving || loading}>
                  Save and exit
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (isFinalStep) {
                      void saveProfileAndFinish();
                    } else {
                      setStep((current) => Math.min(current + 1, steps.length - 1));
                    }
                  }}
                  disabled={saving || loading}
                >
                  {saving ? "Saving..." : footerLabel}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
