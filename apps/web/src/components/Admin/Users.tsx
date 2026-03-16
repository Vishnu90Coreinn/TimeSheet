/**
 * Users.tsx — Pulse SaaS design v3.0
 */
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { Department, LeavePolicy, User, WorkPolicy } from "../../types";

type UserForm = {
  username: string; email: string; employeeId: string; password: string;
  role: string; isActive: boolean; departmentId: string; workPolicyId: string; leavePolicyId: string; managerId: string;
};
const BLANK: UserForm = { username: "", email: "", employeeId: "", password: "", role: "employee", isActive: true, departmentId: "", workPolicyId: "", leavePolicyId: "", managerId: "" };

const EMP_ID_RE = /^EMP-\d{4}$/;

function pwdStrength(pwd: string): "weak" | "medium" | "strong" | null {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return "weak";
  if (score <= 2) return "medium";
  return "strong";
}

function initials(name: string): string {
  return name.split(/[\s_]+/).map(p => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}

const AVATAR_PALETTE = ["#818cf8","#a78bfa","#34d399","#60a5fa","#f472b6","#fb923c","#4ade80","#38bdf8"];
function avatarColor(name: string): string {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function Drawer({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div className="drawer-title">{title}</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </>
  );
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [policies, setPolicies] = useState<WorkPolicy[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(BLANK);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  async function load() {
    const r = await apiFetch("/users");
    if (r.ok) setUsers(await r.json());
  }

  useEffect(() => {
    void load();
    apiFetch("/masters/departments").then(async (r) => { if (r.ok) setDepartments(await r.json()); });
    apiFetch("/masters/work-policies").then(async (r) => { if (r.ok) setPolicies(await r.json()); });
    apiFetch("/leave/policies").then(async (r) => { if (r.ok) setLeavePolicies(await r.json()); });
  }, []);

  function openCreate() { setForm(BLANK); setError(""); setShowPwd(false); setEditing("new"); }
  function openEdit(u: User) {
    setForm({ username: u.username, email: u.email, employeeId: u.employeeId, password: "", role: u.role, isActive: u.isActive, departmentId: u.departmentId ?? "", workPolicyId: u.workPolicyId ?? "", leavePolicyId: u.leavePolicyId ?? "", managerId: u.managerId ?? "" });
    setError(""); setShowPwd(false); setEditing(u);
  }

  async function save() {
    setError("");
    if (form.employeeId && !EMP_ID_RE.test(form.employeeId)) {
      setError("Employee ID must be in format EMP-XXXX (e.g. EMP-0001)");
      return;
    }
    const body = {
      username: form.username, email: form.email, employeeId: form.employeeId, role: form.role,
      isActive: form.isActive, departmentId: form.departmentId || null, workPolicyId: form.workPolicyId || null, leavePolicyId: form.leavePolicyId || null, managerId: form.managerId || null,
      ...(editing === "new" ? { password: form.password } : {}),
    };
    const r = editing === "new"
      ? await apiFetch("/users", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/users/${(editing as User).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function toggleActive(u: User) {
    const body = { username: u.username, email: u.email, employeeId: u.employeeId, role: u.role, isActive: !u.isActive, departmentId: u.departmentId, workPolicyId: u.workPolicyId, managerId: u.managerId };
    await apiFetch(`/users/${u.id}`, { method: "PUT", body: JSON.stringify(body) });
    void load();
  }

  const f = (k: keyof UserForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const strength = editing === "new" ? pwdStrength(form.password) : null;
  const strengthColor = strength === "strong" ? "var(--success)" : strength === "medium" ? "var(--warning)" : strength === "weak" ? "var(--danger)" : "transparent";

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.employeeId ?? "").toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const drawerTitle = editing === "new" ? "Create User" : editing ? `Edit: ${(editing as User).username}` : "";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Drawer form */}
      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => void save()}>Save</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
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
            <label className="form-label" htmlFor="u-empid">Employee ID</label>
            <input
              id="u-empid"
              className="input-field"
              value={form.employeeId}
              onChange={(e) => f("employeeId", e.target.value)}
              placeholder="EMP-0001"
            />
            {form.employeeId && !EMP_ID_RE.test(form.employeeId) && (
              <div style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: 3 }}>Format: EMP-XXXX (4 digits)</div>
            )}
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="u-role">Role</label>
            <select id="u-role" className="input-field" value={form.role} onChange={(e) => f("role", e.target.value)}>
              <option value="employee">Employee</option>
              <option value="consultant">Consultant</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {editing === "new" && (
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="u-pwd">Password <span className="required">*</span></label>
              <div style={{ position: "relative" }}>
                <input
                  id="u-pwd"
                  type={showPwd ? "text" : "password"}
                  className="input-field"
                  value={form.password}
                  onChange={(e) => f("password", e.target.value)}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: "0.8rem" }}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
              {strength && (
                <>
                  <div className={`pwd-strength-bar pwd-strength-bar--${strength}`} />
                  <div className="pwd-strength-label" style={{ color: strengthColor }}>{strength.charAt(0).toUpperCase() + strength.slice(1)} password</div>
                </>
              )}
            </div>
          )}
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
            <label className="form-label" htmlFor="u-lpolicy">Leave Policy</label>
            <select id="u-lpolicy" className="input-field" value={form.leavePolicyId} onChange={(e) => f("leavePolicyId", e.target.value)}>
              <option value="">— none —</option>
              {leavePolicies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="u-mgr">Manager</label>
            <select id="u-mgr" className="input-field" value={form.managerId} onChange={(e) => f("managerId", e.target.value)}>
              <option value="">— none —</option>
              {users.filter((u) => !editing || editing === "new" || (editing as User).id !== u.id).map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.825rem", color: "var(--text-secondary)", alignSelf: "end", paddingBottom: 10 }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} style={{ accentColor: "var(--brand-600)" }} />
            Active
          </label>
        </div>
      </Drawer>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">Manage user accounts, roles, and team assignments</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ New User</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">All Users</div>
            <div className="card-subtitle">{users.length} user{users.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="table-search-bar" style={{ flexWrap: "wrap" }}>
          <input
            className="input-field table-search-input"
            placeholder="Search by username, email or employee ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input-field"
            style={{ width: "auto", minWidth: 130 }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{ width: 44 }}></th>
                <th>Username</th>
                <th>Email</th>
                <th style={{ width: 110 }}>Employee ID</th>
                <th style={{ width: 90 }}>Role</th>
                <th>Department</th>
                <th>Leave Policy</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
                  <td>
                    <div style={{ width: 32, height: 32, borderRadius: "var(--r-md)", background: avatarColor(u.username), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.72rem" }}>
                      {initials(u.username)}
                    </div>
                  </td>
                  <td><strong>{u.username}</strong></td>
                  <td className="td-muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</td>
                  <td><code style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "var(--n-100)", padding: "2px 5px", borderRadius: "var(--r-sm)" }}>{u.employeeId || "—"}</code></td>
                  <td><span className={`badge ${u.role === "admin" ? "badge-error" : u.role === "manager" ? "badge-warning" : u.role === "consultant" ? "badge-brand" : "badge-brand"}`}>{u.role}</span></td>
                  <td className="td-muted">{u.departmentName ?? "—"}</td>
                  <td className="td-muted">{u.leavePolicyName ?? "—"}</td>
                  <td>{u.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn btn-outline btn-sm" onClick={() => void toggleActive(u)}>
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={9}>{search || roleFilter ? "No users match your filters." : "No users found."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
