import { useState } from "react";

export function App() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [message, setMessage] = useState("Not logged in");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("http://localhost:5000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      setMessage("Login failed");
      return;
    }
    const data = await response.json();
    setMessage(`Logged in as ${data.user.username} (${data.user.role})`);
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
