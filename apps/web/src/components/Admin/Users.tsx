import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import type { Department, LeavePolicy, PagedResponse, User, WorkPolicy } from "../../types";
import { History, Pencil, UserCheck, UserX } from "lucide-react";
import { AppBadge, AppButton, AppCheckbox, AppDrawer, AppIconButton, AppInput, AppSelect, ServerDataTable, type ServerColumnDef, type ServerTableQuery } from "../ui";
import { useToast } from "../../contexts/ToastContext";
import { avatarColor } from "../../utils/avatar";

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7" cy="17" r="4"/><path d="M10.85 13.15L19 5l-2 4 4-2-2 4 4-2-2 4"/>
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  );
}

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

export function Users() {
  const navigate = useNavigate();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [policies, setPolicies] = useState<WorkPolicy[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tableQuery, setTableQuery] = useState<ServerTableQuery>({
    page: 1,
    pageSize: 25,
    search: "",
    sortBy: "username",
    sortDir: "asc",
  });
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(BLANK);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Reset password
  const [resetPasswordResult, setResetPasswordResult] = useState<{ userId: string; username: string; tempPassword: string } | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  // Revoke sessions
  const [revokeConfirmUserId, setRevokeConfirmUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(tableQuery.page),
      pageSize: String(tableQuery.pageSize),
      sortBy: tableQuery.sortBy,
      sortDir: tableQuery.sortDir,
    });
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    if (roleFilter) params.set("role", roleFilter);
    const selectedDept = departments.find((d) => d.name === departmentFilter);
    if (selectedDept) params.set("departmentId", selectedDept.id);

    const r = await apiFetch(`/users?${params.toString()}`);
    if (r.ok) {
      const data = await r.json() as PagedResponse<User>;
      setUsers(data.items);
      setTotalCount(data.totalCount);
    }
    setLoading(false);
  }

  useEffect(() => {
    apiFetch("/masters/departments").then(async (r) => { if (r.ok) setDepartments(await r.json()); });
    apiFetch("/masters/work-policies?page=1&pageSize=200").then(async (r) => {
      if (r.ok) {
        const d = await r.json() as PagedResponse<WorkPolicy>;
        setPolicies(d.items);
      }
    });
    apiFetch("/leave/policies?page=1&pageSize=200").then(async (r) => {
      if (r.ok) {
        const d = await r.json() as PagedResponse<LeavePolicy>;
        setLeavePolicies(d.items);
      }
    });
  }, []);

  useEffect(() => {
    void load();
  }, [tableQuery, roleFilter, departmentFilter, departments]);

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
    const isNew = editing === "new";
    const r = isNew
      ? await apiFetch("/users", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/users/${(editing as User).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) {
      setEditing(null);
      void load();
      toast.success(isNew ? "User created" : "User updated", isNew ? `${form.username} has been added.` : `${form.username} has been saved.`);
    } else {
      const d = await r.json().catch(() => ({}));
      const msg = (d as { message?: string }).message ?? "Save failed";
      setError(msg);
      toast.error("Save failed", msg);
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
      leavePolicyId: u.leavePolicyId,
      managerId: u.managerId,
    };
    const r = await apiFetch(`/users/${u.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) {
      toast.success(`${u.username} ${u.isActive ? "deactivated" : "activated"}`);
    } else {
      toast.error("Failed to update user status");
    }
    void load();
  }

  async function resetPassword(u: User) {
    const r = await apiFetch(`/users/${u.id}/reset-password`, { method: "POST" });
    if (r.ok) {
      const d = await r.json() as { temporaryPassword: string };
      setResetPasswordResult({ userId: u.id, username: u.username, tempPassword: d.temporaryPassword });
      setCopyDone(false);
    } else {
      toast.error("Reset failed", `Could not reset password for ${u.username}.`);
    }
  }

  async function revokeSessions(u: User) {
    const r = await apiFetch(`/users/${u.id}/revoke-sessions`, { method: "POST" });
    setRevokeConfirmUserId(null);
    if (r.ok || r.status === 204) {
      toast.success("Sessions revoked", `Sessions revoked for ${u.username}.`);
    } else {
      toast.error("Revoke failed", `Could not revoke sessions for ${u.username}.`);
    }
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

  const columns: ServerColumnDef<User>[] = [
    {
      key: "select",
      label: "",
      width: "44px",
      render: (u) => (
        <AppCheckbox
          aria-label={`Select ${u.username}`}
          checked={selectedUserIds.has(u.id)}
          onChange={() => toggleUserSelect(u.id)}
        />
      ),
    },
    {
      key: "username",
      label: "User",
      sortable: true,
      sortValue: (u) => u.username,
      searchValue: (u) => `${u.username} ${u.email} ${u.employeeId ?? ""}`,
      render: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[0.72rem]" style={{ background: avatarColor(u.username), flexShrink: 0 }}>
            {initials(u.username)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="font-semibold text-text-primary">{u.username}</div>
            <div className="td-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "employeeId",
      label: "Employee ID",
      width: "130px",
      sortable: true,
      sortValue: (u) => u.employeeId ?? "",
      render: (u) => <code className="font-mono text-[0.75rem] bg-n-100 px-[5px] py-0.5 rounded-sm">{u.employeeId || "—"}</code>,
    },
    {
      key: "role",
      label: "Role",
      width: "115px",
      sortable: true,
      sortValue: (u) => u.role,
      render: (u) => (
        <span className={`badge ${u.role === "admin" ? "badge-error" : u.role === "manager" ? "badge-warning" : "badge-brand"}`}>
          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
        </span>
      ),
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      sortValue: (u) => u.departmentName ?? "",
      render: (u) => <span className="td-muted">{u.departmentName ?? "—"}</span>,
    },
    {
      key: "leavePolicy",
      label: "Leave Policy",
      render: (u) => <span className="td-muted">{u.leavePolicyName ?? "—"}</span>,
    },
    {
      key: "isActive",
      label: "Status",
      width: "100px",
      sortable: true,
      render: (u) => u.isActive
        ? <AppBadge variant="success">Active</AppBadge>
        : <AppBadge variant="neutral">Inactive</AppBadge>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "160px",
      render: (u) => (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <AppIconButton tone="edit" onClick={() => openEdit(u)} title={`Edit ${u.username}`} aria-label={`Edit ${u.username}`}>
            <Pencil size={14} />
          </AppIconButton>
          <AppIconButton tone="edit" onClick={() => navigate(`/audit-logs?entityType=User&entityId=${u.id}`)} title={`Audit history for ${u.username}`} aria-label={`Audit history for ${u.username}`}>
            <History size={14} />
          </AppIconButton>
          <AppIconButton tone={u.isActive ? "danger" : "success"} onClick={() => void toggleActive(u)} title={`${u.isActive ? "Deactivate" : "Activate"} ${u.username}`} aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.username}`}>
            {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
          </AppIconButton>
          <AppIconButton
            tone="edit"
            onClick={() => void resetPassword(u)}
            title={`Reset password for ${u.username}`}
            aria-label={`Reset password for ${u.username}`}
          >
            <KeyIcon />
          </AppIconButton>
          {revokeConfirmUserId === u.id ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <AppButton variant="danger" size="sm" style={{ padding: "2px 6px", fontSize: "0.72rem", minHeight: 0 }} onClick={() => void revokeSessions(u)}>Revoke?</AppButton>
              <AppButton variant="ghost" size="sm" style={{ padding: "2px 6px", fontSize: "0.72rem", minHeight: 0 }} onClick={() => setRevokeConfirmUserId(null)}>✕</AppButton>
            </div>
          ) : (
            <AppIconButton
              tone="danger"
              onClick={() => setRevokeConfirmUserId(u.id)}
              title={`Revoke sessions for ${u.username}`}
              aria-label={`Revoke sessions for ${u.username}`}
            >
              <BanIcon />
            </AppIconButton>
          )}
        </div>
      ),
    },
  ];

  const drawerTitle = editing === "new" ? "Create User" : editing ? `Edit: ${(editing as User).username}` : "";

  return (
    <section className="flex flex-col gap-6">
      {/* Reset Password modal */}
      {resetPasswordResult && (
        <div className="modal-overlay" onClick={() => setResetPasswordResult(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-title">Temporary Password</div>
            <div className="modal-body">
              <p className="text-[0.85rem] text-text-secondary mb-4">
                Share this password with <strong>{resetPasswordResult.username}</strong>. They will be required to change it on their next login.
              </p>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={resetPasswordResult.tempPassword}
                  className="input-field font-mono text-[0.85rem] flex-1"
                  style={{ fontFamily: "monospace", background: "var(--n-50)", border: "1px solid var(--border-subtle)" }}
                />
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(resetPasswordResult.tempPassword);
                    setCopyDone(true);
                    setTimeout(() => setCopyDone(false), 2000);
                  }}
                >
                  {copyDone ? "Copied!" : "Copy"}
                </AppButton>
              </div>
            </div>
            <div className="modal-actions">
              <AppButton variant="primary" size="sm" onClick={() => setResetPasswordResult(null)}>Close</AppButton>
            </div>
          </div>
        </div>
      )}

      <AppDrawer open={!!editing} title={drawerTitle} onClose={() => setEditing(null)}
        footer={
          <>
            <AppButton variant="primary" onClick={() => void save()}>Save</AppButton>
            <AppButton variant="ghost" onClick={() => setEditing(null)}>Cancel</AppButton>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="drawer-section">
          <div className="drawer-section-label">Account</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-field">
              <label className="form-label" htmlFor="u-username">Username <span className="required">*</span></label>
              <AppInput id="u-username" value={form.username} onChange={(e) => f("username", e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-email">Email <span className="required">*</span></label>
              <AppInput id="u-email" type="email" value={form.email} onChange={(e) => f("email", e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-empid">Employee ID</label>
              <AppInput id="u-empid" value={form.employeeId} onChange={(e) => f("employeeId", e.target.value)} placeholder="EMP-0001" />
              {form.employeeId && !EMP_ID_RE.test(form.employeeId) && <div className="text-[0.72rem] text-danger mt-[3px]">Format: EMP-XXXX (4 digits)</div>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-role">Role</label>
              <AppSelect id="u-role" value={form.role} onChange={(e) => f("role", e.target.value)}>
                <option value="employee">Employee</option>
                <option value="consultant">Consultant</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </AppSelect>
            </div>
          </div>
          {editing === "new" && (
            <div className="form-field">
              <label className="form-label" htmlFor="u-pwd">Password <span className="required">*</span></label>
              <div className="relative">
                <AppInput id="u-pwd" type={showPwd ? "text" : "password"} className="pr-11" value={form.password} onChange={(e) => f("password", e.target.value)} />
                <AppButton type="button" variant="ghost" size="sm" onClick={() => setShowPwd((s) => !s)} className="absolute right-[6px] top-1/2 -translate-y-1/2 text-text-tertiary text-[0.8rem] px-2 py-1 min-h-0 h-auto">
                  {showPwd ? "Hide" : "Show"}
                </AppButton>
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
        </div>
        <div className="drawer-section">
          <div className="drawer-section-label">Assignments</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-field">
              <label className="form-label" htmlFor="u-dept">Department</label>
              <AppSelect id="u-dept" value={form.departmentId} onChange={(e) => f("departmentId", e.target.value)}>
                <option value="">— none —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </AppSelect>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-policy">Work Policy</label>
              <AppSelect id="u-policy" value={form.workPolicyId} onChange={(e) => f("workPolicyId", e.target.value)}>
                <option value="">— none —</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </AppSelect>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-lpolicy">Leave Policy</label>
              <AppSelect id="u-lpolicy" value={form.leavePolicyId} onChange={(e) => f("leavePolicyId", e.target.value)}>
                <option value="">— none —</option>
                {leavePolicies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </AppSelect>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="u-mgr">Manager</label>
              <AppSelect id="u-mgr" value={form.managerId} onChange={(e) => f("managerId", e.target.value)}>
                <option value="">— none —</option>
                {users.filter((u) => !editing || editing === "new" || (editing as User).id !== u.id).map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </AppSelect>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[0.825rem] text-text-secondary">
            <AppCheckbox checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} />
            Active
          </label>
        </div>
      </AppDrawer>

      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">Manage user accounts, roles, and team assignments</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header mgmt-card-head">
          <div className="card-title">
            All Users
            <span className="mgmt-count-pill">{totalCount} users</span>
          </div>
          <AppButton variant="primary" size="sm" onClick={openCreate}>+ New User</AppButton>
        </div>
        <ServerDataTable
          columns={columns}
          data={users}
          totalCount={totalCount}
          query={tableQuery}
          onQueryChange={setTableQuery}
          rowKey={(u) => u.id}
          searchPlaceholder="Search by name, email or employee ID…"
          emptyText={roleFilter || departmentFilter ? "No users match your filters." : "No users found."}
          loading={loading}
          rowOpacity={(u) => u.isActive ? 1 : 0.5}
          toolbar={
            <>
              <AppSelect style={{ height: 34, fontSize: 13 }} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setTableQuery((q) => ({ ...q, page: 1 })); }}>
                <option value="">All Roles</option>
                <option value="employee">Employee</option>
                <option value="consultant">Consultant</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </AppSelect>
              <AppSelect style={{ height: 34, fontSize: 13 }} value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setTableQuery((q) => ({ ...q, page: 1 })); }}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </AppSelect>
            </>
          }
        />
      </div>
    </section>
  );
}
