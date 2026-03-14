import { FormEvent, useEffect, useMemo, useState } from "react";

type Session = { accessToken: string; refreshToken: string; username: string; role: string };
type Project = { id: string; name: string; code: string; isActive: boolean; isArchived: boolean };
type TaskCategory = { id: string; name: string; isActive: boolean };
type LeaveType = { id: string; name: string; isActive: boolean };
type LeaveRequest = { id: string; username: string; leaveDate: string; leaveTypeName: string; isHalfDay: boolean; status: string; comment: string | null; reviewerComment: string | null };
type ApprovalItem = { timesheetId: string; username: string; workDate: string; enteredMinutes: number; status: string; mismatchReason: string | null };
type ApprovalAction = { id: string; managerUsername: string; action: string; comment: string; actionedAtUtc: string };
type TimesheetDay = { timesheetId: string; workDate: string; status: string; attendanceNetMinutes: number; expectedMinutes: number; enteredMinutes: number; remainingMinutes: number; hasMismatch: boolean; entries: { id: string; projectId: string; taskCategoryId: string; projectName: string; taskCategoryName: string; minutes: number; notes: string | null }[] };
type User = { id: string; username: string; role: string };

type View = "dashboard" | "timesheets" | "leave" | "approvals" | "projects" | "categories";


export function hasViewAccess(role: string, view: View | "admin"): boolean {
  if (view === "admin" || view === "projects" || view === "categories") return role === "admin";
  if (view === "approvals") return role === "manager" || role === "admin";
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
  const [me, setMe] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [timesheetProjects, setTimesheetProjects] = useState<Project[]>([]);
  const [timesheetCategories, setTimesheetCategories] = useState<TaskCategory[]>([]);
  const [timesheetDate, setTimesheetDate] = useState(new Date().toISOString().slice(0, 10));
  const [timesheetDay, setTimesheetDay] = useState<TimesheetDay | null>(null);
  const [entryForm, setEntryForm] = useState({ projectId: "", taskCategoryId: "", minutes: 60, notes: "" });
  const [submitNotes, setSubmitNotes] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [leaveForm, setLeaveForm] = useState({ leaveDate: new Date().toISOString().slice(0, 10), leaveTypeId: "", isHalfDay: false, comment: "" });
  const [leaveTypeForm, setLeaveTypeForm] = useState({ name: "", isActive: true });

  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalAction[]>([]);

  const isAdmin = session?.role === "admin";
  const isManager = session?.role === "manager" || isAdmin;

  const nav = useMemo(
    () => ["dashboard", "timesheets", "leave", ...(isManager ? ["approvals"] : []), ...(isAdmin ? ["projects", "categories"] : [])] as View[],
    [isAdmin, isManager]
  );

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");
    if (accessToken && refreshToken && username && role) setSession({ accessToken, refreshToken, username, role });
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadMe();
    void loadTimesheetOptions();
    void loadTimesheetDay(timesheetDate);
    void loadLeaveTypes();
    void loadMyLeaves();
    if (isManager) {
      void loadPendingLeaves();
      void loadPendingApprovals();
    }
  }, [session, isManager]);

  async function authed(path: string, init?: RequestInit) {
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session?.accessToken ?? ""}`, ...(init?.headers ?? {}) };
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    const response = await fetch(`${API_BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
    if (!response.ok) return void setError("Invalid username/email or password.");
    const data = await response.json();
    const nextSession = { accessToken: data.accessToken, refreshToken: data.refreshToken, username: data.username, role: data.role };
    localStorage.setItem("accessToken", nextSession.accessToken);
    localStorage.setItem("refreshToken", nextSession.refreshToken);
    localStorage.setItem("username", nextSession.username);
    localStorage.setItem("role", nextSession.role);
    setSession(nextSession);
  }

  async function loadMe() { const r = await authed("/users/me"); if (r.ok) setMe(await r.json()); }
  async function loadTimesheetOptions() {
    const r = await authed("/timesheets/entry-options");
    if (!r.ok) return;
    const d = await r.json();
    setTimesheetProjects(d.projects); setTimesheetCategories(d.taskCategories);
    if (d.projects.length > 0) setEntryForm((p) => ({ ...p, projectId: p.projectId || d.projects[0].id }));
    if (d.taskCategories.length > 0) setEntryForm((p) => ({ ...p, taskCategoryId: p.taskCategoryId || d.taskCategories[0].id }));
  }
  async function loadTimesheetDay(date: string) { const r = await authed(`/timesheets/day?workDate=${date}`); if (r.ok) setTimesheetDay(await r.json()); }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    const r = await authed("/timesheets/entries", { method: "POST", body: JSON.stringify({ workDate: timesheetDate, entryId: null, projectId: entryForm.projectId, taskCategoryId: entryForm.taskCategoryId, minutes: entryForm.minutes, notes: entryForm.notes }) });
    if (r.ok) setTimesheetDay(await r.json());
  }

  async function submitTimesheet() {
    const r = await authed("/timesheets/submit", { method: "POST", body: JSON.stringify({ workDate: timesheetDate, notes: submitNotes, mismatchReason }) });
    if (r.ok) setTimesheetDay(await r.json());
  }

  async function loadLeaveTypes() { const r = await authed("/leave/types"); if (r.ok) { const d = await r.json(); setLeaveTypes(d); if (d.length > 0) setLeaveForm((p) => ({ ...p, leaveTypeId: p.leaveTypeId || d[0].id })); } }
  async function loadMyLeaves() { const r = await authed("/leave/requests/my"); if (r.ok) setMyLeaves(await r.json()); }
  async function loadPendingLeaves() { const r = await authed("/leave/requests/pending"); if (r.ok) setPendingLeaves(await r.json()); }

  async function applyLeave(e: FormEvent) {
    e.preventDefault();
    const r = await authed("/leave/requests", { method: "POST", body: JSON.stringify(leaveForm) });
    if (r.ok) { await loadMyLeaves(); if (isManager) await loadPendingLeaves(); }
  }

  async function reviewLeave(id: string, approve: boolean) {
    const comment = !approve ? prompt("Rejection comment") ?? "" : "";
    const r = await authed(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve, comment }) });
    if (r.ok) await loadPendingLeaves();
  }

  async function createLeaveType(e: FormEvent) {
    e.preventDefault();
    const r = await authed("/leave/types", { method: "POST", body: JSON.stringify(leaveTypeForm) });
    if (r.ok) { setLeaveTypeForm({ name: "", isActive: true }); await loadLeaveTypes(); }
  }

  async function loadPendingApprovals() { const r = await authed("/approvals/pending-timesheets"); if (r.ok) setPendingApprovals(await r.json()); }
  async function loadApprovalHistory(timesheetId: string) { const r = await authed(`/approvals/history/${timesheetId}`); if (r.ok) setApprovalHistory(await r.json()); }

  async function takeApprovalAction(timesheetId: string, action: "approve" | "reject" | "push-back") {
    const needsComment = action !== "approve";
    const comment = needsComment ? prompt("Comment") ?? "" : "";
    const r = await authed(`/approvals/timesheets/${timesheetId}/${action}`, { method: "POST", body: JSON.stringify({ comment }) });
    if (r.ok) { await loadPendingApprovals(); await loadApprovalHistory(timesheetId); }
  }

  async function loadProjectAdmin() { const r = await authed("/projects"); if (r.ok) setProjects(await r.json()); }
  async function loadCategoryAdmin() { const r = await authed("/task-categories"); if (r.ok) setCategories(await r.json()); }

  function logout() { localStorage.clear(); setSession(null); setMe(null); }

  if (!session) return <main className="container"><h1>Timesheet</h1><form className="card" onSubmit={onLogin}><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="submit">Login</button>{error && <p className="error">{error}</p>}</form></main>;

  return <main className="container">
    <header><h1>Timesheet</h1><p>{session.username} ({session.role})</p><div className="actions wrap">{nav.map((item) => <button key={item} onClick={() => setView(item)}>{item}</button>)}<button onClick={logout}>Logout</button></div></header>

    {view === "dashboard" && <section><h2>Dashboard</h2><p>Welcome {me?.username ?? session.username}</p></section>}

    {view === "timesheets" && <section><h2>Timesheets</h2><div className="card"><label>Work Date <input type="date" value={timesheetDate} onChange={(e) => { setTimesheetDate(e.target.value); void loadTimesheetDay(e.target.value); }} /></label><p>Status: {timesheetDay?.status}</p><p>Attendance/Expected/Entered/Remaining: {timesheetDay?.attendanceNetMinutes ?? 0}/{timesheetDay?.expectedMinutes ?? 0}/{timesheetDay?.enteredMinutes ?? 0}/{timesheetDay?.remainingMinutes ?? 0}</p></div>
      <form className="card" onSubmit={saveEntry}><div className="actions wrap"><select value={entryForm.projectId} onChange={(e) => setEntryForm((p) => ({ ...p, projectId: e.target.value }))}>{timesheetProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={entryForm.taskCategoryId} onChange={(e) => setEntryForm((p) => ({ ...p, taskCategoryId: e.target.value }))}>{timesheetCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="number" min={1} max={1440} value={entryForm.minutes} onChange={(e) => setEntryForm((p) => ({ ...p, minutes: Number(e.target.value) }))} /><input placeholder="Notes" value={entryForm.notes} onChange={(e) => setEntryForm((p) => ({ ...p, notes: e.target.value }))} /><button type="submit">Add Entry</button></div></form>
      <ul>{timesheetDay?.entries.map((entry) => <li key={entry.id}>{entry.projectName}/{entry.taskCategoryName}: {entry.minutes}m</li>)}</ul>
      <div className="card"><textarea placeholder="Submission notes" value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} /><textarea placeholder="Mismatch reason" value={mismatchReason} onChange={(e) => setMismatchReason(e.target.value)} /><button onClick={() => void submitTimesheet()}>Submit Timesheet</button></div>
    </section>}

    {view === "leave" && <section><h2>Leave</h2>
      {isAdmin && <form className="card actions" onSubmit={createLeaveType}><input placeholder="Leave type" value={leaveTypeForm.name} onChange={(e) => setLeaveTypeForm((p) => ({ ...p, name: e.target.value }))} /><label><input type="checkbox" checked={leaveTypeForm.isActive} onChange={(e) => setLeaveTypeForm((p) => ({ ...p, isActive: e.target.checked }))} />Active</label><button type="submit">Save Leave Type</button></form>}
      <form className="card" onSubmit={applyLeave}><div className="actions wrap"><input type="date" value={leaveForm.leaveDate} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveDate: e.target.value }))} /><select value={leaveForm.leaveTypeId} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveTypeId: e.target.value }))}>{leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}</select><label><input type="checkbox" checked={leaveForm.isHalfDay} onChange={(e) => setLeaveForm((p) => ({ ...p, isHalfDay: e.target.checked }))} />Half day</label><input placeholder="Comment" value={leaveForm.comment} onChange={(e) => setLeaveForm((p) => ({ ...p, comment: e.target.value }))} /><button type="submit">Apply Leave</button></div></form>
      <h3>My Leave History</h3><ul>{myLeaves.map((l) => <li key={l.id}>{l.leaveDate} - {l.leaveTypeName} ({l.isHalfDay ? "Half" : "Full"}) [{l.status}]</li>)}</ul>
      {isManager && <><h3>Pending Leave Approvals</h3><ul>{pendingLeaves.map((l) => <li key={l.id}>{l.username} - {l.leaveDate} - {l.leaveTypeName} ({l.isHalfDay ? "Half" : "Full"})<button onClick={() => void reviewLeave(l.id, true)}>Approve</button><button onClick={() => void reviewLeave(l.id, false)}>Reject</button></li>)}</ul></>}
    </section>}

    {view === "approvals" && isManager && <section><h2>Timesheet Approvals</h2><ul>{pendingApprovals.map((a) => <li key={a.timesheetId}>{a.username} {a.workDate} ({a.enteredMinutes}m){a.mismatchReason ? ` mismatch: ${a.mismatchReason}` : ""}<button onClick={() => void takeApprovalAction(a.timesheetId, "approve")}>Approve</button><button onClick={() => void takeApprovalAction(a.timesheetId, "reject")}>Reject</button><button onClick={() => void takeApprovalAction(a.timesheetId, "push-back")}>Push Back</button><button onClick={() => void loadApprovalHistory(a.timesheetId)}>History</button></li>)}</ul>
      <h3>Approval History</h3><ul>{approvalHistory.map((h) => <li key={h.id}>{h.actionedAtUtc}: {h.managerUsername} {h.action} ({h.comment || "-"})</li>)}</ul>
    </section>}

    {view === "projects" && isAdmin && <section><h2>Project Admin</h2><button onClick={() => void loadProjectAdmin()}>Refresh</button><ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul></section>}
    {view === "categories" && isAdmin && <section><h2>Category Admin</h2><button onClick={() => void loadCategoryAdmin()}>Refresh</button><ul>{categories.map((c) => <li key={c.id}>{c.name}</li>)}</ul></section>}
  </main>;
}
