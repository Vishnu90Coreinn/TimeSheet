/**
 * AppShell.tsx — Design system Step 1c.
 * Provides the sticky top nav + sidebar layout that wraps all authenticated pages.
 * Business logic (routing, auth) stays in App.tsx — this is purely presentational.
 */
import type { ReactNode } from "react";
import { NotificationBell } from "./Notifications";
import type { Session } from "../types";
import type { View } from "../types";

/* ─── Nav item config ─────────────────────────────────────── */
interface NavItem {
  view: View;
  label: string;
  icon: ReactNode;
  group: "main" | "manager" | "admin";
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard",  label: "Dashboard",  icon: <DashboardIcon />, group: "main" },
  { view: "timesheets", label: "Timesheets", icon: <ClockIcon />,     group: "main" },
  { view: "leave",      label: "Leave",      icon: <CalendarIcon />,  group: "main" },
  { view: "reports",    label: "Reports",    icon: <ChartIcon />,     group: "main" },
  { view: "approvals",  label: "Approvals",  icon: <CheckIcon />,     group: "manager" },
  { view: "projects",   label: "Projects",   icon: <FolderIcon />,    group: "admin" },
  { view: "categories", label: "Categories", icon: <TagIcon />,       group: "admin" },
  { view: "users",      label: "Users",      icon: <UsersIcon />,     group: "admin" },
  { view: "holidays",   label: "Holidays",   icon: <StarIcon />,      group: "admin" },
];

interface AppShellProps {
  session: Session;
  view: View;
  nav: View[];
  onNavigate: (v: View) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ session, view, nav, onNavigate, onLogout, children }: AppShellProps) {
  const initials = session.username.slice(0, 2).toUpperCase();

  const mainItems    = NAV_ITEMS.filter((i) => i.group === "main"    && nav.includes(i.view));
  const managerItems = NAV_ITEMS.filter((i) => i.group === "manager" && nav.includes(i.view));
  const adminItems   = NAV_ITEMS.filter((i) => i.group === "admin"   && nav.includes(i.view));

  return (
    <>
      {/* ── Top Navigation Bar ── */}
      <nav className="shell-topnav">
        <div className="shell-logo">
          <div className="shell-logo__mark">
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
              <path d="M20 6L34 13V27L20 34L6 27V13L20 6Z" stroke="white" strokeWidth="2.5" fill="none" />
              <circle cx="20" cy="20" r="4" fill="white" />
            </svg>
          </div>
          <span className="shell-logo__name">TimeSheet</span>
        </div>

        <div className="shell-topnav__spacer" />

        <div className="shell-topnav__right">
          <NotificationBell />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div className="shell-avatar">{initials}</div>
            <div>
              <div className="shell-user-name">{session.username}</div>
              <div className="shell-user-role">{session.role}</div>
            </div>
          </div>
          <button className="btn-ghost" onClick={onLogout} title="Sign out">
            <LogoutIcon />
            Logout
          </button>
        </div>
      </nav>

      {/* ── Body: Sidebar + Content ── */}
      <div className="shell-layout">
        <aside className="shell-sidebar">
          {/* Main nav */}
          <div className="shell-nav-group">
            {mainItems.map((item) => (
              <button
                key={item.view}
                className={`shell-nav-item${view === item.view ? " active" : ""}`}
                onClick={() => onNavigate(item.view)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Manager nav */}
          {managerItems.length > 0 && (
            <div className="shell-nav-group">
              <div className="shell-nav-group-label">Management</div>
              {managerItems.map((item) => (
                <button
                  key={item.view}
                  className={`shell-nav-item${view === item.view ? " active" : ""}`}
                  onClick={() => onNavigate(item.view)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Admin nav */}
          {adminItems.length > 0 && (
            <div className="shell-nav-group">
              <div className="shell-nav-group-label">Admin</div>
              {adminItems.map((item) => (
                <button
                  key={item.view}
                  className={`shell-nav-item${view === item.view ? " active" : ""}`}
                  onClick={() => onNavigate(item.view)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Page content area */}
        <main className="shell-content page-enter">
          {children}
        </main>
      </div>
    </>
  );
}

/* ─── Inline SVG icons (18×18) ────────────────────────────── */
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
