import { useState } from "react";

type LoginResponse = {
  accessToken: string;
  userId: string;
  username: string;
  role: string;
};

export function App() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [message, setMessage] = useState("Not logged in");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("https://localhost:7012/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      setMessage("Login failed");
      return;
    }
    const data = (await response.json()) as LoginResponse;
    setMessage(`Logged in as ${data.username} (${data.role})`);
  }

  return (
    <main className="container">
      <h1>TimeSheet Management</h1>
      <p>Starter login flow for project bootstrap.</p>
      <form onSubmit={onSubmit} className="card">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit">Login</button>
      </form>
      <p>{message}</p>
    </main>
  );
}
