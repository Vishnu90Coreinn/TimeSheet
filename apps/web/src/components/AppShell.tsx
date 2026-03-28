/**
 * AppShell.tsx — v3.0 exact Pulse reference layout
 */
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../api/client";
import { NotificationBell } from "./Notifications";
import type { Session } from "../types";
import type { View } from "../types";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsPanel } from "./ShortcutsPanel";
import { ThemeToggle } from "./ThemeToggle";
import { useTenantSettings } from "../contexts/TenantSettingsContext";
import { Palette as PaletteIcon } from "lucide-react";

interface NavItem {
  view: View;
  label: string;
  icon: ReactNode;
  group: "main" | "manager" | "admin";
  badge?: number;
  badgeVariant?: "danger" | "warning" | "brand";
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard",       label: "Dashboard",      icon: <DashboardIcon />,   group: "main" },
  { view: "timesheets",      label: "Timesheets",     icon: <ClockIcon />,       group: "main" },
  { view: "leave",           label: "Leave",          icon: <CalendarIcon />,    group: "main" },
  { view: "reports",         label: "Reports",        icon: <ChartIcon />,       group: "main" },
  { view: "approvals",       label: "Approvals",      icon: <CheckIcon />,       group: "manager", badgeVariant: "danger" },
  { view: "team",            label: "Team Status",    icon: <TeamIcon />,        group: "manager" },
  { view: "projects",        label: "Projects",       icon: <FolderIcon />,      group: "admin" },
  { view: "categories",      label: "Categories",     icon: <TagIcon />,         group: "admin" },
  { view: "users",           label: "Users",          icon: <UsersIcon />,       group: "admin" },
  { view: "holidays",        label: "Holidays",       icon: <StarIcon />,        group: "admin" },
  { view: "leave-policies",  label: "Leave Policies", icon: <LeavePolicyIcon />, group: "admin" },
  { view: "work-policies",   label: "Work Policies",  icon: <BriefcaseIcon />,   group: "admin" },
  { view: "branding",        label: "Branding",       icon: <PaletteIcon size={18} />, group: "admin" },
];

interface AppShellProps {
  session: Session;
  view: View;
  nav: View[];
  onNavigate: (v: View) => void;
  onNavigateProfile: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard", timesheets: "Timesheets", leave: "Leave",
  reports: "Reports", approvals: "Approvals", projects: "Projects",
  categories: "Categories", users: "Users", holidays: "Holidays",
  "leave-policies": "Leave Policies",
  "work-policies": "Work Policies",
  profile: "My Profile",
  team: "Team Status",
  branding: "Branding",
};

export function AppShell({ session, view, nav, onNavigate, onNavigateProfile, onLogout, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const initials = session.username.slice(0, 2).toUpperCase();
  const tenantSettings = useTenantSettings();

  // Close mobile sidebar when resizing to tablet/desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load pending approvals count for the Approvals badge
  useEffect(() => {
    if (!nav.includes("approvals")) return;
    apiFetch("/approvals/pending-timesheets")
      .then(async r => { if (r.ok) { const d = await r.json() as unknown[]; setPendingCount(d.length); } })
      .catch(() => {});
  }, [nav]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Cmd+K / Ctrl+K — toggle palette (always)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
        setShortcutsOpen(false);
        return;
      }

      // Everything below only fires when NOT in an input and palette/shortcuts are closed
      if (inInput || paletteOpen || shortcutsOpen) return;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Context-aware shortcuts
      if (e.key === "n" || e.key === "N") {
        if (view === "timesheets") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("cmd:new-entry"));
        }
        return;
      }
      if (e.key === "s" || e.key === "S") {
        if (view === "timesheets") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("cmd:submit-week"));
        }
        return;
      }
      if (e.key === "a" || e.key === "A") {
        if (view === "approvals") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("cmd:bulk-approve"));
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("cmd:focus-search"));
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, paletteOpen, shortcutsOpen]);

  // Inject live badge count into Approvals item
  const withBadges = NAV_ITEMS.map(item =>
    item.view === "approvals" ? { ...item, badge: pendingCount } : item
  );

  const mainItems    = withBadges.filter(i => i.group === "main"    && nav.includes(i.view));
  const managerItems = withBadges.filter(i => i.group === "manager" && nav.includes(i.view));
  const adminItems   = withBadges.filter(i => i.group === "admin"   && nav.includes(i.view));

  function renderNavItem(item: typeof withBadges[0]) {
    return (
      <button
        key={item.view}
        type="button"
        className={`nav-item${view === item.view ? " active" : ""}`}
        onClick={() => { onNavigate(item.view); setMobileOpen(false); }}
        data-tooltip={item.label}
      >
        {item.icon}
        <span className="flex-1">{item.label}</span>
        {(item.badge ?? 0) > 0 && (
          <span
            className={`nav-badge nav-badge-${item.badgeVariant ?? "brand"}`}
            aria-label={`${item.badge} pending`}
          >
            {(item.badge ?? 0) > 99 ? "99+" : item.badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* ── Topbar ── */}
      <header className="shell-topnav">
        <div className="shell-topnav__left">
          <button
            type="button"
            className="shell-topnav-hamburger icon-btn mr-1"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle navigation"
          >
            <HamburgerIcon />
          </button>
          <nav className="breadcrumb">
            <span>TimeSheet</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{VIEW_LABELS[view] ?? view}</span>
          </nav>
        </div>
        <div className="shell-topnav__right">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title="Command palette (⌘K)"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--color-n-100, #f0f0f0)",
              border: "1px solid var(--color-n-200, #e5e7eb)",
              borderRadius: 7,
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: "0.78rem",
              color: "#6b7280",
            }}
          >
            <span style={{ fontSize: "0.80rem" }}>🔍</span>
            <span>Search</span>
            <kbd style={{
              fontSize: "0.68rem",
              background: "var(--color-n-0, #fff)",
              border: "1px solid var(--color-n-200, #e5e7eb)",
              borderRadius: 4,
              padding: "1px 5px",
              fontFamily: "inherit",
            }}>⌘K</kbd>
          </button>
          <ThemeToggle />
          <NotificationBell />
          <div className="topbar-divider" />
          <div className="topbar-user" title="My Profile" onClick={onNavigateProfile}>
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[0.65rem] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))" }}
            >
              {initials}
            </div>
            <div>
              <div className="text-[0.8rem] font-semibold text-text-primary leading-[1.2]">{session.username}</div>
              <div className="text-[0.68rem] text-text-tertiary capitalize">{session.role}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Shell body ── */}
      <div className="shell-layout">
        {/* Mobile backdrop */}
        <div
          className={`shell-sidebar-backdrop${mobileOpen ? " mobile-open" : ""}`}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar */}
        <aside className={`shell-sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>

          {/* Brand header */}
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <div className="flex items-center gap-3">
                {tenantSettings.logoUrl ? (
                  <img
                    src={`http://localhost:5000${tenantSettings.logoUrl}`}
                    alt={tenantSettings.appName}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <div className="sidebar-brand-icon" aria-hidden="true">T</div>
                )}
                {!tenantSettings.logoUrl && (
                  <span className="sidebar-brand-name">{tenantSettings.appName}</span>
                )}
              </div>
              <button
                type="button"
                className="sidebar-collapse-btn"
                onClick={() => setCollapsed(c => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <CollapseIcon collapsed={collapsed} />
              </button>
            </div>
          </div>

          {/* User profile section */}
          <div className="sidebar-user-section">
            <div className="sidebar-user-row">
              <div className="relative">
                <div className="sidebar-user-avatar">{initials}</div>
                <span className="sidebar-user-online" aria-hidden="true" />
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{session.username}</div>
                <div className="sidebar-user-role capitalize">{session.role}</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="sidebar-nav-area">
            <div className="nav-section">
              <span className="nav-section-label">My Work</span>
              {mainItems.map(renderNavItem)}
            </div>

            {managerItems.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-label">My Team</span>
                {managerItems.map(renderNavItem)}
              </div>
            )}

            {adminItems.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-label">Admin</span>
                {adminItems.map(renderNavItem)}
              </div>
            )}
          </div>

          {/* Footer — logout */}
          <div className="sidebar-footer">
            <button
              type="button"
              className="nav-item nav-item--danger"
              onClick={onLogout}
              data-tooltip="Sign Out"
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

      {/* ── Command Palette ───────────────────────────────────────── */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={onNavigate}
        nav={nav}
        role={session.role}
        currentView={view}
      />

      {/* ── Keyboard Shortcuts Panel ──────────────────────────────── */}
      <ShortcutsPanel
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}

/* ─── Inline SVG icons (18×18) ────────────────────────────── */
function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {collapsed
        ? <polyline points="9 18 15 12 9 6" />
        : <polyline points="15 18 9 12 15 6" />
      }
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
/** Leave Policies — calendar with an X mark (distinct from CalendarIcon) */
function LeavePolicyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="9" y1="16" x2="15" y2="16"/>
      <line x1="12" y1="13" x2="12" y2="19"/>
    </svg>
  );
}
/** Team Status — group of people with activity pulse */
function TeamIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  );
}
/** Work Policies — briefcase icon (distinct from any clock) */
function BriefcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="12"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
