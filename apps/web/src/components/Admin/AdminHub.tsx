import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";

interface Props {
  onNavigate: (view: string) => void;
}

interface Counts {
  users: number | null;
  projects: number | null;
  categories: number | null;
  holidays: number | null;
  leavePolicies: number | null;
  workPolicies: number | null;
  auditEvents: number | null;
}

/* ── Inline SVG icons (20×20) ─────────────────────────────────────── */
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function LeavePolicyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="9" y1="16" x2="15" y2="16"/>
      <line x1="12" y1="13" x2="12" y2="19"/>
    </svg>
  );
}
function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
function PaletteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function ScrollTextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/>
      <path d="M19 3H4.5"/>
      <path d="M19 7H4.5"/>
      <path d="M14 12H4.5"/>
      <path d="M14 16H4.5"/>
    </svg>
  );
}

/* ── Icon colour tokens ───────────────────────────────────────────── */
const ICON_COLORS: Record<string, { bg: string; color: string }> = {
  users:            { bg: "rgba(99,102,241,0.12)",  color: "var(--brand-600, #4f46e5)" },
  projects:         { bg: "rgba(16,185,129,0.12)",  color: "#059669" },
  categories:       { bg: "rgba(245,158,11,0.12)",  color: "#d97706" },
  holidays:         { bg: "rgba(239,68,68,0.12)",   color: "#dc2626" },
  "leave-policies": { bg: "rgba(59,130,246,0.12)",  color: "#2563eb" },
  "work-policies":  { bg: "rgba(168,85,247,0.12)",  color: "#9333ea" },
  branding:         { bg: "rgba(236,72,153,0.12)",  color: "#db2777" },
  "retention-policy": { bg: "rgba(249,115,22,0.12)", color: "#ea580c" },
  "audit-logs":     { bg: "rgba(20,184,166,0.12)",  color: "#0d9488" },
};

/* ── Section metadata ─────────────────────────────────────────────── */
interface SectionDef {
  view: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  countKey: keyof Counts;
  countLabel: (n: number) => string;
}

const SECTIONS: SectionDef[] = [
  {
    view: "users",
    label: "Users",
    description: "Manage employee accounts and roles",
    icon: <UsersIcon />,
    countKey: "users",
    countLabel: n => `${n} ${n === 1 ? "user" : "users"}`,
  },
  {
    view: "projects",
    label: "Projects",
    description: "Track client and internal projects",
    icon: <FolderIcon />,
    countKey: "projects",
    countLabel: n => `${n} ${n === 1 ? "project" : "projects"}`,
  },
  {
    view: "categories",
    label: "Categories",
    description: "Task types for time logging",
    icon: <TagIcon />,
    countKey: "categories",
    countLabel: n => `${n} ${n === 1 ? "category" : "categories"}`,
  },
  {
    view: "holidays",
    label: "Holidays",
    description: "Public holiday calendar",
    icon: <StarIcon />,
    countKey: "holidays",
    countLabel: n => `${n} ${n === 1 ? "holiday" : "holidays"}`,
  },
  {
    view: "leave-policies",
    label: "Leave Policies",
    description: "Annual leave allocations per policy",
    icon: <LeavePolicyIcon />,
    countKey: "leavePolicies",
    countLabel: n => `${n} ${n === 1 ? "policy" : "policies"}`,
  },
  {
    view: "work-policies",
    label: "Work Policies",
    description: "Working hours and expectations",
    icon: <BriefcaseIcon />,
    countKey: "workPolicies",
    countLabel: n => `${n} ${n === 1 ? "policy" : "policies"}`,
  },
  {
    view: "branding",
    label: "Branding",
    description: "Logo, colours, and email templates",
    icon: <PaletteIcon />,
    countKey: "auditEvents",  // no count for branding — will always be null
    countLabel: () => "configured",
  },
  {
    view: "retention-policy",
    label: "Data Retention",
    description: "Automated data cleanup rules",
    icon: <ShieldIcon />,
    countKey: "auditEvents",  // no count for retention — will always be null
    countLabel: () => "configured",
  },
  {
    view: "audit-logs",
    label: "Audit Logs",
    description: "System activity trail",
    icon: <ScrollTextIcon />,
    countKey: "auditEvents",
    countLabel: n => `${n} events`,
  },
];

/* ── Skeleton pulse ───────────────────────────────────────────────── */
function Skeleton({ width = "60px", height = "1.1rem" }: { width?: string; height?: string }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: "var(--n-100, #f0f0f0)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
      aria-hidden="true"
    />
  );
}

/* ── Main component ───────────────────────────────────────────────── */
export function AdminHub({ onNavigate }: Props) {
  const [counts, setCounts] = useState<Counts>({
    users: null,
    projects: null,
    categories: null,
    holidays: null,
    leavePolicies: null,
    workPolicies: null,
    auditEvents: null,
  });
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;

    async function fetchCount<T>(
      path: string,
      extract: (data: T) => number
    ): Promise<number | null> {
      try {
        const r = await apiFetch(path);
        if (!r.ok) return null;
        const data = await r.json() as T;
        return extract(data);
      } catch {
        return null;
      }
    }

    Promise.all([
      fetchCount<{ totalCount: number }>("/users?page=1&pageSize=1", d => d.totalCount),
      fetchCount<{ totalCount: number }>("/projects?page=1&pageSize=1", d => d.totalCount),
      fetchCount<{ taskCategories: unknown[] }>("/timesheets/entry-options", d => d.taskCategories.length),
      fetchCount<unknown[]>(`/holidays?year=${currentYear}`, d => (Array.isArray(d) ? d.length : 0)),
      fetchCount<unknown[]>("/leave/policies", d => (Array.isArray(d) ? d.length : 0)),
      fetchCount<unknown[]>("/work-policies", d => (Array.isArray(d) ? d.length : 0)),
      fetchCount<{ totalCount: number }>("/admin/audit-logs?page=1&pageSize=1", d => d.totalCount),
    ]).then(([users, projects, categories, holidays, leavePolicies, workPolicies, auditEvents]) => {
      if (cancelled) return;
      setCounts({ users, projects, categories, holidays, leavePolicies, workPolicies, auditEvents });
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [currentYear]);

  const kpiCards = [
    { label: "Total Users",           value: counts.users,       suffix: "registered" },
    { label: "Active Projects",        value: counts.projects,    suffix: "tracked" },
    { label: "Audit Events (this year)", value: counts.auditEvents, suffix: "logged" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: 1200 }}>
      {/* ── Page header ── */}
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "1.45rem",
            fontWeight: 700,
            color: "var(--text-primary, #111)",
            letterSpacing: "-0.01em",
          }}
        >
          Admin Hub
        </h1>
        <p
          style={{
            margin: "0.25rem 0 0",
            fontSize: "0.875rem",
            color: "var(--text-secondary, #6b7280)",
          }}
        >
          Manage your organisation's settings and data
        </p>
      </div>

      {/* ── Stats strip ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
        }}
        className="admin-hub-kpi-grid"
      >
        {kpiCards.map(kpi => (
          <div
            key={kpi.label}
            className="card"
            style={{ padding: "1.25rem 1.5rem" }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-tertiary, #9ca3af)",
                marginBottom: "0.5rem",
              }}
            >
              {kpi.label}
            </div>
            {loading ? (
              <Skeleton width="48px" height="1.75rem" />
            ) : (
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                <span
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: "var(--text-primary, #111)",
                    lineHeight: 1,
                  }}
                >
                  {kpi.value !== null ? kpi.value.toLocaleString() : "—"}
                </span>
                {kpi.value !== null && (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary, #9ca3af)" }}>
                    {kpi.suffix}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Section grid ── */}
      <div>
        <h2
          style={{
            margin: "0 0 1rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--text-secondary, #6b7280)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Admin Sections
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1rem",
          }}
          className="admin-hub-section-grid"
        >
          {SECTIONS.map(section => {
            const colors = ICON_COLORS[section.view] ?? ICON_COLORS["users"];
            const countValue = counts[section.countKey];
            const showCount =
              section.view !== "branding" &&
              section.view !== "retention-policy";

            return (
              <div
                key={section.view}
                className="card"
                style={{
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  transition: "box-shadow 0.15s ease",
                }}
              >
                {/* Icon + name row */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: colors.bg,
                      color: colors.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {section.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "var(--text-primary, #111)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {section.label}
                    </div>
                    {/* Count badge */}
                    {showCount && (
                      <div style={{ marginTop: "0.15rem" }}>
                        {loading ? (
                          <Skeleton width="52px" height="0.85rem" />
                        ) : countValue !== null ? (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              color: colors.color,
                              background: colors.bg,
                              padding: "1px 7px",
                              borderRadius: 20,
                              display: "inline-block",
                            }}
                          >
                            {section.countLabel(countValue)}
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary, #9ca3af)" }}>—</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.82rem",
                    color: "var(--text-secondary, #6b7280)",
                    lineHeight: 1.5,
                    flexGrow: 1,
                  }}
                >
                  {section.description}
                </p>

                {/* Open button */}
                <div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                    onClick={() => onNavigate(section.view)}
                  >
                    Open →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Responsive overrides via style tag */}
      <style>{`
        @media (max-width: 900px) {
          .admin-hub-section-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .admin-hub-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .admin-hub-section-grid { grid-template-columns: 1fr !important; }
          .admin-hub-kpi-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
