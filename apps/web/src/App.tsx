import { FormEvent, useEffect, useMemo, useState } from "react";

type Session = { accessToken: string; refreshToken: string; username: string; role: string };
type Project = { id: string; name: string; code: string; isActive: boolean; isArchived: boolean };
type TaskCategory = { id: string; name: string; isActive: boolean };
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

type AttendanceSummary = {
  activeSessionId: string | null;
  workDate: string;
  status: string;
  lastCheckInAtUtc: string | null;
  lastCheckOutAtUtc: string | null;
  hasAttendanceException: boolean;
  sessionCount: number;
  grossMinutes: number;
  fixedLunchMinutes: number;
  breakMinutes: number;
  netMinutes: number;
};

type AttendanceDay = {
  workDate: string;
  sessionCount: number;
  grossMinutes: number;
  fixedLunchMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  hasAttendanceException: boolean;
};

type TimesheetEntry = {
  id: string;
  projectId: string;
  projectName: string;
  taskCategoryId: string;
  taskCategoryName: string;
  minutes: number;
  notes: string | null;
};

type TimesheetDay = {
  timesheetId: string;
  workDate: string;
  status: string;
  attendanceNetMinutes: number;
  enteredMinutes: number;
  remainingMinutes: number;
  hasMismatch: boolean;
  mismatchReason: string | null;
  entries: TimesheetEntry[];
};

type TimesheetWeekDay = {
  workDate: string;
  status: string;
  enteredMinutes: number;
  attendanceNetMinutes: number;
  hasMismatch: boolean;
};

type TimesheetWeek = {
  weekStartDate: string;
  weekEndDate: string;
  weekEnteredMinutes: number;
  weekAttendanceNetMinutes: number;
  days: TimesheetWeekDay[];
};

type View = "dashboard" | "attendance" | "timesheets" | "projects" | "categories";

type GuardView = View | "admin";

export function hasViewAccess(role: string, view: GuardView): boolean {
  if (view === "admin" || view === "projects" || view === "categories") {
    return role === "admin";
  }
  return true;
}

export function canManageUsers(role: string): boolean {
  return role === "admin";
}

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
  const [timesheetProjects, setTimesheetProjects] = useState<Project[]>([]);
  const [timesheetCategories, setTimesheetCategories] = useState<TaskCategory[]>([]);
  const [projectForm, setProjectForm] = useState({ name: "", code: "", isActive: true });
  const [categoryForm, setCategoryForm] = useState({ name: "", isActive: true });
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceDay[]>([]);
  const [historyRange, setHistoryRange] = useState({ fromDate: "", toDate: "" });
  const [timesheetDate, setTimesheetDate] = useState(new Date().toISOString().slice(0, 10));
  const [timesheetDay, setTimesheetDay] = useState<TimesheetDay | null>(null);
  const [timesheetWeek, setTimesheetWeek] = useState<TimesheetWeek | null>(null);
  const [timesheetError, setTimesheetError] = useState("");
  const [entryForm, setEntryForm] = useState({ entryId: "", projectId: "", taskCategoryId: "", minutes: 60, notes: "" });
  const [submitNotes, setSubmitNotes] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");

  const isAdmin = canManageUsers(session?.role ?? "");

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
    if (!session) return;
    void loadMe();
    void loadTimesheetOptions();
    void loadAttendance();
    void loadAttendanceHistory();
    void loadTimesheetDay(timesheetDate);
    void loadTimesheetWeek(timesheetDate);
    if (isAdmin) {
      void loadProjectAdmin();
      void loadCategoryAdmin();
    }
  }, [session, isAdmin]);

  const nav = useMemo(() => ["dashboard", "attendance", "timesheets", ...(isAdmin ? ["projects", "categories"] : [])] as View[], [isAdmin]);

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
    const nextSession = { accessToken: data.accessToken, refreshToken: data.refreshToken, username: data.username, role: data.role };
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
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.accessToken}`, ...(init?.headers ?? {}) }
    });
  }

  async function loadMe() { const r = await authed("/auth/me"); if (r.ok) setMe(await r.json()); }

  async function loadTimesheetOptions() {
    const r = await authed("/timesheets/entry-options");
    if (r.ok) {
      const payload = await r.json();
      setTimesheetProjects(payload.projects ?? []);
      setTimesheetCategories(payload.taskCategories ?? []);
      if (!entryForm.projectId && payload.projects?.[0]?.id) {
        setEntryForm((p) => ({ ...p, projectId: payload.projects[0].id }));
      }
      if (!entryForm.taskCategoryId && payload.taskCategories?.[0]?.id) {
        setEntryForm((p) => ({ ...p, taskCategoryId: payload.taskCategories[0].id }));
      }
    }
  }

  async function loadTimesheetDay(date: string) {
    const r = await authed(`/timesheets/day?workDate=${date}`);
    if (r.ok) {
      setTimesheetError("");
      setTimesheetDay(await r.json());
    }
  }

  async function loadTimesheetWeek(date: string) {
    const r = await authed(`/timesheets/week?anyDateInWeek=${date}`);
    if (r.ok) setTimesheetWeek(await r.json());
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    const r = await authed("/timesheets/entries", {
      method: "POST",
      body: JSON.stringify({ workDate: timesheetDate, entryId: entryForm.entryId || null, projectId: entryForm.projectId, taskCategoryId: entryForm.taskCategoryId, minutes: Number(entryForm.minutes), notes: entryForm.notes || null })
    });
    if (!r.ok) {
      const payload = await r.json();
      setTimesheetError(payload.message ?? "Unable to save timesheet entry.");
      return;
    }
    setEntryForm((p) => ({ ...p, entryId: "", notes: "", minutes: 60 }));
    setTimesheetDay(await r.json());
    await loadTimesheetWeek(timesheetDate);
  }

  async function deleteEntry(entryId: string) {
    const r = await authed(`/timesheets/entries/${entryId}`, { method: "DELETE" });
    if (r.ok) {
      setTimesheetDay(await r.json());
      await loadTimesheetWeek(timesheetDate);
    }
  }

  async function submitTimesheet() {
    const r = await authed("/timesheets/submit", {
      method: "POST",
      body: JSON.stringify({ workDate: timesheetDate, notes: submitNotes || null, mismatchReason: mismatchReason || null })
    });
    if (!r.ok) {
      const payload = await r.json();
      setTimesheetError(payload.message ?? "Submit failed.");
      return;
    }
    setTimesheetError("");
    setTimesheetDay(await r.json());
    await loadTimesheetWeek(timesheetDate);
  }

  async function copyPreviousDay() {
    const target = new Date(timesheetDate);
    const source = new Date(timesheetDate);
    source.setDate(source.getDate() - 1);
    const r = await authed("/timesheets/copy", {
      method: "POST",
      body: JSON.stringify({ sourceDate: source.toISOString().slice(0, 10), targetDate: target.toISOString().slice(0, 10) })
    });
    if (r.ok) {
      setTimesheetDay(await r.json());
      await loadTimesheetWeek(timesheetDate);
    }
  }

  async function loadProjectAdmin() { const r = await authed("/projects"); if (r.ok) setProjects(await r.json()); }
  async function loadAttendance() { const r = await authed("/attendance/summary/today"); if (r.ok) setAttendance(await r.json()); }
  async function loadAttendanceHistory() {
    const qs = new URLSearchParams(); if (historyRange.fromDate) qs.set("fromDate", historyRange.fromDate); if (historyRange.toDate) qs.set("toDate", historyRange.toDate);
    const r = await authed(`/attendance/history${qs.size > 0 ? `?${qs}` : ""}`); if (r.ok) setAttendanceHistory(await r.json());
  }
  async function attendanceAction(path: string, body: object = {}) { const r = await authed(path, { method: "POST", body: JSON.stringify(body) }); if (r.ok) { setAttendance(await r.json()); await loadAttendanceHistory(); } }
  async function loadCategoryAdmin() { const r = await authed("/task-categories/admin"); if (r.ok) setCategories(await r.json()); }
  async function createProject(e: FormEvent) { e.preventDefault(); const r = await authed("/projects", { method: "POST", body: JSON.stringify(projectForm) }); if (r.ok) { setProjectForm({ name: "", code: "", isActive: true }); await loadProjectAdmin(); } }
  async function archiveProject(id: string) { const r = await authed(`/projects/${id}/archive`, { method: "POST" }); if (r.ok) await loadProjectAdmin(); }
  async function createCategory(e: FormEvent) { e.preventDefault(); const r = await authed("/task-categories", { method: "POST", body: JSON.stringify(categoryForm) }); if (r.ok) { setCategoryForm({ name: "", isActive: true }); await loadCategoryAdmin(); } }
  async function toggleCategory(category: TaskCategory) { const r = await authed(`/task-categories/${category.id}`, { method: "PUT", body: JSON.stringify({ name: category.name, isActive: !category.isActive }) }); if (r.ok) await loadCategoryAdmin(); }
  async function logout() { localStorage.clear(); setSession(null); setMe(null); }

  if (!session) return <main className="container"><h1>TimeSheet Login</h1><form className="card" onSubmit={onLogin}><label>Username or email<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button type="submit">Sign in</button>{error && <p className="error">{error}</p>}</form></main>;

  return (
    <main className="container">
      <div className="actions wrap">{nav.map((v) => <button key={v} onClick={() => setView(v)}>{v}</button>)}<button onClick={() => void logout()}>Logout</button></div>

      {view === "dashboard" && <section><h2>Dashboard</h2><p>Welcome {me?.username ?? session.username}</p><p>Role: {session.role}</p>{!isAdmin && <p>Role-based guard active: admin modules are hidden.</p>}</section>}

      {view === "attendance" && <section><h2>Attendance</h2><div className="card"><p>Status: {attendance?.status ?? "not-started"}</p><p>Gross/Break/Lunch/Net: {attendance?.grossMinutes ?? 0} / {attendance?.breakMinutes ?? 0} / {attendance?.fixedLunchMinutes ?? 0} / {attendance?.netMinutes ?? 0} mins</p>{attendance?.hasAttendanceException && <p className="error">Attendance exception detected (missing check-out).</p>}<div className="actions wrap"><button onClick={() => void attendanceAction("/attendance/check-in")}>Check In</button><button onClick={() => void attendanceAction("/attendance/check-out")}>Check Out</button><button onClick={() => void attendanceAction("/attendance/breaks/start")}>Start Break</button><button onClick={() => void attendanceAction("/attendance/breaks/end")}>End Break</button></div></div><h3>Attendance History</h3><form className="actions wrap" onSubmit={(e) => { e.preventDefault(); void loadAttendanceHistory(); }}><input type="date" value={historyRange.fromDate} onChange={(e) => setHistoryRange((p) => ({ ...p, fromDate: e.target.value }))} /><input type="date" value={historyRange.toDate} onChange={(e) => setHistoryRange((p) => ({ ...p, toDate: e.target.value }))} /><button type="submit">Apply</button></form><ul>{attendanceHistory.map((day) => <li key={day.workDate}>{day.workDate}: sessions {day.sessionCount}, gross {day.grossMinutes}m, breaks {day.breakMinutes}m, net {day.netMinutes}m{day.hasAttendanceException ? " (exception)" : ""}</li>)}</ul></section>}

      {view === "timesheets" && <section><h2>Timesheets</h2><div className="card"><div className="actions wrap"><label>Work Date <input type="date" value={timesheetDate} onChange={(e) => { setTimesheetDate(e.target.value); void loadTimesheetDay(e.target.value); void loadTimesheetWeek(e.target.value); }} /></label><button onClick={() => void copyPreviousDay()}>Copy Previous Day</button></div><p>Status: {timesheetDay?.status ?? "draft"}</p><p>Attendance vs Entered vs Remaining: {timesheetDay?.attendanceNetMinutes ?? 0} / {timesheetDay?.enteredMinutes ?? 0} / {timesheetDay?.remainingMinutes ?? 0} mins</p>{timesheetDay?.hasMismatch && <p className="error">Mismatch detected: attendance and entered totals differ.</p>}{timesheetError && <p className="error">{timesheetError}</p>}</div>
        <h3>Day Entries</h3>
        <form className="card" onSubmit={saveEntry}><div className="actions wrap"><select value={entryForm.projectId} onChange={(e) => setEntryForm((p) => ({ ...p, projectId: e.target.value }))}>{timesheetProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={entryForm.taskCategoryId} onChange={(e) => setEntryForm((p) => ({ ...p, taskCategoryId: e.target.value }))}>{timesheetCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="number" min={1} max={1440} value={entryForm.minutes} onChange={(e) => setEntryForm((p) => ({ ...p, minutes: Number(e.target.value) }))} /><input placeholder="Notes" value={entryForm.notes} onChange={(e) => setEntryForm((p) => ({ ...p, notes: e.target.value }))} /><button type="submit">{entryForm.entryId ? "Update" : "Add"} Entry</button></div></form>
        <ul>{timesheetDay?.entries.map((entry) => <li key={entry.id}>{entry.projectName} / {entry.taskCategoryName}: {entry.minutes} mins {entry.notes ? `- ${entry.notes}` : ""}<button onClick={() => setEntryForm({ entryId: entry.id, projectId: entry.projectId, taskCategoryId: entry.taskCategoryId, minutes: entry.minutes, notes: entry.notes ?? "" })}>Edit</button><button onClick={() => void deleteEntry(entry.id)}>Delete</button></li>)}</ul>
        <div className="card"><h3>Submit Day</h3><textarea placeholder="Submission notes" value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} /><textarea placeholder="Mismatch reason (required when totals differ)" value={mismatchReason} onChange={(e) => setMismatchReason(e.target.value)} /><button onClick={() => void submitTimesheet()}>Submit Timesheet</button></div>
        <div className="card"><h3>Weekly Summary ({timesheetWeek?.weekStartDate} to {timesheetWeek?.weekEndDate})</h3><p>Total Entered / Attendance: {timesheetWeek?.weekEnteredMinutes ?? 0} / {timesheetWeek?.weekAttendanceNetMinutes ?? 0} mins</p><ul>{timesheetWeek?.days.map((day) => <li key={day.workDate}>{day.workDate}: {day.status}, entered {day.enteredMinutes}m vs attendance {day.attendanceNetMinutes}m{day.hasMismatch ? " (mismatch)" : ""}</li>)}</ul></div>
      </section>}

      {view === "projects" && isAdmin && <section><h2>Project Admin</h2><form className="actions" onSubmit={createProject}><input placeholder="Name" value={projectForm.name} onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))} /><input placeholder="Code" value={projectForm.code} onChange={(e) => setProjectForm((p) => ({ ...p, code: e.target.value }))} /><button type="submit">Create</button></form><ul>{projects.map((project) => <li key={project.id}>{project.name} ({project.code}) - {project.isArchived ? "archived" : project.isActive ? "active" : "inactive"}{!project.isArchived && <button onClick={() => void archiveProject(project.id)}>Archive</button>}</li>)}</ul></section>}
      {view === "categories" && isAdmin && <section><h2>Task Category Admin</h2><form className="actions" onSubmit={createCategory}><input placeholder="Name" value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} /><button type="submit">Create</button></form><ul>{categories.map((category) => <li key={category.id}>{category.name} ({category.isActive ? "active" : "inactive"})<button onClick={() => void toggleCategory(category)}>Toggle status</button></li>)}</ul></section>}
    </main>
  );
}
