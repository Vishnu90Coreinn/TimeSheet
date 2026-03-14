import { useMemo, useState } from "react";
import { Approvals } from "./components/Approvals";
import { Categories } from "./components/Admin/Categories";
import { Dashboard } from "./components/Dashboard";
import { Holidays } from "./components/Admin/Holidays";
import { Leave } from "./components/Leave";
import { Login } from "./components/Login";
import { NotificationBell } from "./components/Notifications";
import { Projects } from "./components/Admin/Projects";
import { Reports } from "./components/Reports";
import { Timesheets } from "./components/Timesheets";
import { Users } from "./components/Admin/Users";
import { useSession } from "./hooks/useSession";
import type { View } from "./types";

export function hasViewAccess(role: string, view: View | "admin"): boolean {
  if (view === "admin" || view === "projects" || view === "categories" || view === "users" || view === "holidays") return role === "admin";
  if (view === "approvals") return role === "manager" || role === "admin";
  return true;
}

export function canManageUsers(role: string): boolean {
  return role === "admin";
}

export function App() {
  const { session, loading, login, logout } = useSession();
  const [view, setView] = useState<View>("dashboard");

  const isAdmin = session?.role === "admin";
  const isManager = session?.role === "manager" || isAdmin;

  const nav = useMemo(
    () => ["dashboard", "reports", "timesheets", "leave", ...(isManager ? ["approvals"] : []), ...(isAdmin ? ["projects", "categories", "users", "holidays"] : [])] as View[],
    [isAdmin, isManager]
  );

  if (loading) return <main className="container"><p>Loading\u2026</p></main>;
  if (!session) return <Login onLogin={login} />;

  return (
    <main className="container">
      <header>
        <h1>Timesheet</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <p style={{ margin: 0 }}>{session.username} ({session.role})</p>
          <NotificationBell />
        </div>
        <div className="actions wrap">
          {nav.map((item) => (
            <button key={item} onClick={() => setView(item)}>{item}</button>
          ))}
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      {view === "dashboard" && <Dashboard role={session.role} />}
      {view === "reports" && <Reports />}
      {view === "timesheets" && <Timesheets />}
      {view === "leave" && <Leave isManager={isManager} isAdmin={isAdmin} />}
      {view === "approvals" && isManager && <Approvals />}
      {view === "projects" && isAdmin && <Projects />}
      {view === "categories" && isAdmin && <Categories />}
      {view === "users" && isAdmin && <Users />}
      {view === "holidays" && isAdmin && <Holidays />}
    </main>
  );
}
