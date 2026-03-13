import { useEffect, useState } from "react";

type Session = {
  accessToken: string;
  refreshToken: string;
  username: string;
  role: string;
};

type CurrentUser = {
  id: string;
  username: string;
  email: string;
  employeeId: string;
  role: string;
  isActive: boolean;
};

const API_BASE_URL = "http://localhost:5000/api/v1";

type View = "dashboard" | "admin";

export function App() {
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    const savedToken = localStorage.getItem("accessToken");
    const savedRefreshToken = localStorage.getItem("refreshToken");
    const savedUser = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");

    if (savedToken && savedRefreshToken && savedUser && savedRole) {
      setSession({ accessToken: savedToken, refreshToken: savedRefreshToken, username: savedUser, role: savedRole });
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setCurrentUser(null);
      return;
    }

    void fetchCurrentUser(session);
  }, [session]);

  async function fetchCurrentUser(activeSession: Session) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${activeSession.accessToken}` }
      });

      if (response.status === 401) {
        const refreshed = await refreshSession(activeSession.refreshToken);
        if (!refreshed) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        const retryResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${refreshed.accessToken}` }
        });

        if (!retryResponse.ok) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        const retryData = (await retryResponse.json()) as CurrentUser;
        setCurrentUser(retryData);
        return;
      }

      if (!response.ok) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const data = (await response.json()) as CurrentUser;
      setCurrentUser(data);
    } catch (message) {
      setError((message as Error).message);
      onLogout();
    }
  }

  async function refreshSession(refreshToken: string) {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });

    if (!refreshResponse.ok) {
      return null;
    }

    const refreshed = await refreshResponse.json();
    const nextSession = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      username: refreshed.username,
      role: refreshed.role
    };

    persistSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });

    if (!response.ok) {
      setError("Login failed. Check username/email and password.");
      return;
    }

    const data = await response.json();
    const nextSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      username: data.username,
      role: data.role
    };

    persistSession(nextSession);
    setSession(nextSession);
  }

  async function onLogout() {
    const refreshToken = localStorage.getItem("refreshToken");
    const accessToken = localStorage.getItem("accessToken");

    if (refreshToken && accessToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ refreshToken })
      });
    }

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setSession(null);
  }

  function persistSession(nextSession: Session) {
    localStorage.setItem("accessToken", nextSession.accessToken);
    localStorage.setItem("refreshToken", nextSession.refreshToken);
    localStorage.setItem("username", nextSession.username);
    localStorage.setItem("role", nextSession.role);
  }

  return (
    <main className="container">
      <h1>TimeSheet Management</h1>
      {!session ? (
        <>
          <p>Sign in with your username or email.</p>
          <form onSubmit={onSubmit} className="card">
            <label>
              Username / Email
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button type="submit">Login</button>
          </form>
          {error && <p className="error">{error}</p>}
        </>
      ) : (
        <section className="card">
          <p>
            Logged in as <strong>{session.username}</strong> ({session.role})
          </p>
          <div className="actions">
            <button onClick={() => setView("dashboard")}>Dashboard</button>
            <button onClick={() => setView("admin")}>Admin</button>
          </div>

          {view === "dashboard" && currentUser && (
            <ul>
              <li>Employee ID: {currentUser.employeeId}</li>
              <li>Email: {currentUser.email}</li>
              <li>Status: {currentUser.isActive ? "Active" : "Inactive"}</li>
            </ul>
          )}

          {view === "admin" && session.role === "admin" ? (
            <p>Protected admin area unlocked.</p>
          ) : null}

          {view === "admin" && session.role !== "admin" ? (
            <p className="error">You do not have permission to access the admin area.</p>
          ) : null}

          <button onClick={() => void onLogout()}>Logout</button>
        </section>
      )}
    </main>
  );
}
