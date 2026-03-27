/**
 * AttendanceWidget.tsx — Task 4: Check-in / Check-out widget.
 * Shows current attendance status, elapsed timer while checked in,
 * and Check In / Check Out buttons. Available hours are surfaced
 * so the Timesheets form can use them as a cap.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { useTimezone } from "../hooks/useTimezone";

export interface AttendanceSummary {
  activeSessionId: string | null;
  workDate: string;
  status: string;
  lastCheckInAtUtc: string | null;
  lastCheckOutAtUtc: string | null;
  netMinutes: number;
}

interface WorkSession {
  id: string;
  checkInAtUtc: string;
  checkOutAtUtc: string | null;
  durationMinutes: number | null;
}

interface AttendanceWidgetProps {
  /** Called whenever the summary changes so Timesheets can refresh its cap. */
  onSummaryChange?: (summary: AttendanceSummary) => void;
}

export function AttendanceWidget({ onSummaryChange }: AttendanceWidgetProps) {
  const { timeZoneId } = useTimezone();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0); // seconds since last check-in
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);

  const loadSummary = useCallback(async () => {
    const r = await apiFetch("/attendance/summary/today");
    if (r.ok) {
      const data: AttendanceSummary = await r.json();
      setSummary(data);
      onSummaryChange?.(data);
    }
    setLoading(false);
  }, [onSummaryChange]);

  const loadSessions = useCallback(async () => {
    const r = await apiFetch("/attendance/sessions/today");
    if (r.ok) {
      const data: WorkSession[] = await r.json();
      setSessions(data);
    }
  }, []);

  // Start or stop the live elapsed timer based on active session.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (summary?.activeSessionId && summary.lastCheckInAtUtc) {
      const checkIn = parseUtc(summary.lastCheckInAtUtc).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - checkIn) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [summary?.activeSessionId, summary?.lastCheckInAtUtc]);

  useEffect(() => {
    void loadSummary();
    void loadSessions();
  }, [loadSummary, loadSessions]);

  async function handleCheckIn() {
    setActionLoading(true);
    setError("");
    const r = await apiFetch("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (r.ok) {
      const data: AttendanceSummary = await r.json();
      setSummary(data);
      onSummaryChange?.(data);
      void loadSessions();
    } else {
      const body = await r.json().catch(() => ({}));
      setError((body as { message?: string }).message ?? "Check-in failed.");
    }
    setActionLoading(false);
  }

  async function handleCheckOut() {
    setActionLoading(true);
    setError("");
    const r = await apiFetch("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (r.ok) {
      const data: AttendanceSummary = await r.json();
      setSummary(data);
      onSummaryChange?.(data);
      void loadSessions();
    } else {
      const body = await r.json().catch(() => ({}));
      setError((body as { message?: string }).message ?? "Check-out failed.");
    }
    setActionLoading(false);
  }

  const isCheckedIn = Boolean(summary?.activeSessionId);
  const netHours = summary ? formatMinutes(summary.netMinutes) : "—";
  // Compute completed-session seconds from actual timestamps (not netMinutes)
  // so sub-minute precision is preserved across multiple check-in/out cycles.
  const completedSeconds = sessions
    .filter(s => s.checkOutAtUtc !== null)
    .reduce((total, s) => {
      const ms = parseUtc(s.checkOutAtUtc!).getTime() - parseUtc(s.checkInAtUtc).getTime();
      return total + Math.floor(ms / 1000);
    }, 0);
  const cumulativeElapsed = isCheckedIn ? completedSeconds + elapsed : completedSeconds;

  return (
    <div className="aw-card">
      <div className="aw-header">
        <div className="aw-title">
          <span className={`aw-status-dot ${isCheckedIn ? "aw-status-dot--in" : "aw-status-dot--out"}`} />
          {isCheckedIn ? "Checked In" : "Not Checked In"}
        </div>
        <span className="aw-date">{summary?.workDate ?? today()}</span>
      </div>

      {isCheckedIn && summary?.lastCheckInAtUtc && (
        <div className="aw-timer-row">
          <div className="aw-check-time">
            In at {formatTime(summary.lastCheckInAtUtc, timeZoneId)}
          </div>
          <div className="aw-elapsed">
            ⏱ {formatElapsed(cumulativeElapsed)}
          </div>
        </div>
      )}

      {!isCheckedIn && summary?.lastCheckOutAtUtc && (
        <div className="aw-check-time">
          Checked out at {formatTime(summary.lastCheckOutAtUtc, timeZoneId)}
        </div>
      )}

      <div className="aw-net">
        <span className="aw-net__label">Total today</span>
        <span className="aw-net__value">
          {isCheckedIn ? formatElapsed(cumulativeElapsed) : netHours}
        </span>
      </div>

      {error && <p className="aw-error">{error}</p>}

      {loading ? (
        <div className="skeleton skeleton-text w-20 h-3.5" />
      ) : (
        <div className="aw-actions">
          <button
            className="aw-btn aw-btn--in"
            onClick={() => void handleCheckIn()}
            disabled={isCheckedIn || actionLoading}
          >
            Check In
          </button>
          <button
            className="aw-btn aw-btn--out"
            onClick={() => void handleCheckOut()}
            disabled={!isCheckedIn || actionLoading}
          >
            Check Out
          </button>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="aw-sessions">
          <div className="aw-sessions__label">TODAY&apos;S SESSIONS</div>
          {sessions.map((s) => {
            const isActive = s.checkOutAtUtc === null;
            return (
              <div key={s.id} className={`aw-session-row ${isActive ? "aw-session-row--active" : "aw-session-row--done"}`}>
                <span className="aw-session-row__range">
                  {formatTime(s.checkInAtUtc, timeZoneId)}
                  {" → "}
                  {isActive ? "now" : formatTime(s.checkOutAtUtc!, timeZoneId)}
                </span>
                {isActive ? (
                  <span className="aw-session-row__badge">⏱ live</span>
                ) : (
                  <>
                    <span className="aw-session-row__dur">
                      {s.durationMinutes !== null ? formatMinutes(s.durationMinutes) : ""}
                    </span>
                    <span className="aw-session-row__check">✓</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Parse a UTC ISO string from the API (may lack trailing Z) as UTC. */
function parseUtc(iso: string): Date {
  // The API serialises DateTimes as "2026-03-14T12:49:00.000000" without Z.
  // Without an explicit timezone, browsers treat it as local time — wrong.
  // Appending Z forces UTC interpretation.
  if (!iso.endsWith("Z") && !iso.includes("+")) return new Date(iso + "Z");
  return new Date(iso);
}

function formatTime(iso: string, timeZoneId?: string) {
  return parseUtc(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timeZoneId });
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
