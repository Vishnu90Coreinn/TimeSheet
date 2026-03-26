/**
 * CommandPalette.tsx — Cmd+K global search & action overlay
 */
import { useEffect, useRef, useState } from "react";
import type { View } from "../types";

interface Command {
  id: string;
  label: string;
  category: "Navigate" | "Actions" | "Search";
  shortcut?: string;
  icon: string;          // emoji
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (v: View) => void;
  nav: View[];
  role: string;
  currentView: View;
}

const VIEW_LABELS: Partial<Record<View, string>> = {
  dashboard: "Dashboard", timesheets: "Timesheets", leave: "Leave",
  reports: "Reports", approvals: "Approvals", team: "Team Status",
  projects: "Projects", categories: "Task Categories", users: "Users",
  holidays: "Holidays", "leave-policies": "Leave Policies", "work-policies": "Work Policies",
  profile: "My Profile",
};

const VIEW_ICONS: Partial<Record<View, string>> = {
  dashboard: "📊", timesheets: "⏱️", leave: "🏖️", reports: "📈",
  approvals: "✅", team: "👥", projects: "📁", categories: "🏷️",
  users: "👤", holidays: "⭐", "leave-policies": "📋", "work-policies": "💼", profile: "🙂",
};

export function CommandPalette({ open, onClose, onNavigate, nav, role, currentView }: Props) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build static command list
  const commands: Command[] = [
    // Navigate commands — one per accessible view
    ...nav.map(v => ({
      id: `nav-${v}`,
      label: `Go to ${VIEW_LABELS[v] ?? v}`,
      category: "Navigate" as const,
      icon: VIEW_ICONS[v] ?? "→",
      action: () => { onNavigate(v); onClose(); },
    })),
    // Profile is always accessible
    {
      id: "nav-profile",
      label: "Go to My Profile",
      category: "Navigate",
      icon: "🙂",
      action: () => { onNavigate("profile"); onClose(); },
    },
    // Action commands
    {
      id: "action-new-entry",
      label: "New Timesheet Entry",
      category: "Actions",
      icon: "➕",
      shortcut: "N",
      action: () => { window.dispatchEvent(new CustomEvent("cmd:new-entry")); onClose(); },
    },
    {
      id: "action-submit-week",
      label: "Submit Week",
      category: "Actions",
      icon: "📤",
      shortcut: "S",
      action: () => { window.dispatchEvent(new CustomEvent("cmd:submit-week")); onClose(); },
    },
    {
      id: "action-apply-leave",
      label: "Apply for Leave",
      category: "Actions",
      icon: "🏖️",
      action: () => { window.dispatchEvent(new CustomEvent("cmd:apply-leave")); onClose(); },
    },
    ...(role === "admin" ? [{
      id: "action-new-user",
      label: "New User",
      category: "Actions" as const,
      icon: "👤",
      action: () => { window.dispatchEvent(new CustomEvent("cmd:new-user")); onClose(); },
    }, {
      id: "action-new-project",
      label: "New Project",
      category: "Actions" as const,
      icon: "📁",
      action: () => { window.dispatchEvent(new CustomEvent("cmd:new-project")); onClose(); },
    }] : []),
    ...((role === "manager" || role === "admin") ? [{
      id: "action-bulk-approve",
      label: "Approve Selected Timesheets",
      category: "Actions" as const,
      icon: "✅",
      shortcut: "A",
      action: () => { window.dispatchEvent(new CustomEvent("cmd:bulk-approve")); onClose(); },
    }] : []),
  ];

  // Filter by query
  const q = query.toLowerCase().trim();
  const filtered = q
    ? commands.filter(c =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      )
    : commands;

  // Group by category for display
  const grouped: { category: string; items: typeof filtered }[] = [];
  for (const cmd of filtered) {
    let g = grouped.find(x => x.category === cmd.category);
    if (!g) { g = { category: cmd.category, items: [] }; grouped.push(g); }
    g.items.push(cmd);
  }

  // Flat index for keyboard navigation
  const flatItems = filtered;

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Clamp activeIdx when filtered list changes
  useEffect(() => {
    setActiveIdx(i => Math.min(i, Math.max(flatItems.length - 1, 0)));
  }, [flatItems.length]);

  // Keyboard handler
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatItems.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = flatItems[activeIdx];
        if (cmd) cmd.action();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIdx, flatItems]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--color-n-0, #fff)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 560,
          boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--color-n-100, #f0f0f0)" }}>
          <span style={{ fontSize: "1.1rem", opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Search commands, navigate views…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: "0.95rem", background: "transparent",
              color: "var(--color-text, #111)",
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd style={{
            fontSize: "0.72rem", background: "var(--color-n-100, #f0f0f0)",
            borderRadius: 5, padding: "2px 6px", color: "#6b7280", fontFamily: "inherit"
          }}>esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {flatItems.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted, #9ca3af)", fontSize: "0.88rem" }}>
              No commands found
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.category}>
                <div style={{
                  padding: "8px 16px 4px",
                  fontSize: "0.70rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted, #9ca3af)"
                }}>
                  {group.category}
                </div>
                {group.items.map(cmd => {
                  const globalIdx = flatItems.indexOf(cmd);
                  const isActive = globalIdx === activeIdx;
                  return (
                    <button
                      key={cmd.id}
                      data-active={isActive}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "9px 16px",
                        border: "none",
                        background: isActive ? "var(--brand-50, rgba(99,102,241,0.08))" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={() => setActiveIdx(globalIdx)}
                      onClick={() => cmd.action()}
                    >
                      <span style={{ fontSize: "1rem", width: 20, textAlign: "center", flexShrink: 0 }}>{cmd.icon}</span>
                      <span style={{
                        flex: 1,
                        fontSize: "0.88rem",
                        color: isActive ? "rgb(67,56,202)" : "var(--color-text, #111)",
                        fontWeight: isActive ? 500 : 400,
                      }}>
                        {cmd.label}
                      </span>
                      {cmd.shortcut && (
                        <kbd style={{
                          fontSize: "0.70rem",
                          background: isActive ? "rgba(99,102,241,0.15)" : "var(--color-n-100, #f0f0f0)",
                          color: isActive ? "rgb(67,56,202)" : "#6b7280",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontFamily: "inherit",
                        }}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--color-n-100, #f0f0f0)",
          display: "flex", gap: 16, fontSize: "0.72rem", color: "#9ca3af",
        }}>
          <span><kbd style={{ background: "#f0f0f0", borderRadius: 3, padding: "1px 5px", fontSize: "0.70rem" }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: "#f0f0f0", borderRadius: 3, padding: "1px 5px", fontSize: "0.70rem" }}>↵</kbd> execute</span>
          <span><kbd style={{ background: "#f0f0f0", borderRadius: 3, padding: "1px 5px", fontSize: "0.70rem" }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
