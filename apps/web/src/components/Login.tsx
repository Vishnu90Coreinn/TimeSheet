/**
 * Login.tsx — v3.0 exact Pulse reference layout
 * Left: gradient brand panel with features + testimonial
 * Right: clean sign-in form
 */
import { FormEvent, useState } from "react";
import { API_BASE } from "../api/client";
import type { Session } from "../types";

interface LoginProps {
  onLogin: (session: Session) => void;
}

export function Login({ onLogin }: LoginProps) {
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
        setError((body as { detail?: string }).detail ?? "Invalid username/email or password.");
        return;
      }
      const data = await response.json();
      onLogin({
        userId:       data.userId ?? "",
        accessToken:  data.accessToken,
        refreshToken: data.refreshToken,
        username:     data.username,
        role:         data.role,
      });
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{STYLES}</style>

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
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ accentColor: "var(--brand-500)", cursor: "pointer" }} />
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

const STYLES = `
  .lp-bg {
    min-height: 100vh; background: var(--n-50);
    display: flex; align-items: stretch;
    position: relative; overflow: hidden;
  }
  .lp-pattern {
    position: fixed; inset: 0; z-index: 0;
    background-image:
      radial-gradient(circle at 20% 20%, rgba(99,102,241,0.06) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(99,102,241,0.04) 0%, transparent 50%);
  }
  .lp-dots {
    position: fixed; inset: 0; z-index: 0;
    background-image: radial-gradient(circle, var(--n-200) 1px, transparent 1px);
    background-size: 28px 28px; opacity: 0.7;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%);
  }
  .lp-wrapper {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    width: 100%; min-height: 100vh; padding: 24px;
  }
  .lp-card {
    background: var(--n-0);
    border: 1px solid var(--border-default);
    border-radius: var(--r-2xl);
    box-shadow: var(--shadow-xl);
    width: 100%; max-width: 960px;
    display: grid; grid-template-columns: 1fr 1fr;
    overflow: hidden;
    animation: lpReveal 0.5s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes lpReveal {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @media (max-width: 720px) { .lp-card { grid-template-columns: 1fr; } .lp-left { display: none; } }

  /* Left */
  .lp-left {
    background: linear-gradient(145deg, var(--brand-700) 0%, var(--brand-600) 40%, var(--brand-500) 100%);
    padding: 48px 40px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative; overflow: hidden;
  }
  .lp-left-pattern {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 32px 32px;
  }
  .lp-left-orb1 {
    position: absolute; top: -80px; right: -80px;
    width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
  }
  .lp-left-orb2 {
    position: absolute; bottom: -60px; left: -60px;
    width: 250px; height: 250px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%);
  }
  .lp-brand {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 48px;
  }
  .lp-brand-icon {
    width: 36px; height: 36px;
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: var(--r-lg);
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem;
  }
  .lp-brand-name {
    font-family: var(--font-display);
    font-size: 1.25rem; font-weight: 700;
    color: #fff; letter-spacing: -0.02em;
  }
  .lp-headline {
    position: relative; z-index: 1; flex: 1;
  }
  .lp-headline h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 2.5vw, 2.25rem); font-weight: 700;
    color: #fff; line-height: 1.15; letter-spacing: -0.03em;
    margin-bottom: 16px;
  }
  .lp-headline h1 span { opacity: 0.65; }
  .lp-headline p {
    font-size: 0.875rem; color: rgba(255,255,255,0.65);
    line-height: 1.6; max-width: 280px; margin-bottom: 32px;
  }
  .lp-features { display: flex; flex-direction: column; gap: 12px; position: relative; z-index: 1; }
  .lp-feature {
    display: flex; align-items: center; gap: 12px;
    font-size: 0.8rem; color: rgba(255,255,255,0.8);
  }
  .lp-feat-icon {
    width: 26px; height: 26px;
    background: rgba(255,255,255,0.12);
    border-radius: var(--r-sm);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; flex-shrink: 0;
  }
  .lp-testimonial {
    position: relative; z-index: 1; margin-top: 32px;
    padding: 16px 20px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: var(--r-lg);
  }
  .lp-quote { font-size: 0.82rem; color: rgba(255,255,255,0.8); line-height: 1.6; font-style: italic; margin-bottom: 12px; }
  .lp-author { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.55); }
  .lp-author-av {
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.65rem; font-weight: 700; color: #fff;
  }

  /* Right */
  .lp-right { padding: 48px 40px; display: flex; flex-direction: column; justify-content: center; }
  .lp-right-header { margin-bottom: 32px; }
  .lp-right-header h2 {
    font-family: var(--font-display);
    font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em;
    color: var(--text-primary); margin-bottom: 4px;
  }
  .lp-right-header p { font-size: 0.875rem; color: var(--text-secondary); }

  .lp-field { margin-bottom: 16px; }
  .lp-label { display: block; font-size: 0.775rem; font-weight: 600; color: var(--text-primary); letter-spacing: 0.01em; margin-bottom: 8px; }
  .lp-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .lp-forgot { font-size: 0.775rem; font-weight: 500; color: var(--brand-600); background: none; border: none; cursor: pointer; padding: 0; }
  .lp-forgot:hover { text-decoration: underline; }

  .lp-input-wrap { position: relative; }
  .lp-input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); display: flex; align-items: center; pointer-events: none; }
  .lp-input {
    width: 100%; height: 42px;
    padding: 0 12px 0 36px;
    background: var(--surface-sunken);
    border: 1.5px solid var(--border-default);
    border-radius: var(--r-md);
    font-size: 0.875rem; font-family: var(--font-sans);
    color: var(--text-primary); outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    box-sizing: border-box;
  }
  .lp-input:hover { border-color: var(--border-strong); background: var(--n-0); }
  .lp-input:focus { border-color: var(--brand-400); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: var(--n-0); }
  .lp-input::placeholder { color: var(--text-tertiary); }
  .lp-input--err { border-color: var(--danger) !important; }

  .lp-row2 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .lp-checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.825rem; color: var(--text-secondary); cursor: pointer; }

  .lp-error {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; margin-bottom: 16px;
    background: var(--danger-light); border: 1px solid rgba(239,68,68,0.2);
    border-radius: var(--r-md); font-size: 0.825rem; color: var(--danger-dark);
  }

  .lp-submit {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; height: 42px;
    background: var(--brand-600); color: #fff;
    border: none; border-radius: var(--r-md);
    font-family: var(--font-sans); font-size: 0.875rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s; letter-spacing: 0.01em;
  }
  .lp-submit:hover:not(:disabled) { background: var(--brand-700); box-shadow: var(--shadow-brand); transform: translateY(-1px); }
  .lp-submit:active:not(:disabled) { transform: translateY(0); }
  .lp-submit:disabled { opacity: 0.55; cursor: not-allowed; }

  .lp-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff; border-radius: 50%;
    animation: lpSpin 0.7s linear infinite; display: inline-block;
  }
  @keyframes lpSpin { to { transform: rotate(360deg); } }

  .lp-trust {
    display: flex; align-items: center; justify-content: center; gap: 16px;
    margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle);
  }
  .lp-trust-item { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; color: var(--text-tertiary); font-weight: 500; }
`;
