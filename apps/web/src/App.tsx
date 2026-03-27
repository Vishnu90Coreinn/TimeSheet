import { useMemo } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { InstallPrompt } from "./components/InstallPrompt";
import { Approvals } from "./components/Approvals";
import { TeamStatus } from "./components/TeamStatus";
import { Profile } from "./components/Profile";
import { Categories } from "./components/Admin/Categories";
import { Dashboard } from "./components/Dashboard";
import { Holidays } from "./components/Admin/Holidays";
import { Leave } from "./components/Leave";
import { Login } from "./components/Login";
import { LeavePolicies } from "./components/Admin/LeavePolicies";
import { WorkPolicies } from "./components/Admin/WorkPolicies";
import { Projects } from "./components/Admin/Projects";
import { Reports } from "./components/Reports";
import { Timesheets } from "./components/Timesheets";
import { Users } from "./components/Admin/Users";
import { useSession } from "./hooks/useSession";
import type { View } from "./types";

export function hasViewAccess(role: string, view: View | "admin"): boolean {
  if (view === "admin" || view === "projects" || view === "categories" || view === "users" || view === "holidays" || view === "leave-policies" || view === "work-policies") return role === "admin";
  if (view === "approvals") return role === "manager" || role === "admin";
  return true;
}

export function canManageUsers(role: string): boolean {
  return role === "admin";
}

const VIEW_PATHS: Record<View, string> = {
  dashboard:        "/dashboard",
  timesheets:       "/timesheets",
  leave:            "/leave",
  reports:          "/reports",
  approvals:        "/approvals",
  team:             "/team",
  projects:         "/projects",
  categories:       "/categories",
  users:            "/users",
  holidays:         "/holidays",
  "leave-policies": "/leave-policies",
  "work-policies":  "/work-policies",
  profile:          "/profile",
};

const PATH_VIEWS: Record<string, View> = Object.fromEntries(
  Object.entries(VIEW_PATHS).map(([v, p]) => [p, v as View])
);

function AppRoutes() {
  const { session, loading, login, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin   = session?.role === "admin";
  const isManager = session?.role === "manager" || isAdmin;

  const nav = useMemo(
    () => ["dashboard", "timesheets", "leave", "reports", ...(isManager ? ["approvals", "team"] : []), ...(isAdmin ? ["projects", "categories", "users", "holidays", "leave-policies", "work-policies"] : [])] as View[],
    [isAdmin, isManager]
  );

  const currentView: View = PATH_VIEWS[location.pathname] ?? "dashboard";

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={(s) => { login(s); navigate(location.pathname === "/login" ? "/dashboard" : location.pathname); }} />;
  }

  return (
    <AppShell
      session={session}
      view={currentView}
      nav={nav}
      onNavigate={(v) => navigate(VIEW_PATHS[v])}
      onNavigateProfile={() => navigate("/profile")}
      onLogout={() => { logout(); navigate("/login"); }}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"  element={<Dashboard role={session.role} username={session.username} />} />
        <Route path="/timesheets" element={<Timesheets />} />
        <Route path="/leave"      element={<Leave isManager={isManager} isAdmin={isAdmin} />} />
        <Route path="/reports"    element={<Reports />} />
        <Route path="/profile"    element={<Profile onBack={() => navigate(-1)} />} />
        {isManager && <Route path="/approvals"  element={<Approvals />} />}
        {isManager && <Route path="/team"       element={<TeamStatus />} />}
        {isAdmin   && <Route path="/projects"   element={<Projects />} />}
        {isAdmin   && <Route path="/categories" element={<Categories />} />}
        {isAdmin   && <Route path="/users"      element={<Users />} />}
        {isAdmin   && <Route path="/holidays"        element={<Holidays />} />}
        {isAdmin   && <Route path="/leave-policies"  element={<LeavePolicies />} />}
        {isAdmin   && <Route path="/work-policies"   element={<WorkPolicies />} />}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <>
      <AppRoutes />
      <InstallPrompt />
    </>
  );
}
