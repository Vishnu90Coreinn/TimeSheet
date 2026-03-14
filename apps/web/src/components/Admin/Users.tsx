/**
 * Users.tsx — Design system applied (Step 3).
 * All business logic and API calls are unchanged.
 */
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

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }
  function openEdit(u: User) {
    setForm({ username: u.username, email: u.email, employeeId: u.employeeId, password: "", role: u.role, isActive: u.isActive, departmentId: u.departmentId ?? "", workPolicyId: u.workPolicyId ?? "", managerId: u.managerId ?? "" });
    setError(""); setEditing(u);
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
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="page-title" style={{ margin: 0 }}>User Management</h1>
        <button className="btn-primary" onClick={openCreate}>+ New User</button>
      </div>

      {/* Search bar */}
      <div className="card-flat" style={{ display: "flex", gap: "var(--space-3)" }}>
        <input
          className="input-field"
          placeholder="Search by username, email or employee ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load(search)}
          style={{ flex: 1 }}
        />
        <button className="btn-secondary" onClick={() => void load(search)}>Search</button>
      </div>

      {/* Edit / Create form */}
      {editing && (
        <div className="card">
          <h2 className="section-title">{editing === "new" ? "Create User" : `Edit: ${(editing as User).username}`}</h2>
          {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-field">
              <label className="form-label" htmlFor="u-username">Username <span className="required">*</span></label>
              <input id="u-username" className="input-field" value={form.username} onChange={(e) => f("username", e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-email">Email <span className="required">*</span></label>
              <input id="u-email" type="email" className="input-field" value={form.email} onChange={(e) => f("email", e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-empid">Employee ID <span className="required">*</span></label>
              <input id="u-empid" className="input-field" value={form.employeeId} onChange={(e) => f("employeeId", e.target.value)} />
            </div>
            {editing === "new" && (
              <div className="form-field">
                <label className="form-label" htmlFor="u-pwd">Password <span className="required">*</span></label>
                <input id="u-pwd" type="password" className="input-field" value={form.password} onChange={(e) => f("password", e.target.value)} />
              </div>
            )}
            <div className="form-field">
              <label className="form-label" htmlFor="u-role">Role</label>
              <select id="u-role" className="input-field" value={form.role} onChange={(e) => f("role", e.target.value)}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-dept">Department</label>
              <select id="u-dept" className="input-field" value={form.departmentId} onChange={(e) => f("departmentId", e.target.value)}>
                <option value="">— none —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-policy">Work Policy</label>
              <select id="u-policy" className="input-field" value={form.workPolicyId} onChange={(e) => f("workPolicyId", e.target.value)}>
                <option value="">— none —</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-mgr">Manager</label>
              <select id="u-mgr" className="input-field" value={form.managerId} onChange={(e) => f("managerId", e.target.value)}>
                <option value="">— none —</option>
                {users.filter((u) => editing === "new" || (editing as User).id !== u.id).map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", alignSelf: "end", paddingBottom: "10px" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} style={{ accentColor: "var(--color-primary)" }} />
              Active
            </label>
          </div>
          <div className="flex gap-3 mt-6">
            <button className="btn-primary" onClick={() => void save()}>Save</button>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table-base">
            <thead>
              <tr><th>Username</th><th>Email</th><th>Employee ID</th><th>Role</th><th>Department</th><th>Manager</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
                  <td style={{ fontWeight: "var(--font-medium)" }}>{u.username}</td>
                  <td style={{ color: "var(--color-text-secondary)" }}>{u.email}</td>
                  <td><code style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", background: "var(--color-surface)", padding: "2px 5px", borderRadius: "var(--radius-sm)" }}>{u.employeeId}</code></td>
                  <td><span className={`badge ${u.role === "admin" ? "badge-error" : u.role === "manager" ? "badge-warning" : "badge-blue"}`}>{u.role}</span></td>
                  <td style={{ color: "var(--color-text-secondary)" }}>{u.departmentName ?? "—"}</td>
                  <td style={{ color: "var(--color-text-secondary)" }}>{u.managerUsername ?? "—"}</td>
                  <td>{u.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-ghost" style={{ fontSize: "var(--text-xs)" }} onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn-secondary" style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }} onClick={() => void toggleActive(u)}>
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr className="empty-row"><td colSpan={8}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
