/**
 * Login.tsx — Precision Atelier UI-2.0
 * Left: dark brand panel (40%) with logo, features
 * Right: clean centered form card (60%)
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="lp-root">

      {/* ── Left panel (40%) ── */}
      <div className="lp-left">
        {/* Logo mark */}
        <div className="lp-logo-wrap">
          <span className="lp-logo-mark">T</span>
          <span className="lp-logo-name">Temporal</span>
        </div>

        {/* Tagline */}
        <p className="lp-tagline">Precision time tracking for modern teams.</p>

        {/* Feature list */}
        <ul className="lp-features">
          <li className="lp-feature">
            <span className="material-symbols-outlined lp-feat-icon">schedule</span>
            <span className="lp-feat-text">One-click time entry with smart suggestions</span>
          </li>
          <li className="lp-feature">
            <span className="material-symbols-outlined lp-feat-icon">insert_chart</span>
            <span className="lp-feat-text">Real-time project budget analytics</span>
          </li>
          <li className="lp-feature">
            <span className="material-symbols-outlined lp-feat-icon">groups</span>
            <span className="lp-feat-text">Multi-level team approval workflows</span>
          </li>
        </ul>
      </div>

      {/* ── Right panel (60%) ── */}
      <div className="lp-right">
        <div className="lp-card">
          {/* Heading */}
          <div className="lp-card-header">
            <h1 className="lp-heading">Welcome back</h1>
            <p className="lp-subtext">Sign in to your organization's workspace</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email / Username */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-user">Username or Email</label>
              <input
                id="lp-user"
                type="text"
                className="lp-input"
                placeholder="admin or admin@timesheet.local"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-pass">Password</label>
              <div className="lp-pass-wrap">
                <input
                  id="lp-pass"
                  type={showPassword ? "text" : "password"}
                  className="lp-input lp-input--pass"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lp-vis-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="lp-remember-row">
              <label className="lp-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: "var(--primary)" }}
                />
                Keep me signed in
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="lp-error" role="alert">
                <span className="material-symbols-outlined lp-error-icon">error</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="lp-submit" disabled={loading}>
              {loading ? <span className="lp-spinner" /> : "Sign In"}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
