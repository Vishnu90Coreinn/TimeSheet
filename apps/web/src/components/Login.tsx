/**
 * Login.tsx — Pulse SaaS design v3.0
 * Left: gradient brand panel with features + testimonial
 * Right: clean sign-in form with forgot-password flow
 */
import { FormEvent, useEffect, useRef, useState } from "react";
import { API_BASE } from "../api/client";
import { apiFetch } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import type { Session } from "../types";

interface LoginProps {
  onLogin: (session: Session) => void;
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  maxAgeDays: number;
}

type Step = "login" | "fp-username" | "fp-answer" | "fp-reset" | "fp-done" | "force-change";

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

const STRENGTH_COLOR = { weak: "var(--danger)", medium: "var(--warning)", strong: "var(--success)" } as const;

export function Login({ onLogin }: LoginProps) {
  const toast = useToast();

  // ── Normal login ─────────────────────────────────────────────────────────
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  // ── Flow state ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("login");

  // ── Forgot password state ────────────────────────────────────────────────
  const [fpUsername, setFpUsername]         = useState("");
  const [fpQuestion, setFpQuestion]         = useState("");
  const [fpAnswer, setFpAnswer]             = useState("");
  const [fpResetToken, setFpResetToken]     = useState("");
  const [fpNewPwd, setFpNewPwd]             = useState("");
  const [fpConfirmPwd, setFpConfirmPwd]     = useState("");
  const [fpError, setFpError]               = useState("");
  const [fpLoading, setFpLoading]           = useState(false);

  // ── Force-change state ───────────────────────────────────────────────────
  const [forceNewPwd, setForceNewPwd]       = useState("");
  const [forceConfirmPwd, setForceConfirmPwd] = useState("");
  const [forceError, setForceError]         = useState("");
  const [forceLoading, setForceLoading]     = useState(false);
  // Store pending session (has token but mustChangePassword=true)
  const pendingSessionRef = useRef<Session | null>(null);
  const loginPasswordRef  = useRef("");

  // ── Password policy ──────────────────────────────────────────────────────
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/password-policy`)
      .then(r => r.ok ? r.json() : null)
      .then((d: PasswordPolicy | null) => { if (d) setPolicy(d); })
      .catch(() => {/* ignore */});
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function resetFpState() {
    setFpUsername(""); setFpQuestion(""); setFpAnswer("");
    setFpResetToken(""); setFpNewPwd(""); setFpConfirmPwd(""); setFpError("");
  }

  function goToLogin() { resetFpState(); setError(""); setStep("login"); }

  // ── Normal login submit ──────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Username/email and password are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg = (body as { detail?: string }).detail ?? "Invalid username/email or password.";
        setError(msg);
        toast.error("Login failed", msg);
        return;
      }
      const data = await response.json() as {
        userId: string; accessToken: string; refreshToken: string;
        username: string; role: string;
        onboardingCompletedAt?: string | null;
        leaveWorkflowVisitedAt?: string | null;
        mustChangePassword?: boolean;
      };

      const session: Session = {
        userId:       data.userId ?? "",
        accessToken:  data.accessToken,
        refreshToken: data.refreshToken,
        username:     data.username,
        role:         data.role,
        onboardingCompletedAt: data.onboardingCompletedAt ?? null,
        leaveWorkflowVisitedAt: data.leaveWorkflowVisitedAt ?? null,
      };

      if (data.mustChangePassword) {
        pendingSessionRef.current = session;
        loginPasswordRef.current = password;
        setForceNewPwd(""); setForceConfirmPwd(""); setForceError("");
        setStep("force-change");
      } else {
        onLogin(session);
      }
    } catch {
      const msg = "Connection error. Please try again.";
      setError(msg);
      toast.error("Login failed", msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Forced password change ───────────────────────────────────────────────

  async function handleForceChange(e: FormEvent) {
    e.preventDefault();
    if (forceNewPwd !== forceConfirmPwd) { setForceError("Passwords do not match."); return; }
    if (!forceNewPwd) { setForceError("New password is required."); return; }
    setForceError("");
    setForceLoading(true);
    try {
      const r = await apiFetch("/profile/password", {
        method: "PUT",
        headers: { Authorization: `Bearer ${pendingSessionRef.current?.accessToken ?? ""}` },
        body: JSON.stringify({ currentPassword: loginPasswordRef.current, newPassword: forceNewPwd }),
      });
      if (r.ok || r.status === 204) {
        if (pendingSessionRef.current) onLogin(pendingSessionRef.current);
      } else {
        const d = await r.json().catch(() => ({})) as { message?: string };
        setForceError(d.message ?? "Failed to change password.");
      }
    } catch {
      setForceError("Connection error. Please try again.");
    } finally {
      setForceLoading(false);
    }
  }

  // ── Forgot password step 1: get security question ────────────────────────

  async function handleFpUsername(e: FormEvent) {
    e.preventDefault();
    if (!fpUsername.trim()) { setFpError("Please enter your username."); return; }
    setFpError(""); setFpLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/security-question?username=${encodeURIComponent(fpUsername.trim())}`);
      if (r.status === 404) {
        setFpError("No security question set. Contact your administrator.");
      } else if (r.ok) {
        const d = await r.json() as { question: string };
        setFpQuestion(d.question);
        setFpAnswer("");
        setStep("fp-answer");
      } else {
        setFpError("Failed to retrieve security question. Please try again.");
      }
    } catch {
      setFpError("Connection error. Please try again.");
    } finally {
      setFpLoading(false);
    }
  }

  // ── Forgot password step 2: verify answer ────────────────────────────────

  async function handleFpVerify(e: FormEvent) {
    e.preventDefault();
    if (!fpAnswer.trim()) { setFpError("Please enter your answer."); return; }
    setFpError(""); setFpLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/forgot-password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fpUsername.trim(), answer: fpAnswer }),
      });
      if (r.ok) {
        const d = await r.json() as { resetToken: string; expiresAt: string };
        setFpResetToken(d.resetToken);
        setFpNewPwd(""); setFpConfirmPwd("");
        setStep("fp-reset");
      } else {
        const d = await r.json().catch(() => ({})) as { message?: string };
        setFpError(d.message ?? "Incorrect answer. Please try again.");
      }
    } catch {
      setFpError("Connection error. Please try again.");
    } finally {
      setFpLoading(false);
    }
  }

  // ── Forgot password step 3: reset password ───────────────────────────────

  async function handleFpReset(e: FormEvent) {
    e.preventDefault();
    if (fpNewPwd !== fpConfirmPwd) { setFpError("Passwords do not match."); return; }
    if (!fpNewPwd) { setFpError("New password is required."); return; }
    setFpError(""); setFpLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken: fpResetToken, newPassword: fpNewPwd }),
      });
      if (r.ok || r.status === 204) {
        setStep("fp-done");
      } else {
        const d = await r.json().catch(() => ({})) as { message?: string };
        setFpError(d.message ?? "Failed to reset password. Please try again.");
      }
    } catch {
      setFpError("Connection error. Please try again.");
    } finally {
      setFpLoading(false);
    }
  }

  // ── Policy hints renderer ─────────────────────────────────────────────────

  function PolicyHints() {
    if (!policy) return null;
    const hints: string[] = [];
    hints.push(`At least ${policy.minLength} character${policy.minLength !== 1 ? "s" : ""}`);
    if (policy.requireUppercase) hints.push("At least one uppercase letter");
    if (policy.requireLowercase) hints.push("At least one lowercase letter");
    if (policy.requireNumber) hints.push("At least one number");
    if (policy.requireSpecialChar) hints.push("At least one special character");
    if (policy.maxAgeDays > 0) hints.push(`Password expires every ${policy.maxAgeDays} day${policy.maxAgeDays !== 1 ? "s" : ""}`);
    return (
      <ul className="mt-1 mb-1 pl-4 text-[0.78rem] text-text-tertiary space-y-0.5 list-disc">
        {hints.map(h => <li key={h}>{h}</li>)}
      </ul>
    );
  }

  // ── Strength bar ──────────────────────────────────────────────────────────

  function StrengthBar({ pwd }: { pwd: string }) {
    const s = pwdStrength(pwd);
    if (!s) return null;
    return (
      <div className="-mt-1 mb-1">
        <div className="h-1 rounded-sm overflow-hidden" style={{ background: "var(--n-200)" }}>
          <div
            className="h-full rounded-sm transition-[width] duration-300"
            style={{
              background: STRENGTH_COLOR[s],
              width: s === "weak" ? "33%" : s === "medium" ? "66%" : "100%",
            }}
          />
        </div>
        <div className="text-[0.72rem] mt-[3px]" style={{ color: STRENGTH_COLOR[s] }}>
          {s.charAt(0).toUpperCase() + s.slice(1)} password
        </div>
      </div>
    );
  }

  // ── Right panel content by step ───────────────────────────────────────────

  function renderRight() {

    // ── Force change password ──────────────────────────────────────────────
    if (step === "force-change") {
      const forceStrength = pwdStrength(forceNewPwd);
      return (
        <>
          <div className="lp-right-header">
            <h2>Change your password</h2>
            <p>You must set a new password before continuing.</p>
          </div>
          <form onSubmit={(e) => { void handleForceChange(e); }} noValidate>
            <div className="lp-field">
              <label className="lp-label" htmlFor="fc-new">New Password</label>
              <div className="lp-input-wrap">
                <div className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input id="fc-new" type="password" className={`lp-input${forceError ? " lp-input--err" : ""}`} placeholder="New password" value={forceNewPwd} onChange={e => setForceNewPwd(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            {forceNewPwd && (
              <div className="px-0 mb-2">
                <StrengthBar pwd={forceNewPwd} />
                <PolicyHints />
              </div>
            )}
            <div className="lp-field">
              <label className="lp-label" htmlFor="fc-confirm">Confirm New Password</label>
              <div className="lp-input-wrap">
                <div className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input id="fc-confirm" type="password" className={`lp-input${forceError ? " lp-input--err" : ""}`} placeholder="Confirm new password" value={forceConfirmPwd} onChange={e => setForceConfirmPwd(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            {forceError && (
              <div className="lp-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {forceError}
              </div>
            )}
            <button type="submit" className="lp-submit" disabled={forceLoading}>
              {forceLoading ? <span className="lp-spinner" /> : "Set Password →"}
            </button>
          </form>
        </>
      );
    }

    // ── Forgot password step 1: enter username ─────────────────────────────
    if (step === "fp-username") {
      return (
        <>
          <div className="lp-right-header">
            <button type="button" onClick={goToLogin} className="lp-forgot flex items-center gap-1 mb-3" style={{ fontSize: "0.82rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to sign in
            </button>
            <h2>Reset your password</h2>
            <p>Enter your username to get started</p>
          </div>
          <form onSubmit={(e) => { void handleFpUsername(e); }} noValidate>
            <div className="lp-field">
              <label className="lp-label" htmlFor="fp-user">Username</label>
              <div className="lp-input-wrap">
                <div className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <input id="fp-user" type="text" className={`lp-input${fpError ? " lp-input--err" : ""}`} placeholder="Your username" value={fpUsername} onChange={e => setFpUsername(e.target.value)} autoComplete="username" />
              </div>
            </div>
            {fpError && (
              <div className="lp-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {fpError}
              </div>
            )}
            <button type="submit" className="lp-submit" disabled={fpLoading}>
              {fpLoading ? <span className="lp-spinner" /> : "Continue →"}
            </button>
          </form>
        </>
      );
    }

    // ── Forgot password step 2: answer security question ───────────────────
    if (step === "fp-answer") {
      return (
        <>
          <div className="lp-right-header">
            <button type="button" onClick={() => { setStep("fp-username"); setFpError(""); }} className="lp-forgot flex items-center gap-1 mb-3" style={{ fontSize: "0.82rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              Back
            </button>
            <h2>Security question</h2>
            <p>Answer your security question to continue</p>
          </div>
          <form onSubmit={(e) => { void handleFpVerify(e); }} noValidate>
            <div className="lp-field">
              <label className="lp-label">{fpQuestion}</label>
              <div className="lp-input-wrap">
                <div className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input type="password" className={`lp-input${fpError ? " lp-input--err" : ""}`} placeholder="Your answer" value={fpAnswer} onChange={e => setFpAnswer(e.target.value)} autoComplete="off" />
              </div>
            </div>
            {fpError && (
              <div className="lp-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {fpError}
              </div>
            )}
            <button type="submit" className="lp-submit" disabled={fpLoading}>
              {fpLoading ? <span className="lp-spinner" /> : "Verify →"}
            </button>
          </form>
        </>
      );
    }

    // ── Forgot password step 3: set new password ───────────────────────────
    if (step === "fp-reset") {
      return (
        <>
          <div className="lp-right-header">
            <h2>Set new password</h2>
            <p>Choose a strong password for your account</p>
          </div>
          <form onSubmit={(e) => { void handleFpReset(e); }} noValidate>
            <div className="lp-field">
              <label className="lp-label" htmlFor="fp-newpwd">New Password</label>
              <div className="lp-input-wrap">
                <div className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input id="fp-newpwd" type="password" className={`lp-input${fpError ? " lp-input--err" : ""}`} placeholder="New password" value={fpNewPwd} onChange={e => setFpNewPwd(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            {fpNewPwd && (
              <div className="px-0 mb-2">
                <StrengthBar pwd={fpNewPwd} />
                <PolicyHints />
              </div>
            )}
            <div className="lp-field">
              <label className="lp-label" htmlFor="fp-confirmpwd">Confirm Password</label>
              <div className="lp-input-wrap">
                <div className="lp-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input id="fp-confirmpwd" type="password" className={`lp-input${fpError ? " lp-input--err" : ""}`} placeholder="Confirm new password" value={fpConfirmPwd} onChange={e => setFpConfirmPwd(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            {fpError && (
              <div className="lp-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {fpError}
              </div>
            )}
            <button type="submit" className="lp-submit" disabled={fpLoading}>
              {fpLoading ? <span className="lp-spinner" /> : "Reset Password →"}
            </button>
          </form>
        </>
      );
    }

    // ── Forgot password done ───────────────────────────────────────────────
    if (step === "fp-done") {
      return (
        <>
          <div className="lp-right-header">
            <h2>Password reset!</h2>
            <p>Your password has been successfully updated.</p>
          </div>
          <div className="lp-field">
            <div className="rounded-lg p-4 text-[0.85rem]" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)" }}>
              Password reset! You can now sign in with your new password.
            </div>
          </div>
          <button type="button" className="lp-submit" onClick={goToLogin}>
            Back to sign in →
          </button>
        </>
      );
    }

    // ── Default: login form ────────────────────────────────────────────────
    return (
      <>
        <div className="lp-right-header">
          <h2>Welcome back</h2>
          <p>Sign in to your organization's workspace</p>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          {/* Username */}
          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-user">Username or Email</label>
            <div className="lp-input-wrap">
              <div className="lp-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <input
                id="lp-user"
                type="text"
                className={`lp-input${error ? " lp-input--err" : ""}`}
                placeholder="admin or admin@timesheet.local"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="lp-field">
            <div className="lp-label-row">
              <label className="lp-label" htmlFor="lp-pass">Password</label>
              <button
                type="button"
                className="lp-forgot"
                onClick={() => { resetFpState(); setError(""); setStep("fp-username"); }}
              >
                Forgot password?
              </button>
            </div>
            <div className="lp-input-wrap">
              <div className="lp-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <input
                id="lp-pass"
                type="password"
                className={`lp-input${error ? " lp-input--err" : ""}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Remember me */}
          <div className="lp-row2">
            <label className="lp-checkbox-label">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="[accent-color:var(--brand-500)] cursor-pointer" />
              Keep me signed in
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="lp-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="lp-submit" disabled={loading}>
            {loading ? <span className="lp-spinner" /> : "Sign in to TimeSheet →"}
          </button>
        </form>

        {/* Trust bar */}
        <div className="lp-trust">
          <div className="lp-trust-item"><span>🔒</span> SOC 2 Type II</div>
          <div className="lp-trust-item"><span>✓</span> GDPR Compliant</div>
          <div className="lp-trust-item"><span>🛡</span> 256-bit SSL</div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Background */}
      <div className="lp-bg">
        <div className="lp-pattern" />
        <div className="lp-dots" />

        <div className="lp-wrapper">
          <div className="lp-card">

            {/* ── Left panel ── */}
            <div className="lp-left">
              <div className="lp-left-pattern" />
              <div className="lp-left-orb1" />
              <div className="lp-left-orb2" />

              {/* Brand */}
              <div className="lp-brand">
                <div className="lp-brand-icon">⏱</div>
                <span className="lp-brand-name">TimeSheet</span>
              </div>

              {/* Headline */}
              <div className="lp-headline">
                <h1>Time tracking<br /><span>that actually</span><br />works.</h1>
                <p>Precise timesheet management, smart approvals, and team visibility — built for modern enterprises.</p>
                <div className="lp-features">
                  <div className="lp-feature"><div className="lp-feat-icon">⚡</div>One-click time entry with AI-suggested tasks</div>
                  <div className="lp-feature"><div className="lp-feat-icon">✓</div>Multi-level approval workflows</div>
                  <div className="lp-feature"><div className="lp-feat-icon">📊</div>Real-time project budget tracking</div>
                  <div className="lp-feature"><div className="lp-feat-icon">🔒</div>Enterprise SSO &amp; SAML 2.0 ready</div>
                </div>
              </div>

              {/* Testimonial */}
              <div className="lp-testimonial">
                <div className="lp-quote">"TimeSheet cut our timesheet processing time by 70%. Our entire team loves it."</div>
                <div className="lp-author">
                  <div className="lp-author-av">TS</div>
                  Team Lead — Enterprise Workforce Management
                </div>
              </div>
            </div>

            {/* ── Right panel ── */}
            <div className="lp-right">
              {renderRight()}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
