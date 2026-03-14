import { FormEvent, useState } from "react";
import { API_BASE } from "../api/client";
import type { Session } from "../types";

interface LoginProps {
  onLogin: (session: Session) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
        setError("Invalid username/email or password.");
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
    <main className="container">
      <h1>Timesheet</h1>
      <form className="card" onSubmit={handleSubmit}>
        <input
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Logging in\u2026" : "Login"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
