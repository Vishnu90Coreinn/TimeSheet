import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../api/client";
import type { Department, LeavePolicy, User, WorkPolicy } from "../../types";
import { Pencil, UserCheck, UserX } from "lucide-react";

type UserForm = {
  username: string;
  email: string;
  employeeId: string;
  password: string;
  role: string;
  isActive: boolean;
  departmentId: string;
  workPolicyId: string;
  leavePolicyId: string;
  managerId: string;
};

const BLANK: UserForm = {
  username: "",
  email: "",
  employeeId: "",
  password: "",
  role: "employee",
  isActive: true,
  departmentId: "",
  workPolicyId: "",
  leavePolicyId: "",
  managerId: "",
};

const EMP_ID_RE = /^EMP-\d{4}$/;
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="opacity-40 text-[0.7rem] ml-[3px]">↕</span>;
  return <span className="text-[0.75rem] ml-[3px] text-brand-600">{dir === "asc" ? "↑" : "↓"}</span>;
}

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
  return name.split(/[\s_]+/).map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}

const AVATAR_PALETTE = ["#818cf8", "#a78bfa", "#34d399", "#60a5fa", "#f472b6", "#fb923c", "#4ade80", "#38bdf8"];
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
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<"username" | "role" | "departmentName" | "isActive">("username");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(BLANK);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

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
    setForm({
      username: u.username,
      email: u.email,
      employeeId: u.employeeId,
      password: "",
      role: u.role,
      isActive: u.isActive,
      departmentId: u.departmentId ?? "",
      workPolicyId: u.workPolicyId ?? "",
      leavePolicyId: u.leavePolicyId ?? "",
      managerId: u.managerId ?? "",
    });
    setError("");
    setShowPwd(false);
    setEditing(u);
  }

  async function save() {
    setError("");
    if (form.employeeId && !EMP_ID_RE.test(form.employeeId)) {
      setError("Employee ID must be in format EMP-XXXX (e.g. EMP-0001)");
      return;
    }
    const body = {
      username: form.username,
      email: form.email,
      employeeId: form.employeeId,
      role: form.role,
      isActive: form.isActive,
      departmentId: form.departmentId || null,
      workPolicyId: form.workPolicyId || null,
      leavePolicyId: form.leavePolicyId || null,
      managerId: form.managerId || null,
      ...(editing === "new" ? { password: form.password } : {}),
    };
    const r = editing === "new"
      ? await apiFetch("/users", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/users/${(editing as User).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); }
    else {
      const d = await r.json().catch(() => ({}));
      setError((d as { message?: string }).message ?? "Save failed");
    }
  }

  async function toggleActive(u: User) {
    const body = {
      username: u.username,
      email: u.email,
      employeeId: u.employeeId,
      role: u.role,
      isActive: !u.isActive,
      departmentId: u.departmentId,
      workPolicyId: u.workPolicyId,
      managerId: u.managerId,
    };
    await apiFetch(`/users/${u.id}`, { method: "PUT", body: JSON.stringify(body) });
    void load();
  }

  function toggleUserSelect(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const f = (k: keyof UserForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));
  const strength = editing === "new" ? pwdStrength(form.password) : null;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.employeeId ?? "").toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesDepartment = !departmentFilter || (u.departmentName ?? "").toLowerCase() === departmentFilter.toLowerCase();
    return matchesSearch && matchesRole && matchesDepartment;
  });

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "username") return mul * a.username.localeCompare(b.username);
    if (sortCol === "role") return mul * a.role.localeCompare(b.role);
    if (sortCol === "departmentName") return mul * (a.departmentName ?? "").localeCompare(b.departmentName ?? "");
    if (sortCol === "isActive") return mul * (Number(b.isActive) - Number(a.isActive));
    return 0;
  });

  const drawerTitle = editing === "new" ? "Create User" : editing ? `Edit: ${(editing as User).username}` : "";

  return (
    <section className="flex flex-col gap-6">
      <Drawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => void save()}>Save</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
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
            <input id="u-empid" className="input-field" value={form.employeeId} onChange={(e) => f("employeeId", e.target.value)} placeholder="EMP-0001" />
            {form.employeeId && !EMP_ID_RE.test(form.employeeId) && <div className="text-[0.72rem] text-danger mt-[3px]">Format: EMP-XXXX (4 digits)</div>}
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
            <div className="form-field col-span-2">
              <label className="form-label" htmlFor="u-pwd">Password <span className="required">*</span></label>
              <div className="relative">
                <input id="u-pwd" type={showPwd ? "text" : "password"} className="input-field pr-11" value={form.password} onChange={(e) => f("password", e.target.value)} />
                <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-[10px] top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-text-tertiary text-[0.8rem]">
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
              {strength && (
                <>
                  <div className={`pwd-strength-bar pwd-strength-bar--${strength}`} />
                  <div className={`pwd-strength-label ${strength === "strong" ? "text-success" : strength === "medium" ? "text-warning" : "text-danger"}`}>
                    {strength.charAt(0).toUpperCase() + strength.slice(1)} password
                  </div>
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
          <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary self-end pb-[10px]">
            <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} className="[accent-color:var(--brand-600)]" />
            Active
          </label>
        </div>
      </Drawer>

      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">Manage user accounts, roles, and team assignments</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ New User</button>
        </div>
      </div>

      <div className="mgmt-toolbar">
        <div className="input-icon-wrap mgmt-search-wrap">
          <span className="input-icon">🔍</span>
          <input className="input-field mgmt-search" placeholder="Search by username, email or employee ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field mgmt-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="employee">Employee</option>
          <option value="consultant">Consultant</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <select className="input-field mgmt-select" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <button className="btn btn-outline mgmt-filter-btn">□ Filter</button>
      </div>

      <div className="card overflow-visible">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Users
            <span className="mgmt-count-pill">{users.length} users</span>
          </div>
          <button className="btn btn-outline btn-sm">Export</button>
        </div>
        <div className="table-wrap mgmt-table-wrap">
          <table className="table-base mgmt-table">
            <thead>
              <tr>
                <th className="w-11">
                  <input
                    type="checkbox"
                    aria-label="Select all users"
                    checked={sorted.length > 0 && selectedUserIds.size === sorted.length}
                    onChange={() => {
                      if (selectedUserIds.size === sorted.length) setSelectedUserIds(new Set());
                      else setSelectedUserIds(new Set(sorted.map((u) => u.id)));
                    }}
                    className="w-4 h-4 [accent-color:var(--brand-600)]"
                  />
                </th>
                <th className="th-sort" onClick={() => toggleSort("username")} aria-sort={sortCol === "username" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>User <SortIcon active={sortCol === "username"} dir={sortDir} /></th>
                <th className="w-[130px]">Employee ID</th>
                <th className="th-sort w-[120px]" onClick={() => toggleSort("role")} aria-sort={sortCol === "role" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Role <SortIcon active={sortCol === "role"} dir={sortDir} /></th>
                <th className="th-sort" onClick={() => toggleSort("departmentName")} aria-sort={sortCol === "departmentName" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Department <SortIcon active={sortCol === "departmentName"} dir={sortDir} /></th>
                <th>Leave Policy</th>
                <th className="th-sort w-[100px]" onClick={() => toggleSort("isActive")} aria-sort={sortCol === "isActive" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Status <SortIcon active={sortCol === "isActive"} dir={sortDir} /></th>
                <th className="w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "opacity-[0.55]"}>
                  <td><input type="checkbox" aria-label={`Select ${u.username}`} checked={selectedUserIds.has(u.id)} onChange={() => toggleUserSelect(u.id)} className="w-4 h-4 [accent-color:var(--brand-600)]" /></td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[0.72rem]" style={{ background: avatarColor(u.username) }}>{initials(u.username)}</div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary">{u.username}</div>
                        <div className="td-muted max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><code className="font-mono text-[0.75rem] bg-n-100 px-[5px] py-0.5 rounded-sm">{u.employeeId || "—"}</code></td>
                  <td><span className={`badge ${u.role === "admin" ? "badge-error" : u.role === "manager" ? "badge-warning" : "badge-brand"}`}>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
                  <td className="td-muted">{u.departmentName ?? "—"}</td>
                  <td className="td-muted">{u.leavePolicyName ?? "—"}</td>
                  <td>{u.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="flex gap-2 items-center">
                      <button
                        className="mgmt-icon-action mgmt-icon-action-edit"
                        onClick={() => openEdit(u)}
                        title={`Edit ${u.username}`}
                        aria-label={`Edit ${u.username}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={`mgmt-icon-action ${u.isActive ? "mgmt-icon-action-danger" : "mgmt-icon-action-success"}`}
                        onClick={() => void toggleActive(u)}
                        title={`${u.isActive ? "Deactivate" : "Activate"} ${u.username}`}
                        aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.username}`}
                      >
                        {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={8}>{search || roleFilter || departmentFilter ? "No users match your filters." : "No users found."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mgmt-card-foot">
          <span>Showing 1–{sorted.length} of {sorted.length} user{sorted.length === 1 ? "" : "s"}</span>
          <div className="mgmt-pagination">
            <button className="btn btn-outline btn-sm px-2" aria-label="Previous page">&lt;</button>
            <button className="btn btn-primary btn-sm px-3">1</button>
            <button className="btn btn-outline btn-sm px-2" aria-label="Next page">&gt;</button>
          </div>
        </div>
      </div>
    </section>
  );
}
