/**
 * Login.tsx — Task 5: Redesigned login page.
 * Palette: white + blue (#1E40AF, #3B82F6, #EFF6FF, #1D4ED8).
 * Fonts: Plus Jakarta Sans (headings) + Inter (body) — loaded via index.html.
 * Layout: split-panel on desktop, single-card on mobile.
 * Auth flow is unchanged — calls /auth/login and fires onLogin callback.
 */
import { FormEvent, useState } from "react";
import { API_BASE } from "../api/client";
import type { Session } from "../types";

interface LoginProps {
  onLogin: (session: Session) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        userId: data.userId ?? "",
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        username: data.username,
        role: data.role,
      });
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{loginStyles}</style>
      <div className="login-root">
        {/* Left decorative panel — hidden on mobile */}
        <aside className="login-panel" aria-hidden="true">
          <div className="login-panel__inner">
            <div className="login-panel__logo">
              <TimesheetIcon color="white" size={40} />
              <span className="login-panel__app-name">TimeSheet</span>
            </div>
            <h2 className="login-panel__headline">
              Track time.<br />Work smarter.
            </h2>
            <p className="login-panel__sub">
              Unified timesheet and attendance management for modern teams.
            </p>
            <div className="login-panel__dots">
              <span /><span /><span />
            </div>
          </div>
          <svg className="login-panel__bg-shape" viewBox="0 0 400 400" fill="none">
            <circle cx="340" cy="60" r="120" fill="white" fillOpacity="0.05" />
            <circle cx="60" cy="340" r="160" fill="white" fillOpacity="0.05" />
            <circle cx="340" cy="60" r="70" fill="white" fillOpacity="0.06" />
          </svg>
        </aside>

        {/* Right form panel */}
        <main className="login-form-panel">
          <div className="login-card">
            {/* Mobile-only logo */}
            <div className="login-card__mobile-logo" aria-hidden="true">
              <TimesheetIcon color="#6366F1" size={32} />
              <span>TimeSheet</span>
            </div>

            <h1 className="login-card__title">Welcome back</h1>
            <p className="login-card__subtitle">Sign in to your account to continue</p>

            <form onSubmit={handleSubmit} noValidate className="login-form">
              {/* Identifier */}
              <div className="login-field">
                <label htmlFor="login-identifier" className="login-label">
                  Username or Email <span className="login-required" aria-hidden="true">*</span>
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  className={`login-input${error ? " login-input--error" : ""}`}
                  placeholder="admin or admin@timesheet.local"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              {/* Password */}
              <div className="login-field">
                <div className="login-label-row">
                  <label htmlFor="login-password" className="login-label">
                    Password <span className="login-required" aria-hidden="true">*</span>
                  </label>
                  <button
                    type="button"
                    className="login-forgot"
                    onClick={() => setError("Password reset is not yet available. Contact your admin.")}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className={`login-input login-input--password${error ? " login-input--error" : ""}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="login-remember">
                <label className="login-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="login-checkbox"
                  />
                  Remember me for 30 days
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="login-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? <span className="login-btn__spinner" /> : "Sign In"}
              </button>
            </form>
          </div>
        </main>
      </div>
    </>
  );
}

function TimesheetIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill={color === "white" ? "rgba(255,255,255,0.15)" : "#EEF2FF"} />
      <path d="M20 8L32 14V26L20 32L8 26V14L20 8Z" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="20" cy="20" r="4" fill={color} />
    </svg>
  );
}

/* ─── Scoped styles (no global pollution) ─────────────────────────────────── */
const loginStyles = `
  .login-root {
    display: flex;
    min-height: 100vh;
    background: #0F172A;
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* Left decorative panel */
  .login-panel {
    position: relative;
    flex: 0 0 42%;
    background: linear-gradient(145deg, #312E81 0%, #4338CA 45%, #6366F1 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  /* Mesh grid overlay */
  .login-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  @media (max-width: 768px) { .login-panel { display: none; } }

  .login-panel__inner {
    position: relative;
    z-index: 1;
    padding: 48px;
    color: white;
  }
  .login-panel__logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 56px;
  }
  .login-panel__app-name {
    font-family: var(--font-display), sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: white;
    letter-spacing: -0.3px;
  }
  .login-panel__headline {
    font-family: var(--font-display), sans-serif;
    font-size: 38px;
    font-weight: 700;
    line-height: 1.18;
    margin: 0 0 16px;
    color: white;
    letter-spacing: -0.6px;
  }
  .login-panel__sub {
    font-size: 15px;
    line-height: 1.65;
    color: rgba(255,255,255,0.65);
    margin: 0 0 48px;
    max-width: 280px;
  }
  .login-panel__dots {
    display: flex;
    gap: 8px;
  }
  .login-panel__dots span {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: rgba(255,255,255,0.3);
  }
  .login-panel__dots span:first-child { background: white; width: 24px; border-radius: 4px; }
  .login-panel__bg-shape {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
  }

  /* Right form panel */
  .login-form-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #F8FAFC;
    animation: loginFadeIn 0.45s ease both;
  }
  @keyframes loginFadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .login-card {
    width: 100%;
    max-width: 420px;
    background: white;
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.04);
    border: 1px solid rgba(226,232,240,0.8);
  }

  .login-card__mobile-logo {
    display: none;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
    font-family: var(--font-display), sans-serif;
    font-weight: 700;
    font-size: 18px;
    color: #6366F1;
  }
  @media (max-width: 768px) { .login-card__mobile-logo { display: flex; } }

  .login-card__title {
    font-family: var(--font-display), sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #0F172A;
    margin: 0 0 6px;
    letter-spacing: -0.5px;
  }
  .login-card__subtitle {
    font-size: 14px;
    color: #64748B;
    margin: 0 0 32px;
  }

  /* Form */
  .login-form { display: flex; flex-direction: column; gap: 20px; }
  .login-field { display: flex; flex-direction: column; gap: 6px; }

  .login-label {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    letter-spacing: 0.01em;
  }
  .login-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .login-required { color: #EF4444; }

  .login-forgot {
    font-size: 12px;
    color: #6366F1;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .login-forgot:hover { color: #4F46E5; }

  .login-input-wrap { position: relative; }
  .login-input {
    width: 100%;
    box-sizing: border-box;
    padding: 11px 14px;
    border: 1.5px solid #E2E8F0;
    border-radius: 8px;
    font-size: 14px;
    font-family: 'Inter', system-ui, sans-serif;
    color: #0F172A;
    background: #F8FAFC;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
    margin: 0;
  }
  .login-input:focus {
    border-color: #6366F1;
    background: white;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.18);
  }
  .login-input--error { border-color: #EF4444 !important; }
  .login-input--password { padding-right: 44px; }

  .login-eye {
    position: absolute;
    right: 12px; top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: #94A3B8;
    display: flex;
    align-items: center;
  }
  .login-eye:hover { color: #475569; }

  /* Remember me */
  .login-remember { margin-top: -4px; }
  .login-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #4B5563;
    cursor: pointer;
    user-select: none;
  }
  .login-checkbox {
    width: 15px; height: 15px;
    accent-color: #6366F1;
    cursor: pointer;
    margin: 0;
  }

  /* Error banner */
  .login-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 8px;
    font-size: 13px;
    color: #DC2626;
  }

  /* Submit button */
  .login-btn {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #818CF8 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-family: var(--font-display), sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.01em;
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.15s;
    margin-top: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
  }
  .login-btn:hover:not(:disabled) {
    box-shadow: 0 4px 20px rgba(99,102,241,0.45);
    transform: translateY(-1px);
  }
  .login-btn:active:not(:disabled) { transform: translateY(0); }
  .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .login-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
    background-size: 200% 100%;
    background-position: -100% 0;
    transition: background-position 0.5s;
  }
  .login-btn:hover::after { background-position: 100% 0; }

  .login-btn__spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: white;
    border-radius: 50%;
    animation: loginSpin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes loginSpin { to { transform: rotate(360deg); } }
`;
