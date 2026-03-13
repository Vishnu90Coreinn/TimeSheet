import { FormEvent, useEffect, useMemo, useState } from "react";

type Session = { accessToken: string; refreshToken: string; username: string; role: string };
type User = { id: string; username: string; email: string; role: string; isActive: boolean };
type Project = { id: string; name: string; code: string; isActive: boolean; isArchived: boolean };
type TaskCategory = { id: string; name: string; isActive: boolean };

type View = "dashboard" | "projects" | "categories";

const API_BASE = "http://localhost:5000/api/v1";

export function App() {
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [me, setMe] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [projectForm, setProjectForm] = useState({ name: "", code: "", isActive: true });
  const [categoryForm, setCategoryForm] = useState({ name: "", isActive: true });

  const isAdmin = session?.role === "admin";

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");
    if (accessToken && refreshToken && username && role) {
      setSession({ accessToken, refreshToken, username, role });
    }
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    void loadMe();
    void loadTimesheetOptions();
    if (isAdmin) {
      void loadProjectAdmin();
      void loadCategoryAdmin();
    }
  }, [session, isAdmin]);

  const nav = useMemo(() => ["dashboard", ...(isAdmin ? ["projects", "categories"] : [])] as View[], [isAdmin]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });
    if (!response.ok) {
      setError("Invalid username/email or password.");
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

  function persistSession(nextSession: Session) {
    localStorage.setItem("accessToken", nextSession.accessToken);
    localStorage.setItem("refreshToken", nextSession.refreshToken);
    localStorage.setItem("username", nextSession.username);
    localStorage.setItem("role", nextSession.role);
  }

  async function authed(path: string, init?: RequestInit) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.accessToken}`,
        ...(init?.headers ?? {})
      }
    });
    return response;
  }

  async function loadMe() {
    const response = await authed("/auth/me");
    if (response.ok) {
      setMe(await response.json());
    }
  }

  async function loadTimesheetOptions() {
    await authed("/timesheets/entry-options");
  }

  async function loadProjectAdmin() {
    const response = await authed("/projects");
    if (response.ok) {
      setProjects(await response.json());
    }
  }

  async function loadCategoryAdmin() {
    const response = await authed("/task-categories/admin");
    if (response.ok) {
      setCategories(await response.json());
    }
  }

  async function createProject(e: FormEvent) {
    e.preventDefault();
    const response = await authed("/projects", { method: "POST", body: JSON.stringify(projectForm) });
    if (response.ok) {
      setProjectForm({ name: "", code: "", isActive: true });
      await loadProjectAdmin();
    }
  }

  async function archiveProject(id: string) {
    const response = await authed(`/projects/${id}/archive`, { method: "POST" });
    if (response.ok) {
      await loadProjectAdmin();
    }
  }

  async function createCategory(e: FormEvent) {
    e.preventDefault();
    const response = await authed("/task-categories", { method: "POST", body: JSON.stringify(categoryForm) });
    if (response.ok) {
      setCategoryForm({ name: "", isActive: true });
      await loadCategoryAdmin();
    }
  }

  async function toggleCategory(category: TaskCategory) {
    const response = await authed(`/task-categories/${category.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: category.name, isActive: !category.isActive })
    });
    if (response.ok) {
      await loadCategoryAdmin();
    }
  }

  async function logout() {
    localStorage.clear();
    setSession(null);
    setMe(null);
  }

  if (!session) {
    return (
      <main className="container">
        <h1>TimeSheet Login</h1>
        <form className="card" onSubmit={onLogin}>
          <label>
            Username or email
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit">Sign in</button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="actions wrap">
        {nav.map((v) => (
          <button key={v} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
        <button onClick={() => void logout()}>Logout</button>
      </div>

      {view === "dashboard" && (
        <section>
          <h2>Dashboard</h2>
          <p>Welcome {me?.username ?? session.username}</p>
          <p>Role: {session.role}</p>
          {!isAdmin && <p>Role-based guard active: admin modules are hidden.</p>}
        </section>
      )}

      {view === "projects" && isAdmin && (
        <section>
          <h2>Project Admin</h2>
          <form className="actions" onSubmit={createProject}>
            <input placeholder="Name" value={projectForm.name} onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))} />
            <input placeholder="Code" value={projectForm.code} onChange={(e) => setProjectForm((p) => ({ ...p, code: e.target.value }))} />
            <button type="submit">Create</button>
          </form>
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                {project.name} ({project.code}) - {project.isArchived ? "archived" : project.isActive ? "active" : "inactive"}
                {!project.isArchived && <button onClick={() => void archiveProject(project.id)}>Archive</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "categories" && isAdmin && (
        <section>
          <h2>Task Category Admin</h2>
          <form className="actions" onSubmit={createCategory}>
            <input placeholder="Name" value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} />
            <button type="submit">Create</button>
          </form>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>
                {category.name} ({category.isActive ? "active" : "inactive"})
                <button onClick={() => void toggleCategory(category)}>Toggle status</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
