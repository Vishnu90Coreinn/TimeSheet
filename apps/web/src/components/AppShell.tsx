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
import {
  LayoutDashboard, Clock, CalendarDays, BarChart3,
  CircleCheck, Users, Briefcase, UserCog, Tag, Star,
  CalendarClock, ClipboardList, Palette, ShieldCheck,
  ScrollText, KeyRound, LogOut as LogOutLucide,
  ChevronRight, LayoutGrid, Search,
} from "lucide-react";

interface NavItem {
  view: View;
  label: string;
  icon: ReactNode;
  group: "main" | "manager" | "admin";
  badge?: number;
  badgeVariant?: "danger" | "warning" | "brand";
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard",       label: "Dashboard",      icon: <LayoutDashboard size={16} strokeWidth={1.5} />,  group: "main" },
  { view: "timesheets",      label: "Timesheets",     icon: <Clock size={16} strokeWidth={1.5} />,            group: "main" },
  { view: "leave",           label: "Leave",          icon: <CalendarDays size={16} strokeWidth={1.5} />,     group: "main" },
  { view: "reports",         label: "Reports",        icon: <BarChart3 size={16} strokeWidth={1.5} />,        group: "main" },
  { view: "approvals",       label: "Approvals",      icon: <CircleCheck size={16} strokeWidth={1.5} />,      group: "manager", badgeVariant: "danger" },
  { view: "team",            label: "Team Status",    icon: <Users size={16} strokeWidth={1.5} />,            group: "manager" },
  { view: "capacity",        label: "Capacity",       icon: <BarChart3 size={16} strokeWidth={1.5} />,        group: "manager" },
  { view: "admin",           label: "Admin Hub",      icon: <LayoutGrid size={16} strokeWidth={1.5} />,       group: "admin" },
  { view: "projects",        label: "Projects",       icon: <Briefcase size={16} strokeWidth={1.5} />,        group: "admin" },
  { view: "users",           label: "Users",          icon: <UserCog size={16} strokeWidth={1.5} />,          group: "admin" },
  { view: "categories",      label: "Categories",     icon: <Tag size={16} strokeWidth={1.5} />,              group: "admin" },
  { view: "holidays",        label: "Holidays",       icon: <Star size={16} strokeWidth={1.5} />,             group: "admin" },
  { view: "leave-policies",  label: "Leave Policies", icon: <CalendarClock size={16} strokeWidth={1.5} />,    group: "admin" },
  { view: "work-policies",   label: "Work Policies",  icon: <ClipboardList size={16} strokeWidth={1.5} />,    group: "admin" },
  { view: "branding",          label: "Branding",        icon: <Palette size={16} strokeWidth={1.5} />,       group: "admin" },
  { view: "retention-policy",  label: "Data Retention",  icon: <ShieldCheck size={16} strokeWidth={1.5} />,   group: "admin" },
  { view: "audit-logs",        label: "Audit Logs",      icon: <ScrollText size={16} strokeWidth={1.5} />,    group: "admin" },
  { view: "password-policy",   label: "Password Policy", icon: <KeyRound size={16} strokeWidth={1.5} />,      group: "admin" },
];

const ADMIN_GROUPS: { key: string; label: string; views: View[] }[] = [
  { key: "people",    label: "People & Organization", views: ["users", "projects", "categories"] },
  { key: "timeLeave", label: "Time & Leave",          views: ["holidays", "leave-policies", "work-policies"] },
  { key: "system",    label: "System",                views: ["branding", "audit-logs", "retention-policy", "password-policy"] },
];

const VIEW_LABELS: Record<View, string> = {
  admin: "Admin Hub",
  dashboard: "Dashboard",
  timesheets: "Timesheets",
  leave: "Leave",
  reports: "Reports",
  approvals: "Approvals",
  projects: "Projects",
  categories: "Categories",
  users: "Users",
  holidays: "Holidays",
  "leave-policies": "Leave Policies",
  "work-policies": "Work Policies",
  profile: "My Profile",
  team: "Team Status",
  capacity: "Capacity Planning",
  branding: "Branding",
  "retention-policy": "Data Retention",
  "audit-logs": "Audit Logs",
  "password-policy": "Password Policy",
};

interface AppShellProps {
  session: Session;
  view: View;
  nav: View[];
  onNavigate: (v: View) => void;
  onNavigateProfile: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ session, view, nav, onNavigate, onNavigateProfile, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("shell.sidebar.collapsed") === "1";
  });
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1280;
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = window.localStorage.getItem("shell.admin.groups");
      return saved ? JSON.parse(saved) : { people: false, timeLeave: false, system: false };
    } catch {
      return { people: false, timeLeave: false, system: false };
    }
  });

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = { ...prev, [key]: !prev[key] };
      window.localStorage.setItem("shell.admin.groups", JSON.stringify(next));
      return next;
    });
  }
  const initials = session.username.slice(0, 2).toUpperCase();
  const roleKey = session.role.toLowerCase();
  const isAdminManagementView =
    roleKey === "admin" && (view === "users" || view === "projects" || view === "categories");
  const tenantSettings = useTenantSettings();

  // Close mobile sidebar when resizing to tablet/desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
      setIsDesktop(window.innerWidth >= 1280);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("shell.sidebar.collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  // Load pending approvals count for the Approvals badge
  useEffect(() => {
    if (!nav.includes("approvals")) return;
    apiFetch("/approvals/pending-timesheets?page=1&pageSize=1")
      .then(async r => {
        if (r.ok) {
          const d = await r.json() as { totalCount?: number };
          setPendingCount(d.totalCount ?? 0);
        }
      })
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

  const mainItems = withBadges.filter(i => i.group === "main" && nav.includes(i.view));
  const managerItems = withBadges.filter(i => i.group === "manager" && nav.includes(i.view));
  const adminItems = withBadges.filter(i => i.group === "admin" && nav.includes(i.view));

  function renderNavItem(item: typeof withBadges[0]) {
    return (
      <button
        key={item.view}
        type="button"
        className={`nav-item${view === item.view ? " active" : ""}`}
        onClick={() => { onNavigate(item.view); setMobileOpen(false); }}
        data-tooltip={item.label}
        title={item.label}
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
            className="topbar-search-btn"
            onClick={() => setPaletteOpen(true)}
            title="Command palette (⌘K)"
          >
            <Search size={14} strokeWidth={1.75} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <ThemeToggle />
          <NotificationBell />
          <div className="topbar-divider" />
          <button
            type="button"
            className="topbar-avatar-btn"
            onClick={onNavigateProfile}
            title={`${session.username} — My Profile`}
          >
            <div className="topbar-avatar-icon">{initials}</div>
          </button>
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
        <aside className={`shell-sidebar${mobileOpen ? " mobile-open" : ""}${isDesktop && sidebarCollapsed ? " collapsed" : ""}`}>

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
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <ChevronIcon collapsed={sidebarCollapsed} />
              </button>
            </div>
          </div>

          {/* Nav */}
          <div className="sidebar-nav-area">
            <div className="nav-section">
              <span className="nav-section-label">My Work</span>
              {mainItems.map(renderNavItem)}
            </div>

            {roleKey !== "admin" && managerItems.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-label">My Team</span>
                {managerItems.map(renderNavItem)}
              </div>
            )}

            {adminItems.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-label">Administration</span>
                {/* Admin Hub — pinned shortcut to admin dashboard */}
                {adminItems.filter(i => i.view === "admin").map(renderNavItem)}
                {/* Collapsible sub-groups */}
                {ADMIN_GROUPS.map(group => {
                  const groupItems = group.views
                    .map(v => adminItems.find(i => i.view === v))
                    .filter((i): i is NonNullable<typeof i> => Boolean(i));
                  if (groupItems.length === 0) return null;
                  const isOpen = !collapsedGroups[group.key];
                  return (
                    <div key={group.key}>
                      <button
                        type="button"
                        className={`nav-subgroup-header${isOpen ? " open" : ""}`}
                        onClick={() => toggleGroup(group.key)}
                      >
                        <ChevronRight size={12} strokeWidth={2} className="subgroup-chevron" />
                        <span>{group.label}</span>
                      </button>
                      {isOpen && (
                        <div className="nav-subgroup-items">
                          {groupItems.map(renderNavItem)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer — identity + sign out */}
          <div className="sidebar-footer">
            <div className="sidebar-identity">
              <button
                type="button"
                className="sidebar-identity-row"
                onClick={() => { onNavigateProfile(); setMobileOpen(false); }}
                title="My Profile"
              >
                <div className="sidebar-identity-avatar">{initials}</div>
                <div className="sidebar-identity-info">
                  <div className="sidebar-identity-name">{session.username}</div>
                  <div className="sidebar-identity-role">{session.role}</div>
                </div>
              </button>
            </div>
            <div className="sidebar-identity-separator" />
            <button
              type="button"
              className="nav-item nav-item--danger"
              onClick={onLogout}
              data-tooltip="Sign out"
            >
              <LogOutLucide size={16} strokeWidth={1.5} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className={`shell-content page-enter${isAdminManagementView ? " shell-content--wide" : ""}`}>
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

/* ─── Structural SVG icons (not nav icons) ─────────────────── */
function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
    </svg>
  );
}
