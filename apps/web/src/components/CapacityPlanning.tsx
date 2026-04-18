import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeekCell {
  weekStart: string;
  loggedHours: number;
  pct: number;
}

interface CapacityUserRow {
  userId: string;
  username: string;
  displayName: string | null;
  availableHoursPerWeek: number;
  weeks: WeekCell[];
}

interface CapacityTeamResponse {
  weekStarts: string[];
  rows: CapacityUserRow[];
}

interface ProjectContribution {
  userId: string;
  username: string;
  loggedHours: number;
}

interface CapacityProjectItem {
  projectId: string;
  projectName: string;
  budgetedHours: number;
  loggedHours: number;
  pct: number;
  contributions: ProjectContribution[];
}

interface OverallocatedUser {
  userId: string;
  username: string;
  displayName: string | null;
  availableHoursPerWeek: number;
  loggedHours: number;
  pct: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function fmtWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function toYM(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function cellColor(pct: number): { bg: string; text: string; border: string } {
  if (pct >= 100) return { bg: "rgba(239,68,68,0.12)", text: "#dc2626", border: "rgba(239,68,68,0.35)" };
  if (pct >= 80)  return { bg: "rgba(245,158,11,0.12)", text: "#d97706", border: "rgba(245,158,11,0.35)" };
  if (pct > 0)    return { bg: "rgba(16,185,129,0.10)", text: "#059669", border: "rgba(16,185,129,0.30)" };
  return { bg: "var(--surface-2, #f9fafb)", text: "var(--n-400, #9ca3af)", border: "var(--border-subtle, #e5e7eb)" };
}

function avatarColor(name: string): string {
  const colors = ["#4f46e5","#7c3aed","#0ea5e9","#10b981","#f59e0b","#f43f5e","#0d9488","#9333ea"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function displayName(row: { username: string; displayName: string | null }): string {
  return row.displayName ?? row.username;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: "heatmap" | "projects";
  onChange: (t: "heatmap" | "projects") => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: "var(--surface-2, #f3f4f6)",
        borderRadius: 10,
        padding: 3,
        width: "fit-content",
      }}
      role="tablist"
    >
      {(["heatmap", "projects"] as const).map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          style={{
            padding: "5px 18px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.82rem",
            fontWeight: 600,
            transition: "all 0.15s ease",
            background: active === t ? "var(--surface-0, #fff)" : "transparent",
            color: active === t ? "var(--brand-600, #4f46e5)" : "var(--n-500, #6b7280)",
            boxShadow: active === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {t === "heatmap" ? "Team Heatmap" : "Project Allocation"}
        </button>
      ))}
    </div>
  );
}

function WeekNav({
  weekStart,
  weeks,
  onPrev,
  onNext,
  onWeeksChange,
}: {
  weekStart: string;
  weeks: number;
  onPrev: () => void;
  onNext: () => void;
  onWeeksChange: (w: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 500 }}>
        Starting
      </span>
      <span
        style={{
          fontWeight: 600,
          fontSize: "0.82rem",
          color: "var(--text-primary)",
          background: "var(--surface-2, #f3f4f6)",
          padding: "3px 10px",
          borderRadius: 6,
        }}
      >
        {fmtWeek(weekStart)}
      </span>
      <button
        onClick={onPrev}
        aria-label="Previous week"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-0, #fff)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: "0.9rem",
          padding: 0,
        }}
      >
        ‹
      </button>
      <button
        onClick={onNext}
        aria-label="Next week"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-0, #fff)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: "0.9rem",
          padding: 0,
        }}
      >
        ›
      </button>
      <select
        value={weeks}
        onChange={(e) => onWeeksChange(Number(e.target.value))}
        aria-label="Number of weeks"
        style={{
          fontSize: "0.78rem",
          padding: "3px 8px",
          borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-0, #fff)",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {[2, 4, 6, 8, 12].map((w) => (
          <option key={w} value={w}>{w} weeks</option>
        ))}
      </select>
    </div>
  );
}

function MonthNav({
  month,
  onPrev,
  onNext,
}: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)", minWidth: 140 }}>
        {fmtMonth(month)}
      </span>
      <button
        onClick={onPrev}
        aria-label="Previous month"
        style={{
          width: 28, height: 28, borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-0,#fff)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-secondary)", fontSize: "0.9rem", padding: 0,
        }}
      >‹</button>
      <button
        onClick={onNext}
        aria-label="Next month"
        style={{
          width: 28, height: 28, borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-0,#fff)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-secondary)", fontSize: "0.9rem", padding: 0,
        }}
      >›</button>
    </div>
  );
}

function OverallocationBanner({ users }: { users: OverallocatedUser[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (!users.length || dismissed) return null;
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        background: "rgba(239,68,68,0.07)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "#b91c1c",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "0.83rem" }}>
          {users.length === 1
            ? `${displayName(users[0])} is overallocated this week (${users[0].pct}%)`
            : `${users.length} team members are overallocated this week`}
        </div>
        {users.length > 1 && (
          <div style={{ fontSize: "0.75rem", marginTop: 3, opacity: 0.85 }}>
            {users.map(u => `${displayName(u)} (${u.pct}%)`).join(" · ")}
          </div>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss alert"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#b91c1c", fontSize: "1.1rem", padding: "0 4px", lineHeight: 1,
          opacity: 0.7, flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function HeatmapLegend() {
  const items = [
    { color: "#10b981", label: "< 80% (on track)" },
    { color: "#d97706", label: "80–99% (near capacity)" },
    { color: "#dc2626", label: "≥ 100% (over capacity)" },
    { color: "#9ca3af", label: "No data" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Team Heatmap ──────────────────────────────────────────────────────────────
function TeamHeatmap({
  data,
  loading,
  weekStart,
  weeks,
  onPrev,
  onNext,
  onWeeksChange,
}: {
  data: CapacityTeamResponse | null;
  loading: boolean;
  weekStart: string;
  weeks: number;
  onPrev: () => void;
  onNext: () => void;
  onWeeksChange: (w: number) => void;
}) {
  const [tooltip, setTooltip] = useState<{ userId: string; weekStart: string } | null>(null);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 44, borderRadius: 8, background: "var(--n-100, #f3f4f6)", animation: "pulse 1.4s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  if (!data || !data.rows.length) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35 }} aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem" }}>No team members found</p>
      </div>
    );
  }

  const WEEK_COL_MIN = 80;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <WeekNav weekStart={weekStart} weeks={weeks} onPrev={onPrev} onNext={onNext} onWeeksChange={onWeeksChange} />
        <HeatmapLegend />
      </div>

      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }} role="grid" aria-label="Team capacity heatmap">
          <thead>
            <tr>
              <th
                style={{
                  padding: "8px 14px",
                  textAlign: "left",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                  background: "var(--surface-2, #f9fafb)",
                  borderBottom: "1px solid var(--border-subtle)",
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  whiteSpace: "nowrap",
                  minWidth: 160,
                }}
              >
                Member
              </th>
              <th
                style={{
                  padding: "8px 10px",
                  textAlign: "center",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                  background: "var(--surface-2, #f9fafb)",
                  borderBottom: "1px solid var(--border-subtle)",
                  whiteSpace: "nowrap",
                  minWidth: 70,
                }}
              >
                Target
              </th>
              {(data.weekStarts || []).map((ws) => (
                <th
                  key={ws}
                  style={{
                    padding: "8px 6px",
                    textAlign: "center",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    background: "var(--surface-2, #f9fafb)",
                    borderBottom: "1px solid var(--border-subtle)",
                    whiteSpace: "nowrap",
                    minWidth: WEEK_COL_MIN,
                  }}
                >
                  {fmtWeek(ws)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr
                key={row.userId}
                style={{
                  background: ri % 2 === 0 ? "var(--surface-0, #fff)" : "var(--surface-2, #fafafa)",
                }}
              >
                {/* Member cell */}
                <td
                  style={{
                    padding: "8px 14px",
                    borderBottom: ri < data.rows.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    position: "sticky",
                    left: 0,
                    background: ri % 2 === 0 ? "var(--surface-0, #fff)" : "var(--surface-2, #fafafa)",
                    zIndex: 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: avatarColor(row.username),
                        color: "#fff",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      {initials(displayName(row))}
                    </div>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 130,
                      }}
                      title={displayName(row)}
                    >
                      {displayName(row)}
                    </span>
                  </div>
                </td>

                {/* Available hours cell */}
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "center",
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    borderBottom: ri < data.rows.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.availableHoursPerWeek}h
                </td>

                {/* Week cells */}
                {row.weeks.map((week) => {
                  const c = cellColor(week.pct);
                  const isHovered = tooltip?.userId === row.userId && tooltip?.weekStart === week.weekStart;
                  return (
                    <td
                      key={week.weekStart}
                      style={{
                        padding: "6px",
                        borderBottom: ri < data.rows.length - 1 ? "1px solid var(--border-subtle)" : "none",
                        position: "relative",
                      }}
                      onMouseEnter={() => setTooltip({ userId: row.userId, weekStart: week.weekStart })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div
                        style={{
                          borderRadius: 6,
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                          padding: "4px 6px",
                          textAlign: "center",
                          cursor: "default",
                          transition: "transform 0.1s ease, box-shadow 0.1s ease",
                          transform: isHovered ? "scale(1.05)" : "scale(1)",
                          boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
                        }}
                      >
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: c.text, lineHeight: 1 }}>
                          {week.pct > 0 ? `${week.pct}%` : "—"}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: c.text, opacity: 0.8, marginTop: 2 }}>
                          {week.loggedHours > 0 ? `${week.loggedHours}h` : "no data"}
                        </div>
                      </div>
                      {/* Tooltip */}
                      {isHovered && (
                        <div
                          role="tooltip"
                          style={{
                            position: "absolute",
                            bottom: "calc(100% + 4px)",
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "rgba(15,15,20,0.92)",
                            color: "#fff",
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontSize: "0.72rem",
                            whiteSpace: "nowrap",
                            zIndex: 10,
                            pointerEvents: "none",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{displayName(row)}</div>
                          <div style={{ opacity: 0.8 }}>Week of {fmtWeek(week.weekStart)}</div>
                          <div style={{ marginTop: 2 }}>
                            {week.loggedHours}h logged · {row.availableHoursPerWeek}h target · <span style={{ fontWeight: 600 }}>{week.pct}%</span>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Project Allocation ────────────────────────────────────────────────────────

const PROJECT_PALETTE = [
  "#4f46e5","#7c3aed","#0ea5e9","#10b981",
  "#f59e0b","#f43f5e","#0d9488","#9333ea","#64748b",
];

function ProjectAllocation({
  data,
  loading,
  month,
  onPrev,
  onNext,
}: {
  data: CapacityProjectItem[];
  loading: boolean;
  month: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ height: 54, borderRadius: 8, background: "var(--n-100,#f3f4f6)", animation: "pulse 1.4s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-secondary)" }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35 }} aria-hidden="true">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        <p style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>No project data for this month</p>
      </div>
    );
  }

  const maxHours = Math.max(...data.map(p => Math.max(p.loggedHours, p.budgetedHours || 0)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <MonthNav month={month} onPrev={onPrev} onNext={onNext} />
        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          {data.length} project{data.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((project, pi) => {
          const color = PROJECT_PALETTE[pi % PROJECT_PALETTE.length];
          const loggedPct = maxHours > 0 ? Math.round((project.loggedHours / maxHours) * 100) : 0;
          const budgetPct = maxHours > 0 && project.budgetedHours > 0
            ? Math.round((project.budgetedHours / maxHours) * 100)
            : 0;
          const isOverBudget = project.budgetedHours > 0 && project.loggedHours > project.budgetedHours;
          const isExpanded = expanded === project.projectId;

          return (
            <div
              key={project.projectId}
              className="card"
              style={{ padding: "12px 16px", cursor: "pointer", transition: "box-shadow 0.15s" }}
              onClick={() => setExpanded(isExpanded ? null : project.projectId)}
              role="button"
              aria-expanded={isExpanded}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(isExpanded ? null : project.projectId); }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {project.projectName}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  {isOverBudget && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#dc2626", background: "rgba(239,68,68,0.1)", padding: "2px 7px", borderRadius: 20 }}>
                      Over budget
                    </span>
                  )}
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: color }}>{project.loggedHours}h</span>
                  {project.budgetedHours > 0 && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>of {project.budgetedHours}h</span>
                  )}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "none", color: "var(--text-tertiary)", flexShrink: 0 }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>

              {/* Bar track */}
              <div style={{ position: "relative", height: 8, background: "var(--n-100,#f3f4f6)", borderRadius: 4, overflow: "hidden" }}>
                {/* Budget marker */}
                {budgetPct > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${budgetPct}%`,
                      background: "rgba(0,0,0,0.08)",
                      borderRight: "2px dashed rgba(0,0,0,0.2)",
                    }}
                    aria-hidden="true"
                  />
                )}
                {/* Logged fill */}
                <div
                  style={{
                    height: "100%",
                    width: `${loggedPct}%`,
                    background: isOverBudget ? "#ef4444" : color,
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }}
                  role="progressbar"
                  aria-valuenow={project.loggedHours}
                  aria-valuemin={0}
                  aria-valuemax={maxHours}
                  aria-label={`${project.projectName}: ${project.loggedHours}h logged`}
                />
              </div>

              {/* Expanded: contributions */}
              {isExpanded && project.contributions.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 8 }}>
                    Team contributions
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...project.contributions]
                      .sort((a, b) => b.loggedHours - a.loggedHours)
                      .map((contrib) => {
                        const contribPct = project.loggedHours > 0
                          ? Math.round((contrib.loggedHours / project.loggedHours) * 100)
                          : 0;
                        return (
                          <div key={contrib.userId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: avatarColor(contrib.username),
                                color: "#fff",
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                              aria-hidden="true"
                            >
                              {initials(contrib.username)}
                            </div>
                            <span style={{ fontSize: "0.77rem", color: "var(--text-secondary)", flex: 1 }}>{contrib.username}</span>
                            <div style={{ width: 80, height: 4, background: "var(--n-100,#f3f4f6)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${contribPct}%`, background: color, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: "0.77rem", fontWeight: 600, color: "var(--text-primary)", minWidth: 36, textAlign: "right" }}>
                              {contrib.loggedHours}h
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CapacityPlanning() {
  const [tab, setTab] = useState<"heatmap" | "projects">("heatmap");

  // Heatmap state
  const [teamData, setTeamData] = useState<CapacityTeamResponse | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string>(() => {
    const mon = getMondayOfWeek(new Date());
    return mon.toISOString().slice(0, 10);
  });
  const [weeks, setWeeks] = useState(4);

  // Projects state
  const [projectsData, setProjectsData] = useState<CapacityProjectItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return toYM(now.getFullYear(), now.getMonth() + 1);
  });

  // Overallocated users
  const [overallocated, setOverallocated] = useState<OverallocatedUser[]>([]);

  // Fetch heatmap
  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const r = await apiFetch(`/capacity/team?weekStart=${weekStart}&weeks=${weeks}`);
      if (!r.ok) { setTeamError("Failed to load team capacity"); return; }
      setTeamData(await r.json() as CapacityTeamResponse);
    } catch {
      setTeamError("Failed to load team capacity");
    } finally {
      setTeamLoading(false);
    }
  }, [weekStart, weeks]);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const r = await apiFetch(`/capacity/projects?month=${month}`);
      if (!r.ok) { setProjectsError("Failed to load project allocation"); return; }
      setProjectsData(await r.json() as CapacityProjectItem[]);
    } catch {
      setProjectsError("Failed to load project allocation");
    } finally {
      setProjectsLoading(false);
    }
  }, [month]);

  // Fetch overallocated (once on mount)
  useEffect(() => {
    apiFetch("/capacity/overallocated")
      .then(r => r.ok ? r.json() : [])
      .then(d => setOverallocated(d as OverallocatedUser[]))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);
  useEffect(() => { if (tab === "projects") fetchProjects(); }, [tab, fetchProjects]);

  // Week navigation helpers
  function shiftWeek(delta: number) {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  }

  // Month navigation helpers
  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    let ny = y, nm = m + delta;
    if (nm > 12) { ny++; nm = 1; }
    if (nm < 1)  { ny--; nm = 12; }
    setMonth(toYM(ny, nm));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200 }}>
      {/* Page header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Capacity Planning
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Monitor team workload and project time allocation
        </p>
      </div>

      {/* Overallocation banner */}
      <OverallocationBanner users={overallocated} />

      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <TabBar active={tab} onChange={setTab} />
      </div>

      {/* Content */}
      {tab === "heatmap" ? (
        <>
          {teamError && (
            <div role="alert" style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.07)", color: "#dc2626", fontSize: "0.83rem" }}>
              {teamError}
            </div>
          )}
          <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
            <TeamHeatmap
              data={teamData}
              loading={teamLoading}
              weekStart={weekStart}
              weeks={weeks}
              onPrev={() => shiftWeek(-1)}
              onNext={() => shiftWeek(1)}
              onWeeksChange={setWeeks}
            />
          </div>
        </>
      ) : (
        <>
          {projectsError && (
            <div role="alert" style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.07)", color: "#dc2626", fontSize: "0.83rem" }}>
              {projectsError}
            </div>
          )}
          <ProjectAllocation
            data={projectsData}
            loading={projectsLoading}
            month={month}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
