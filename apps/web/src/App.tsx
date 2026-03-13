import { useEffect, useMemo, useRef, useState } from "react";

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

type User = {
  id: string;
  username: string;
  email: string;
  employeeId: string;
  role: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  workPolicyId: string | null;
  workPolicyName: string | null;
  managerId: string | null;
  managerUsername: string | null;
};

type Role = { id: string; name: string };
type Department = { id: string; name: string; isActive: boolean };
type WorkPolicy = { id: string; name: string; dailyExpectedMinutes: number; isActive: boolean };

type UserForm = {
  username: string;
  email: string;
  employeeId: string;
  password: string;
  role: string;
  isActive: boolean;
  departmentId: string;
  workPolicyId: string;
  managerId: string;
};

const API_BASE_URL = "http://localhost:5000/api/v1";

type View = "dashboard" | "admin";

const defaultForm: UserForm = {
  username: "",
  email: "",
  employeeId: "",
  password: "",
  role: "",
  isActive: true,
  departmentId: "",
  workPolicyId: "",
  managerId: ""
};

export function App() {
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [view, setView] = useState<View>("dashboard");

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workPolicies, setWorkPolicies] = useState<WorkPolicy[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(defaultForm);
  const [adminFeedback, setAdminFeedback] = useState("");
  const refreshInFlightRef = useRef<Promise<Session | null> | null>(null);

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

  useEffect(() => {
    if (view !== "admin" || session?.role !== "admin") {
      return;
    }

    void loadAdminData();
  }, [view, session]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const statusMatch = statusFilter === "all" || (statusFilter === "active" ? user.isActive : !user.isActive);
      const roleMatch = roleFilter === "all" || user.role === roleFilter;
      return statusMatch && roleMatch;
    });
  }, [users, roleFilter, statusFilter]);

  async function fetchCurrentUser(activeSession: Session) {
    try {
      const response = await authedFetch("/auth/me", { method: "GET" }, activeSession);
      if (!response.ok) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const data = (await response.json()) as CurrentUser;
      setCurrentUser(data);
    } catch (message) {
      setError((message as Error).message);
      await onLogout();
    }
  }

  async function refreshSession(refreshToken: string) {
    if (!refreshInFlightRef.current) {
      refreshInFlightRef.current = (async () => {
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
      })().finally(() => {
        refreshInFlightRef.current = null;
      });
    }

    return refreshInFlightRef.current;
  }

  async function authedFetch(path: string, options: RequestInit, activeSession?: Session) {
    const authSession = activeSession ?? session;
    if (!authSession) {
      throw new Error("Not authenticated.");
    }

    const firstResponse = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
        Authorization: `Bearer ${authSession.accessToken}`
      }
    });

    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    const refreshed = await refreshSession(authSession.refreshToken);
    if (!refreshed) {
      return firstResponse;
    }

    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
        Authorization: `Bearer ${refreshed.accessToken}`
      }
    });
  }

  async function loadAdminData() {
    try {
      setAdminFeedback("");
      const [usersResponse, rolesResponse, departmentsResponse, policiesResponse] = await Promise.all([
        authedFetch(`/users?q=${encodeURIComponent(query)}`, { method: "GET" }),
        authedFetch("/roles", { method: "GET" }),
        authedFetch("/masters/departments", { method: "GET" }),
        authedFetch("/masters/work-policies", { method: "GET" })
      ]);

      if (!usersResponse.ok || !rolesResponse.ok || !departmentsResponse.ok || !policiesResponse.ok) {
        throw new Error("Failed to load admin user management data.");
      }

      const nextUsers = (await usersResponse.json()) as User[];
      const nextRoles = (await rolesResponse.json()) as Role[];
      const nextDepartments = (await departmentsResponse.json()) as Department[];
      const nextPolicies = (await policiesResponse.json()) as WorkPolicy[];

      setUsers(nextUsers);
      setRoles(nextRoles);
      setDepartments(nextDepartments);
      setWorkPolicies(nextPolicies);

      if (!editingUserId && nextRoles.length > 0) {
        setUserForm((prev) => ({ ...prev, role: prev.role || nextRoles[0].name }));
      }
    } catch (loadError) {
      setAdminFeedback((loadError as Error).message);
    }
  }

  function startCreate() {
    setEditingUserId(null);
    setAdminFeedback("");
    setUserForm({ ...defaultForm, role: roles[0]?.name ?? "" });
  }

  function startEdit(user: User) {
    setEditingUserId(user.id);
    setAdminFeedback("");
    setUserForm({
      username: user.username,
      email: user.email,
      employeeId: user.employeeId,
      password: "",
      role: user.role,
      isActive: user.isActive,
      departmentId: user.departmentId ?? "",
      workPolicyId: user.workPolicyId ?? "",
      managerId: user.managerId ?? ""
    });
  }

  async function submitUserForm(event: React.FormEvent) {
    event.preventDefault();
    setAdminFeedback("");

    const payload = {
      username: userForm.username,
      email: userForm.email,
      employeeId: userForm.employeeId,
      role: userForm.role,
      isActive: userForm.isActive,
      departmentId: userForm.departmentId || null,
      workPolicyId: userForm.workPolicyId || null,
      managerId: userForm.managerId || null
    };

    const response = editingUserId
      ? await authedFetch(`/users/${editingUserId}`, { method: "PUT", body: JSON.stringify(payload) })
      : await authedFetch("/users", { method: "POST", body: JSON.stringify({ ...payload, password: userForm.password }) });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: "Unknown error" }))) as { message?: string };
      setAdminFeedback(body.message ?? "Unable to save user.");
      return;
    }

    setAdminFeedback(editingUserId ? "User updated successfully." : "User created successfully.");
    startCreate();
    await loadAdminData();
  }

  async function toggleActive(user: User) {
    setAdminFeedback("");

    const response = await authedFetch(`/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        isActive: !user.isActive,
        departmentId: user.departmentId,
        workPolicyId: user.workPolicyId,
        managerId: user.managerId
      })
    });

    if (!response.ok) {
      setAdminFeedback("Failed to update user status.");
      return;
    }

    setAdminFeedback(`User ${user.username} is now ${user.isActive ? "inactive" : "active"}.`);
    await loadAdminData();
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
            <section className="admin-area">
              <h2>User management</h2>

              <div className="actions wrap">
                <input
                  placeholder="Search username/email/employee ID"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button onClick={() => void loadAdminData()}>Search</button>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive") }>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All roles</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={startCreate}>New user</button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Employee ID</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Manager</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>{user.employeeId}</td>
                        <td>{user.role}</td>
                        <td>{user.isActive ? "Active" : "Inactive"}</td>
                        <td>{user.managerUsername ?? "-"}</td>
                        <td className="actions">
                          <button type="button" onClick={() => startEdit(user)}>Edit</button>
                          <button type="button" onClick={() => void toggleActive(user)}>
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form onSubmit={submitUserForm} className="card">
                <h3>{editingUserId ? "Edit user" : "Create user"}</h3>
                <label>
                  Username
                  <input value={userForm.username} onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))} required />
                </label>
                <label>
                  Email
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} required />
                </label>
                <label>
                  Employee ID
                  <input value={userForm.employeeId} onChange={(e) => setUserForm((prev) => ({ ...prev, employeeId: e.target.value }))} required />
                </label>
                {!editingUserId && (
                  <label>
                    Password
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} required />
                  </label>
                )}
                <label>
                  Role
                  <select value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))} required>
                    {roles.map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Department
                  <select value={userForm.departmentId} onChange={(e) => setUserForm((prev) => ({ ...prev, departmentId: e.target.value }))}>
                    <option value="">None</option>
                    {departments.filter((department) => department.isActive).map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Work policy
                  <select value={userForm.workPolicyId} onChange={(e) => setUserForm((prev) => ({ ...prev, workPolicyId: e.target.value }))}>
                    <option value="">None</option>
                    {workPolicies.filter((policy) => policy.isActive).map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reporting manager
                  <select value={userForm.managerId} onChange={(e) => setUserForm((prev) => ({ ...prev, managerId: e.target.value }))}>
                    <option value="">None</option>
                    {users.filter((user) => user.id !== editingUserId).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active user
                </label>
                <button type="submit">{editingUserId ? "Save changes" : "Create user"}</button>
              </form>

              {adminFeedback && <p className={adminFeedback.toLowerCase().includes("fail") ? "error" : "success"}>{adminFeedback}</p>}
            </section>
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
