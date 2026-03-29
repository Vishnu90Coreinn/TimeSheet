/**
 * TeamStatus.tsx — Manager Team Status Board (Sprint 15 + UX Audit)
 * Manager + Admin only. Shows each direct report's daily attendance,
 * week progress, timesheet status, and pending approvals.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { StatusBadge, toBadgeStatus } from "./StatusBadge";
import type { TeamMemberStatus } from "../types";

type Filter = "all" | "missing" | "needs-approval" | "on-leave";

const FILTER_LABELS: Record<Filter, string> = {
  all:              "All",
  missing:          "Missing Today",
  "needs-approval": "Needs Approval",
  "on-leave":       "On Leave",
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtLocalTime(isoUtc: string | null): string | null {
  if (!isoUtc) return null;
  return new Date(isoUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtHours(minutes: number): string {
  if (minutes === 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Format ISO date as "Mar 17, 2026" */
function fmtDateDisplay(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "2-digit", year: "numeric",
    });
  } catch { return iso; }
}

// ── Dynamic subtitle ──────────────────────────────────────────────────────────

/** M1 — Build dynamic subtitle from live counts */
export function buildSubtitle(
  total: number,
  missing: number,
  needsApproval: number,
): string {
  if (total === 0) return "No direct reports assigned";
  const parts: string[] = [`${total} member${total !== 1 ? "s" : ""}`];
  if (missing > 0) parts.push(`${missing} missing today`);
  if (needsApproval > 0)
    parts.push(`${needsApproval} need${needsApproval !== 1 ? "" : "s"} approval`);
  return parts.join(" · ");
}

// ── Custom Date Picker — trigger + fully custom calendar grid (H1) ───────────

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const CAL_DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/** Fully custom calendar grid — no <input type="date"> */
function MiniCalendar({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (d: string) => void;
  onClose: () => void;
}) {
  const parsedDate = (() => { try { return new Date(value + "T00:00:00"); } catch { return new Date(); } })();
  const [viewYear, setViewYear]   = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  const todayStr = todayIso();

  // Build a 6-row × 7-col grid (42 cells)
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();       // 0=Sun
  const daysInMonth   = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev    = new Date(viewYear, viewMonth, 0).getDate();

  type CalCell = { iso: string; day: number; inMonth: boolean };
  const cells: CalCell[] = [];

  // Trailing days from previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const m = viewMonth === 0 ? 12 : viewMonth;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ iso: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: true });
  }
  // Leading days from next month
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    const m = viewMonth === 11 ? 1 : viewMonth + 2;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ iso: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="select-none w-[224px]">
      {/* Month / year navigation */}
      <div className="flex items-center justify-between mb-2">
        <button type="button"
          className="bg-transparent border-0 cursor-pointer px-2 py-[2px] rounded-sm text-base leading-none text-text-secondary flex items-center"
          onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="text-[0.82rem] font-bold text-text-primary">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button"
          className="bg-transparent border-0 cursor-pointer px-2 py-[2px] rounded-sm text-base leading-none text-text-secondary flex items-center"
          onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {CAL_DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[0.62rem] text-text-tertiary font-semibold py-[2px]">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map(cell => {
          const isSelected = cell.iso === value;
          const isToday    = cell.iso === todayStr;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => { onChange(cell.iso); onClose(); }}
              className="rounded cursor-pointer text-[0.72rem] leading-[28px] h-7 p-0"
              style={{
                border: isToday && !isSelected ? "1px solid var(--brand-400)" : "1px solid transparent",
                fontWeight: isSelected || isToday ? 700 : 400,
                background: isSelected ? "var(--brand-500)" : "transparent",
                color: isSelected ? "#fff"
                  : isToday      ? "var(--brand-600)"
                  : cell.inMonth ? "var(--text-primary)"
                  : "var(--text-tertiary)",
                opacity: cell.inMonth ? 1 : 0.45,
              }}
              aria-label={cell.iso}
              aria-pressed={isSelected}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div className="mt-2 border-t border-border-subtle pt-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm w-full text-[0.75rem]"
          onClick={() => { onChange(todayIso()); onClose(); }}
        >
          Today
        </button>
      </div>
    </div>
  );
}

function DatePicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-outline btn-sm flex items-center gap-[6px]"
        onClick={() => setOpen(v => !v)}
        aria-label={`Selected date: ${fmtDateDisplay(value)}. Click to change`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarIcon />
        {fmtDateDisplay(value)}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Date picker"
          className="absolute top-[calc(100%+6px)] right-0 z-[200] ts-date-popover border border-border-subtle rounded-md shadow-md p-3"
        >
          <MiniCalendar value={value} onChange={onChange} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ member }: { member: TeamMemberStatus }) {
  const initials = (member.displayName || member.username).slice(0, 2).toUpperCase();
  if (member.avatarDataUrl) {
    return (
      <div
        className="w-8 h-8 rounded-md shrink-0 border border-border-subtle"
        style={{
          backgroundImage: `url(${member.avatarDataUrl})`,
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-md shrink-0 flex items-center justify-center text-[0.68rem] font-bold text-white"
      style={{ background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))" }}
    >
      {initials}
    </div>
  );
}

// ── Week progress bar (H3) ─────────────────────────────────────────────────────

function WeekBar({ logged, expected }: { logged: number; expected: number }) {
  const pct = expected > 0 ? Math.min(100, Math.round((logged / expected) * 100)) : 0;
  // H3: green ≥80%, yellow 40–79%, red <40%
  const color = pct >= 80 ? "#10b981" : pct >= 40 ? "#f59e0b" : pct > 0 ? "#ef4444" : "#e5e7eb";
  const loggedH = (logged / 60).toFixed(1);
  const expectedH = (expected / 60).toFixed(1);
  const tooltip = `${loggedH}h logged of ${expectedH}h weekly target`;

  return (
    <div className="min-w-[110px]">
      <div className="flex justify-between text-[11px] text-text-tertiary mb-[3px]">
        <span>{fmtHours(logged)}</span>
        <span>{fmtHours(expected)}</span>
      </div>
      <div
        title={tooltip}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={tooltip}
        className="h-[5px] rounded-[3px] bg-n-100 overflow-hidden"
      >
        <div
          className="h-full rounded-[3px] transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {/* H3: percentage label */}
      <div
        className="text-right text-[10px] font-semibold mt-[2px]"
        style={{ color: pct === 0 ? "var(--text-tertiary)" : color }}
      >
        {pct}%
      </div>
    </div>
  );
}

// ── Clock icon for "Check-in Time" header (H2) ────────────────────────────────

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="inline align-middle mr-1">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

// ── Arrow right icon (H4) ─────────────────────────────────────────────────────

function ArrowRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="inline align-middle ml-[3px]">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

// ── Checkmark icon for Approve button (M3) ────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="inline align-middle">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ── Empty state icon (H5) ─────────────────────────────────────────────────────

function EmptyTeamIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--n-300)"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamStatus() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [filter, setFilter] = useState<Filter>("all");
  const [reminding, setReminding] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const r = await apiFetch(`/manager/team-status?date=${d}`);
    if (r.ok) setMembers(await r.json() as TeamMemberStatus[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(date); }, [load, date]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function remind(userId: string, username: string) {
    setReminding(prev => new Set(prev).add(userId));
    const r = await apiFetch(`/manager/remind/${userId}`, { method: "POST" });
    setReminding(prev => { const s = new Set(prev); s.delete(userId); return s; });
    if (r.ok || r.status === 204) showToast(`Reminder sent to ${username}.`);
    else showToast("Failed to send reminder.");
  }

  // C3 — Summary counts for filter chips
  const counts: Record<Filter, number> = {
    all:              members.length,
    missing:          members.filter(m => m.todayTimesheetStatus === "missing").length,
    "needs-approval": members.filter(m => m.pendingApprovalCount > 0).length,
    "on-leave":       members.filter(m => m.attendance === "onLeave").length,
  };

  const filtered = members.filter(m => {
    if (filter === "missing")          return m.todayTimesheetStatus === "missing";
    if (filter === "needs-approval")   return m.pendingApprovalCount > 0;
    if (filter === "on-leave")         return m.attendance === "onLeave";
    return true;
  });

  // M1 — Dynamic subtitle
  const subtitle = buildSubtitle(members.length, counts.missing, counts["needs-approval"]);

  // C2 — sticky td className reused per row
  const stickyTdCls = "sticky right-0 z-[1] bg-[var(--surface)] shadow-[-2px_0_6px_rgba(0,0,0,0.04)]";

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-[#111827] text-white rounded-lg px-[18px] py-[10px] text-sm font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
          {toast}
        </div>
      )}

      <section className="flex flex-col gap-3">

        {/* Page header */}
        <div className="page-header">
          <div>
            <div className="page-title">Team Status</div>
            {/* M1 — dynamic subtitle */}
            <div className="page-subtitle">{subtitle}</div>
          </div>
          {/* H1 — Custom date picker instead of native input */}
          <div className="page-actions">
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        {/* Filter tabs — underline style */}
        <div className="flex border-b border-[var(--border-subtle)] overflow-x-auto">
          {(Object.keys(FILTER_LABELS) as Filter[]).map(f => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="flex items-center gap-1.5 px-4 py-3 text-[0.82rem] font-medium whitespace-nowrap border-b-2 transition-colors"
                style={isActive
                  ? { borderBottomColor: "var(--color-primary, #6366f1)", color: "var(--color-primary, #6366f1)" }
                  : { borderBottomColor: "transparent", color: "var(--text-secondary, #64748b)" }}
              >
                {FILTER_LABELS[f]}
                <span
                  className="rounded-[10px] px-[7px] py-[1px] text-[11px] font-bold min-w-[18px] text-center inline-block"
                  style={{
                    background: isActive ? "var(--color-primary-100, #e0e7ff)" : "var(--n-200)",
                    color: isActive ? "var(--color-primary, #6366f1)" : "var(--text-secondary)",
                  }}
                >
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="card overflow-auto">
          {loading ? (
            <div className="p-6 text-text-tertiary text-center">
              Loading…
            </div>
          ) : filtered.length === 0 && members.length === 0 ? (
            /* H5 — Full empty state for 0 members */
            <div className="py-8 px-5 flex flex-col items-center gap-2 text-center">
              <EmptyTeamIcon />
              <div className="text-[0.95rem] font-bold text-text-primary">
                No direct reports assigned
              </div>
              <div className="text-[0.8rem] text-text-tertiary max-w-[320px]">
                You don't have any team members yet. Ask your admin to assign employees to you.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-text-tertiary text-center">
              No team members match this filter.
            </div>
          ) : (
            /*
             * C2 — table-layout: fixed, 100% width, no minWidth.
             * "Pending Actions" is position:sticky right:0 so it is always
             * visible even if the viewport is very narrow and the table scrolls.
             * NEW-1 — all <th> cells get overflow:hidden + text-overflow:ellipsis
             * so header text never bleeds into adjacent columns.
             */
            <table
              className="data-table [table-layout:fixed] w-full"
              role="grid"
            >
              <thead>
                <tr>
                  {/* NEW-1 — th base style: overflow hidden, no wrap, ellipsis */}
                  <th className="w-[23%] overflow-hidden text-ellipsis whitespace-nowrap">Member</th>
                  <th className="w-[13%] overflow-hidden text-ellipsis whitespace-nowrap">Attendance</th>
                  <th className="w-[11%] overflow-hidden text-ellipsis whitespace-nowrap">
                    <ClockIcon />Check-in Time
                  </th>
                  <th className="w-[19%] overflow-hidden text-ellipsis whitespace-nowrap">Week Progress</th>
                  <th className="w-[12%] overflow-hidden text-ellipsis whitespace-nowrap">Timesheet</th>
                  {/* C2 — sticky right column */}
                  <th className="w-[22%] overflow-hidden text-ellipsis whitespace-nowrap sticky right-0 z-[2] bg-n-50 shadow-[-2px_0_6px_rgba(0,0,0,0.06)]">
                    Pending Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const isReminding = reminding.has(m.userId);
                  const tsStatus = toBadgeStatus(m.todayTimesheetStatus);
                  const attStatus = toBadgeStatus(
                    m.attendance === "onLeave" ? "on-leave" : m.attendance
                  );
                  return (
                    <tr key={m.userId}>
                      {/* Member — title tooltip for truncated names */}
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar member={m} />
                          <div className="min-w-0">
                            <div
                              className="font-semibold text-[0.82rem] text-text-primary overflow-hidden text-ellipsis whitespace-nowrap"
                              title={m.displayName || m.username}
                            >
                              {m.displayName || m.username}
                            </div>
                            {m.displayName && (
                              <div
                                className="text-[0.7rem] text-text-tertiary overflow-hidden text-ellipsis whitespace-nowrap"
                                title={`@${m.username}`}
                              >
                                @{m.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Attendance */}
                      <td><StatusBadge status={attStatus} /></td>

                      {/* Check-in / out */}
                      <td className="text-[0.8rem] text-text-secondary">
                        {m.checkInAtUtc ? (
                          <div>
                            <div>{fmtLocalTime(m.checkInAtUtc)}</div>
                            {m.checkOutAtUtc && (
                              <div className="text-text-tertiary">
                                {fmtLocalTime(m.checkOutAtUtc)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span aria-label="No check-in recorded">—</span>
                        )}
                      </td>

                      {/* Week progress */}
                      <td>
                        <WeekBar logged={m.weekLoggedMinutes} expected={m.weekExpectedMinutes} />
                      </td>

                      {/* Timesheet */}
                      <td><StatusBadge status={tsStatus} /></td>

                      {/* Pending Actions — sticky right */}
                      <td className={stickyTdCls}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.pendingApprovalCount > 0 && (
                            <button
                              type="button"
                              onClick={() => navigate("/approvals")}
                              className="bg-transparent border-0 p-0 text-brand-600 font-semibold text-[0.8rem] cursor-pointer inline-flex items-center hover:underline"
                              title={`View ${m.pendingApprovalCount} pending approval${m.pendingApprovalCount !== 1 ? "s" : ""}`}
                            >
                              {m.pendingApprovalCount} pending<ArrowRight />
                            </button>
                          )}

                          {m.todayTimesheetStatus === "missing" && (
                            <button
                              type="button"
                              className="btn btn-sm border border-border-subtle bg-[var(--surface)] text-text-secondary text-[0.72rem]"
                              disabled={isReminding}
                              onClick={() => void remind(m.userId, m.username)}
                              title="Send reminder notification"
                            >
                              {isReminding ? "…" : "Remind"}
                            </button>
                          )}

                          {m.pendingApprovalCount > 0 && (
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm text-[0.72rem] inline-flex items-center gap-1"
                              onClick={() => navigate("/approvals")}
                              title="Go to Approvals"
                            >
                              <CheckIcon /> Approve
                            </button>
                          )}

                          {m.pendingApprovalCount === 0 && m.todayTimesheetStatus !== "missing" && (
                            <span className="text-[0.8rem] text-text-tertiary">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* H5 — Contextual message for very small teams (1 member) */}
          {!loading && members.length === 1 && (
            <div className="px-4 py-2 border-t border-border-subtle text-[0.74rem] text-text-tertiary text-center">
              You're viewing all 1 direct report. Add more team members to see richer data here.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
