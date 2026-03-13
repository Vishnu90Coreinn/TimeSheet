import { useEffect, useState } from "react";

type Session = {
  accessToken: string;
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

export function App() {
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("accessToken");
    const savedUser = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");

    if (savedToken && savedUser && savedRole) {
      setSession({ accessToken: savedToken, username: savedUser, role: savedRole });
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setCurrentUser(null);
      return;
    }

    void fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Your session has expired. Please sign in again.");
        }
        return response.json();
      })
      .then((data: CurrentUser) => {
        setCurrentUser(data);
      })
      .catch((message: Error) => {
        setError(message.message);
        onLogout();
      });
  }, [session]);

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
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("username", data.username);
    localStorage.setItem("role", data.role);

    setSession({ accessToken: data.accessToken, username: data.username, role: data.role });
  }

  function onLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setSession(null);
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
          {currentUser && (
            <ul>
              <li>Employee ID: {currentUser.employeeId}</li>
              <li>Email: {currentUser.email}</li>
              <li>Status: {currentUser.isActive ? "Active" : "Inactive"}</li>
            </ul>
          )}
          <button onClick={onLogout}>Logout</button>
        </section>
      )}
    </main>
  );
}
