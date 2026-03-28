import { useMemo } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { TenantSettingsProvider } from "./contexts/TenantSettingsContext";
import { AppShell } from "./components/AppShell";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { InstallPrompt } from "./components/InstallPrompt";
import { ToastContainer } from "./components/ToastContainer";
import { Approvals } from "./components/Approvals";
import { TeamStatus } from "./components/TeamStatus";
import { Profile } from "./components/Profile";
import { Categories } from "./components/Admin/Categories";
import { Dashboard } from "./components/Dashboard";
import { Holidays } from "./components/Admin/Holidays";
import { Leave } from "./components/Leave";
import { Login } from "./components/Login";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { LeavePolicies } from "./components/Admin/LeavePolicies";
import { WorkPolicies } from "./components/Admin/WorkPolicies";
import { Projects } from "./components/Admin/Projects";
import { Reports } from "./components/Reports";
import { Timesheets } from "./components/Timesheets";
import { Users } from "./components/Admin/Users";
import { TenantBranding } from "./components/Admin/Branding/TenantBranding";
import { RetentionPolicy } from "./components/Admin/RetentionPolicy";
import { AuditLogViewer } from "./components/Admin/AuditLogViewer";
import { ConsentBanner } from "./components/ConsentBanner";
import { useSession } from "./hooks/useSession";
import type { View } from "./types";

export function hasViewAccess(role: string, view: View | "admin"): boolean {
  if (view === "admin" || view === "projects" || view === "categories" || view === "users" || view === "holidays" || view === "leave-policies" || view === "work-policies" || view === "branding" || view === "retention-policy" || view === "audit-logs") return role === "admin";
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
  branding:           "/branding",
  "retention-policy": "/retention-policy",
  "audit-logs":       "/audit-logs",
};

const PATH_VIEWS: Record<string, View> = Object.fromEntries(
  Object.entries(VIEW_PATHS).map(([v, p]) => [p, v as View])
);

function AppRoutes() {
  const { session, loading, login, logout, updateSession } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin   = session?.role === "admin";
  const isManager = session?.role === "manager" || isAdmin;
  const onboardingCompletedAt = session?.onboardingCompletedAt ?? null;
  const showOnboarding = Boolean(session && !onboardingCompletedAt);

  const nav = useMemo(
    () => ["dashboard", "timesheets", "leave", "reports", ...(isManager ? ["approvals", "team"] : []), ...(isAdmin ? ["projects", "categories", "users", "holidays", "leave-policies", "work-policies", "branding", "retention-policy", "audit-logs"] : [])] as View[],
    [isAdmin, isManager]
  );

  const currentView: View = PATH_VIEWS[location.pathname] ?? "dashboard";

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--surface-sunken, #f5f5f7)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, var(--brand-500, #6366f1), var(--brand-700, #4338ca))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "1.1rem" }}>T</div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary, #64647a)" }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={(s) => { login(s); navigate(location.pathname === "/login" ? "/dashboard" : location.pathname); }} />;
  }

  return (
    <>
      <OnboardingWizard
        open={showOnboarding}
        role={session.role}
        username={session.username}
        onComplete={(completedAt) => updateSession({ onboardingCompletedAt: completedAt })}
      />
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
          <Route path="/dashboard"  element={<ErrorBoundary><Dashboard role={session.role} username={session.username} onboardingCompletedAt={onboardingCompletedAt} /></ErrorBoundary>} />
          <Route path="/timesheets" element={<ErrorBoundary><Timesheets /></ErrorBoundary>} />
          <Route path="/leave"      element={<ErrorBoundary><Leave isManager={isManager} isAdmin={isAdmin} /></ErrorBoundary>} />
          <Route path="/reports"    element={<ErrorBoundary><Reports /></ErrorBoundary>} />
          <Route path="/profile"    element={<ErrorBoundary><Profile onBack={() => navigate(-1)} /></ErrorBoundary>} />
          {isManager && <Route path="/approvals"  element={<ErrorBoundary><Approvals /></ErrorBoundary>} />}
          {isManager && <Route path="/team"       element={<ErrorBoundary><TeamStatus /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/projects"   element={<ErrorBoundary><Projects /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/categories" element={<ErrorBoundary><Categories /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/users"      element={<ErrorBoundary><Users /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/holidays"        element={<ErrorBoundary><Holidays /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/leave-policies"  element={<ErrorBoundary><LeavePolicies /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/work-policies"   element={<ErrorBoundary><WorkPolicies /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/branding"          element={<ErrorBoundary><TenantBranding /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/retention-policy" element={<ErrorBoundary><RetentionPolicy /></ErrorBoundary>} />}
          {isAdmin   && <Route path="/audit-logs"       element={<ErrorBoundary><AuditLogViewer /></ErrorBoundary>} />}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </>
  );
}

export function App() {
  return (
    <TenantSettingsProvider>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
            <ConsentBanner />
            <InstallPrompt />
            <ToastContainer />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </TenantSettingsProvider>
  );
}
