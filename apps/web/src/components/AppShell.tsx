/**
 * AppShell.tsx — v3.0 exact Pulse reference layout
 */
import { useState, type ReactNode } from "react";
import { NotificationBell } from "./Notifications";
import type { Session } from "../types";
import type { View } from "../types";

interface NavItem {
  view: View;
  label: string;
  icon: ReactNode;
  group: "main" | "manager" | "admin";
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard",  label: "Dashboard",  icon: <DashboardIcon />, group: "main" },
  { view: "timesheets", label: "Timesheets",  icon: <ClockIcon />,     group: "main" },
  { view: "leave",      label: "Leave",       icon: <CalendarIcon />,  group: "main" },
  { view: "reports",    label: "Reports",     icon: <ChartIcon />,     group: "main" },
  { view: "approvals",  label: "Approvals",   icon: <CheckIcon />,     group: "manager" },
  { view: "projects",   label: "Projects",    icon: <FolderIcon />,    group: "admin" },
  { view: "categories", label: "Categories",  icon: <TagIcon />,       group: "admin" },
  { view: "users",      label: "Users",       icon: <UsersIcon />,     group: "admin" },
  { view: "holidays",        label: "Holidays",        icon: <StarIcon />,      group: "admin" },
  { view: "leave-policies", label: "Leave Policies",  icon: <PolicyIcon />,    group: "admin" },
  { view: "work-policies",  label: "Work Policies",   icon: <ClockIcon />,     group: "admin" },
];

interface AppShellProps {
  session: Session;
  view: View;
  nav: View[];
  onNavigate: (v: View) => void;
  onLogout: () => void;
  children: ReactNode;
}

const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard", timesheets: "Timesheets", leave: "Leave",
  reports: "Reports", approvals: "Approvals", projects: "Projects",
  categories: "Categories", users: "Users", holidays: "Holidays",
  "leave-policies": "Leave Policies",
  "work-policies": "Work Policies",
};

export function AppShell({ session, view, nav, onNavigate, onLogout, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const initials = session.username.slice(0, 2).toUpperCase();
  const mainItems    = NAV_ITEMS.filter((i) => i.group === "main"    && nav.includes(i.view));
  const managerItems = NAV_ITEMS.filter((i) => i.group === "manager" && nav.includes(i.view));
  const adminItems   = NAV_ITEMS.filter((i) => i.group === "admin"   && nav.includes(i.view));

  return (
    <>
      {/* ── Topbar ── */}
      <header className="shell-topnav">
        <div className="shell-topnav__left">
          <nav className="breadcrumb">
            <span>TimeSheet</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{VIEW_LABELS[view] ?? view}</span>
          </nav>
        </div>
        <div className="shell-topnav__right">
          <NotificationBell />
          <div className="topbar-divider" />
          <div className="topbar-user" title="Profile & settings" style={{ cursor: "pointer" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "var(--r-md)",
              background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.65rem", fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>{initials}</div>
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{session.username}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", textTransform: "capitalize" }}>{session.role}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Shell body ── */}
      <div className="shell-layout">
        {/* Sidebar */}
        <aside className={`shell-sidebar${collapsed ? " collapsed" : ""}`}>
          {/* Sidebar header: brand */}
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div className="sidebar-brand-icon">T</div>
                <span className="sidebar-brand-name">TimeSheet</span>
              </div>
              <button
                className="sidebar-collapse-btn"
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-tertiary)", display: "flex", alignItems: "center",
                  padding: 4, borderRadius: "var(--r-sm)", flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--n-100)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <CollapseIcon collapsed={collapsed} />
              </button>
            </div>
          </div>

          {/* Nav */}
          <div className="sidebar-nav-area">
            <div className="nav-section">
              {mainItems.map((item) => (
                <button
                  key={item.view}
                  className={`nav-item${view === item.view ? " active" : ""}`}
                  onClick={() => onNavigate(item.view)}
                >
                  {item.icon}
                  <span style={{ flex: 1 }}>{item.label}</span>
                </button>
              ))}
            </div>

            {managerItems.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-label">Management</span>
                {managerItems.map((item) => (
                  <button
                    key={item.view}
                    className={`nav-item${view === item.view ? " active" : ""}`}
                    onClick={() => onNavigate(item.view)}
                  >
                    {item.icon}
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {adminItems.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-label">Admin</span>
                {adminItems.map((item) => (
                  <button
                    key={item.view}
                    className={`nav-item${view === item.view ? " active" : ""}`}
                    onClick={() => onNavigate(item.view)}
                  >
                    {item.icon}
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer — logout */}
          <div className="sidebar-footer">
            <button
              className="nav-item"
              onClick={onLogout}
              style={{ width: "100%", color: "var(--text-secondary)" }}
            >
              <LogoutIcon />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="shell-content page-enter">
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

/* ─── Inline SVG icons (18×18) ────────────────────────────── */
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {collapsed
        ? <polyline points="9 18 15 12 9 6" />
        : <polyline points="15 18 9 12 15 6" />
      }
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function PolicyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  );
}
