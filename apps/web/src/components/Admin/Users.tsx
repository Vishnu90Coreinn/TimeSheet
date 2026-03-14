import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { Department, User, WorkPolicy } from "../../types";

type UserForm = {
  username: string; email: string; employeeId: string; password: string;
  role: string; isActive: boolean; departmentId: string; workPolicyId: string; managerId: string;
};

const BLANK: UserForm = { username: "", email: "", employeeId: "", password: "", role: "employee", isActive: true, departmentId: "", workPolicyId: "", managerId: "" };

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [policies, setPolicies] = useState<WorkPolicy[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(BLANK);
  const [error, setError] = useState("");

  async function load(q = "") {
    const r = await apiFetch(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (r.ok) setUsers(await r.json());
  }

  useEffect(() => {
    void load();
    apiFetch("/masters/departments").then(async (r) => { if (r.ok) setDepartments(await r.json()); });
    apiFetch("/masters/work-policies").then(async (r) => { if (r.ok) setPolicies(await r.json()); });
  }, []);

  function openCreate() {
    setForm(BLANK);
    setError("");
    setEditing("new");
  }

  function openEdit(u: User) {
    setForm({ username: u.username, email: u.email, employeeId: u.employeeId, password: "", role: u.role, isActive: u.isActive, departmentId: u.departmentId ?? "", workPolicyId: u.workPolicyId ?? "", managerId: u.managerId ?? "" });
    setError("");
    setEditing(u);
  }

  async function save() {
    setError("");
    const body = {
      username: form.username, email: form.email, employeeId: form.employeeId, role: form.role,
      isActive: form.isActive, departmentId: form.departmentId || null, workPolicyId: form.workPolicyId || null, managerId: form.managerId || null,
      ...(editing === "new" ? { password: form.password } : {}),
    };
    const r = editing === "new"
      ? await apiFetch("/users", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/users/${(editing as User).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(search); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function toggleActive(u: User) {
    const body = { username: u.username, email: u.email, employeeId: u.employeeId, role: u.role, isActive: !u.isActive, departmentId: u.departmentId, workPolicyId: u.workPolicyId, managerId: u.managerId };
    await apiFetch(`/users/${u.id}`, { method: "PUT", body: JSON.stringify(body) });
    void load(search);
  }

  const f = (k: keyof UserForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <section>
      <h2>User Management</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <input placeholder="Search username / email / ID…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button onClick={() => void load(search)}>Search</button>
        <button onClick={openCreate}>+ New User</button>
      </div>

      {editing && (
        <div style={{ border: "1px solid #ccc", padding: "16px", borderRadius: "4px", marginBottom: "16px" }}>
          <h3>{editing === "new" ? "Create User" : `Edit: ${(editing as User).username}`}</h3>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <label>Username<input value={form.username} onChange={(e) => f("username", e.target.value)} /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} /></label>
            <label>Employee ID<input value={form.employeeId} onChange={(e) => f("employeeId", e.target.value)} /></label>
            {editing === "new" && <label>Password<input type="password" value={form.password} onChange={(e) => f("password", e.target.value)} /></label>}
            <label>Role
              <select value={form.role} onChange={(e) => f("role", e.target.value)}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Department
              <select value={form.departmentId} onChange={(e) => f("departmentId", e.target.value)}>
                <option value="">— none —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Work Policy
              <select value={form.workPolicyId} onChange={(e) => f("workPolicyId", e.target.value)}>
                <option value="">— none —</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Manager
              <select value={form.managerId} onChange={(e) => f("managerId", e.target.value)}>
                <option value="">— none —</option>
                {users.filter((u) => editing === "new" || (editing as User).id !== u.id).map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} /> Active
            </label>
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button onClick={() => void save()}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            {["Username", "Email", "Employee ID", "Role", "Department", "Manager", "Active", "Actions"].map((h) => (
              <th key={h} style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
              <td style={{ padding: "6px 8px" }}>{u.username}</td>
              <td style={{ padding: "6px 8px" }}>{u.email}</td>
              <td style={{ padding: "6px 8px" }}>{u.employeeId}</td>
              <td style={{ padding: "6px 8px" }}>{u.role}</td>
              <td style={{ padding: "6px 8px" }}>{u.departmentName ?? "—"}</td>
              <td style={{ padding: "6px 8px" }}>{u.managerUsername ?? "—"}</td>
              <td style={{ padding: "6px 8px" }}>{u.isActive ? "Yes" : "No"}</td>
              <td style={{ padding: "6px 8px", display: "flex", gap: "4px" }}>
                <button onClick={() => openEdit(u)}>Edit</button>
                <button onClick={() => void toggleActive(u)}>{u.isActive ? "Deactivate" : "Activate"}</button>
              </td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: "16px", color: "#888" }}>No users found</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
