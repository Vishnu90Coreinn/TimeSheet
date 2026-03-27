/**
 * AppShell.tsx — v4.0 Precision Atelier
 * Fixed 72px dark sidebar, glassmorphism topbar, Material Symbols Outlined icons
 */
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../api/client";
import { NotificationBell } from "./Notifications";
import type { Session } from "../types";
import type { View } from "../types";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsPanel } from "./ShortcutsPanel";

/* ── Material Symbol helper ─────────────────────────────── */
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

interface NavItem {
  view: View;
  label: string;
  icon: string;   // Material Symbol name
  group: "main" | "manager" | "admin";
  badge?: number;
  badgeVariant?: "danger" | "warning" | "brand";
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard",      label: "Dashboard",      icon: "grid_view",       group: "main" },
  { view: "timesheets",     label: "Timesheets",      icon: "timer",           group: "main" },
  { view: "leave",          label: "Leave",           icon: "event_available", group: "main" },
  { view: "reports",        label: "Reports",         icon: "insert_chart",    group: "main" },
  { view: "approvals",      label: "Approvals",       icon: "rule",            group: "manager", badgeVariant: "danger" },
  { view: "team",           label: "Team Status",     icon: "groups",          group: "manager" },
  { view: "projects",       label: "Projects",        icon: "folder_open",     group: "admin" },
  { view: "categories",     label: "Categories",      icon: "label",           group: "admin" },
  { view: "users",          label: "Users",           icon: "manage_accounts", group: "admin" },
  { view: "holidays",       label: "Holidays",        icon: "celebration",     group: "admin" },
  { view: "leave-policies", label: "Leave Policies",  icon: "policy",          group: "admin" },
  { view: "work-policies",  label: "Work Policies",   icon: "work",            group: "admin" },
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
};

export function AppShell({ session, view, nav, onNavigate, onNavigateProfile, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const initials = session.username.slice(0, 2).toUpperCase();

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

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
        setShortcutsOpen(false);
        return;
      }

      if (inInput || paletteOpen || shortcutsOpen) return;

      if (e.key === "?") { e.preventDefault(); setShortcutsOpen(true); return; }

      if ((e.key === "n" || e.key === "N") && view === "timesheets") {
        e.preventDefault(); window.dispatchEvent(new CustomEvent("cmd:new-entry")); return;
      }
      if ((e.key === "s" || e.key === "S") && view === "timesheets") {
        e.preventDefault(); window.dispatchEvent(new CustomEvent("cmd:submit-week")); return;
      }
      if ((e.key === "a" || e.key === "A") && view === "approvals") {
        e.preventDefault(); window.dispatchEvent(new CustomEvent("cmd:bulk-approve")); return;
      }
      if (e.key === "/") {
        e.preventDefault(); window.dispatchEvent(new CustomEvent("cmd:focus-search")); return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, paletteOpen, shortcutsOpen]);

  // Inject live badge count into Approvals item
  const withBadges = NAV_ITEMS.map(item =>
    item.view === "approvals" ? { ...item, badge: pendingCount } : item
  );

  const visibleItems = withBadges.filter(i => nav.includes(i.view));

  function renderNavItem(item: typeof withBadges[0]) {
    const isActive = view === item.view;
    return (
      <div key={item.view} className="relative group">
        <button
          type="button"
          className={`nav-item${isActive ? " active" : ""}`}
          onClick={() => { onNavigate(item.view); setMobileOpen(false); }}
          aria-label={item.label}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon name={item.icon} />
          {/* Badge dot on icon */}
          {(item.badge ?? 0) > 0 && (
            <span
              aria-label={`${item.badge} pending`}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--tertiary)",
                border: "2px solid var(--inverse-surface)",
              }}
            />
          )}
        </button>
        {/* Tooltip */}
        <span style={{
          position: "absolute",
          left: "calc(100% + 12px)",
          top: "50%",
          transform: "translateY(-50%)",
          background: "var(--on-surface)",
          color: "#fff",
          fontSize: "0.75rem",
          fontWeight: 500,
          whiteSpace: "nowrap",
          padding: "4px 10px",
          borderRadius: "var(--r-md)",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.15s",
          zIndex: 200,
          boxShadow: "var(--shadow-float)",
        }} className="group-hover:opacity-100">
          {item.label}
          {(item.badge ?? 0) > 0 && (
            <span style={{ marginLeft: 6, background: "var(--tertiary)", color: "#fff", borderRadius: "9999px", padding: "1px 5px", fontSize: "0.65rem", fontWeight: 700 }}>
              {(item.badge ?? 0) > 99 ? "99+" : item.badge}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* ── Fixed Sidebar (72px) ─────────────────────────────── */}
      <aside
        className={`shell-sidebar${mobileOpen ? " mobile-open" : ""}`}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          width: "var(--sidebar-width)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "var(--space-6)",
          paddingBottom: "var(--space-6)",
          gap: "var(--space-1)",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--r-lg)",
            background: "rgba(192, 193, 255, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--inverse-primary)",
            fontWeight: 700,
            fontSize: "1rem",
            marginBottom: "var(--space-4)",
            flexShrink: 0,
          }}
        >
          T
        </div>

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)", flex: 1, width: "100%" }}>
          {visibleItems.map(renderNavItem)}
        </nav>

        {/* Bottom: Settings + Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", marginTop: "auto" }}>
          <div className="relative group">
            <button
              type="button"
              className="nav-item"
              onClick={onLogout}
              aria-label="Sign Out"
            >
              <Icon name="logout" />
            </button>
            <span style={{
              position: "absolute",
              left: "calc(100% + 12px)",
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--on-surface)",
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 500,
              whiteSpace: "nowrap",
              padding: "4px 10px",
              borderRadius: "var(--r-md)",
              pointerEvents: "none",
              opacity: 0,
              transition: "opacity 0.15s",
              zIndex: 200,
            }} className="group-hover:opacity-100">
              Sign Out
            </span>
          </div>

          {/* Avatar — opens profile */}
          <button
            type="button"
            onClick={onNavigateProfile}
            aria-label="My Profile"
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--r-lg)",
              background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
              border: "2px solid var(--primary-fixed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: "pointer",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {initials}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="shell-sidebar-backdrop mobile-open"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Main Stage ──────────────────────────────────────── */}
      <div style={{ paddingLeft: "var(--sidebar-width)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Topbar */}
        <header className="shell-topnav">
          <div className="shell-topnav__left">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="shell-topnav-hamburger icon-btn mr-1"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle navigation"
            >
              <Icon name="menu" />
            </button>

            {/* Page title */}
            <h1 style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--inverse-surface)",
              letterSpacing: "-0.015em",
            }}>
              {VIEW_LABELS[view] ?? view}
            </h1>

            {/* Inline search trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              title="Command palette (⌘K)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface-container-low)",
                border: "none",
                borderRadius: "var(--r-lg)",
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "var(--on-surface-variant)",
                marginLeft: "var(--space-5)",
              }}
            >
              <Icon name="search" size={18} />
              <span>Search</span>
              <kbd style={{
                fontSize: "0.7rem",
                background: "var(--surface-container)",
                border: "none",
                borderRadius: "var(--r-sm)",
                padding: "1px 6px",
                fontFamily: "inherit",
                color: "var(--on-surface-variant)",
              }}>⌘K</kbd>
            </button>
          </div>

          <div className="shell-topnav__right">
            <NotificationBell />
            <div className="topbar-divider" />
            <div className="topbar-user" title={session.username} onClick={onNavigateProfile}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--on-surface)", lineHeight: 1.3 }}>
                  {session.username}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--on-surface-variant)", textTransform: "capitalize" }}>
                  {session.role}
                </div>
              </div>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "var(--r-lg)",
                background: "linear-gradient(135deg, var(--primary), var(--primary-container))",
                border: "2px solid var(--primary-fixed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.72rem",
                flexShrink: 0,
              }}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="shell-content page-enter" style={{ flex: 1 }}>
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>

      {/* ── Command Palette ─────────────────────────────────── */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={onNavigate}
        nav={nav}
        role={session.role}
        currentView={view}
      />

      {/* ── Keyboard Shortcuts Panel ─────────────────────────── */}
      <ShortcutsPanel
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}
