/**
 * App.tsx — Updated to use AppShell (design system Step 1c).
 * All business logic (auth, routing, role guards) is unchanged.
 * The old inline header/nav is replaced by AppShell.
 */
import { useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { Approvals } from "./components/Approvals";
import { Categories } from "./components/Admin/Categories";
import { Dashboard } from "./components/Dashboard";
import { Holidays } from "./components/Admin/Holidays";
import { Leave } from "./components/Leave";
import { Login } from "./components/Login";
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
    () => ["dashboard", "timesheets", "leave", "reports", ...(isManager ? ["approvals"] : []), ...(isAdmin ? ["projects", "categories", "users", "holidays"] : [])] as View[],
    [isAdmin, isManager]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!session) return <Login onLogin={login} />;

  return (
    <AppShell
      session={session}
      view={view}
      nav={nav}
      onNavigate={setView}
      onLogout={logout}
    >
      {view === "dashboard"  && <Dashboard role={session.role} />}
      {view === "reports"    && <Reports />}
      {view === "timesheets" && <Timesheets />}
      {view === "leave"      && <Leave isManager={isManager} isAdmin={isAdmin} />}
      {view === "approvals"  && isManager && <Approvals />}
      {view === "projects"   && isAdmin   && <Projects />}
      {view === "categories" && isAdmin   && <Categories />}
      {view === "users"      && isAdmin   && <Users />}
      {view === "holidays"   && isAdmin   && <Holidays />}
    </AppShell>
  );
}
