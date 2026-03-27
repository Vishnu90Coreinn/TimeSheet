/**
 * Login.tsx — Pulse SaaS design v3.0
 * Left: gradient brand panel with features + testimonial
 * Right: clean sign-in form
 */
import { FormEvent, useState } from "react";
import { API_BASE } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import type { Session } from "../types";

interface LoginProps {
  onLogin: (session: Session) => void;
}

export function Login({ onLogin }: LoginProps) {
  const toast = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

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
      const data = await response.json();
        onLogin({
          userId:       data.userId ?? "",
          accessToken:  data.accessToken,
          refreshToken: data.refreshToken,
          username:     data.username,
          role:         data.role,
          onboardingCompletedAt: data.onboardingCompletedAt ?? null,
          leaveWorkflowVisitedAt: data.leaveWorkflowVisitedAt ?? null,
        });
    } catch {
      const msg = "Connection error. Please try again.";
      setError(msg);
      toast.error("Login failed", msg);
    } finally {
      setLoading(false);
    }
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
              <div className="lp-right-header">
                <h2>Welcome back</h2>
                <p>Sign in to your organization's workspace</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
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
                    <button type="button" className="lp-forgot" onClick={() => setError("Contact your admin to reset password.")}>
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
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

