/**
 * AttendanceWidget.tsx - Check-in / check-out widget.
 * Shows current attendance state, a live timer while checked in,
 * and a focused primary action for the next step.
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
  const [elapsed, setElapsed] = useState(0);
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSummary = useCallback(async () => {
    const response = await apiFetch("/attendance/summary/today");
    if (response.ok) {
      const data: AttendanceSummary = await response.json();
      setSummary(data);
      onSummaryChange?.(data);
    }
    setLoading(false);
  }, [onSummaryChange]);

  const loadSessions = useCallback(async () => {
    const response = await apiFetch("/attendance/sessions/today");
    if (response.ok) {
      const data: WorkSession[] = await response.json();
      setSessions(data);
    }
  }, []);

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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [summary?.activeSessionId, summary?.lastCheckInAtUtc]);

  useEffect(() => {
    void loadSummary();
    void loadSessions();
  }, [loadSummary, loadSessions]);

  async function handleCheckIn() {
    setActionLoading(true);
    setError("");

    const response = await apiFetch("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (response.ok) {
      const data: AttendanceSummary = await response.json();
      await loadSessions();
      setSummary(data);
      onSummaryChange?.(data);
    } else {
      const body = await response.json().catch(() => ({}));
      setError((body as { message?: string }).message ?? "Check-in failed.");
    }

    setActionLoading(false);
  }

  async function handleCheckOut() {
    setActionLoading(true);
    setError("");

    const response = await apiFetch("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (response.ok) {
      const data: AttendanceSummary = await response.json();
      await loadSessions();
      setSummary(data);
      onSummaryChange?.(data);
    } else {
      const body = await response.json().catch(() => ({}));
      setError((body as { message?: string }).message ?? "Check-out failed.");
    }

    setActionLoading(false);
  }

  const isCheckedIn = Boolean(summary?.activeSessionId);
  const sessionCount = sessions.length;
  const completedSeconds = sessions
    .filter((session) => session.checkOutAtUtc !== null)
    .reduce((total, session) => {
      const durationMs =
        parseUtc(session.checkOutAtUtc!).getTime() - parseUtc(session.checkInAtUtc).getTime();
      return total + Math.floor(durationMs / 1000);
    }, 0);
  const cumulativeElapsed = isCheckedIn ? completedSeconds + elapsed : completedSeconds;

  const heroValue = isCheckedIn
    ? formatElapsed(cumulativeElapsed)
    : summary
      ? formatMinutes(summary.netMinutes)
      : "-";
  const totalTodayLabel = summary
    ? isCheckedIn
      ? formatHoursMinutes(cumulativeElapsed)
      : formatMinutes(summary.netMinutes)
    : "-";
  const supportingLine = isCheckedIn && summary?.lastCheckInAtUtc
    ? `Started at ${formatTime(summary.lastCheckInAtUtc, timeZoneId)}`
    : summary?.lastCheckOutAtUtc
      ? `Last checked out at ${formatTime(summary.lastCheckOutAtUtc, timeZoneId)}`
      : "No check-in recorded today";

  return (
    <div className={`aw-card ${isCheckedIn ? "aw-card--active" : "aw-card--idle"}`}>
      <div className="aw-bar">
        <div className="aw-title">
          <span
            className={`aw-status-dot ${isCheckedIn ? "aw-status-dot--in" : "aw-status-dot--out"}`}
            aria-hidden="true"
          />
          <span className="aw-state">{isCheckedIn ? "Currently checked in" : "Ready to check in"}</span>
        </div>

        <div className="aw-meta" aria-label="Attendance details">
          <span className="aw-meta__item">{supportingLine}</span>
          <span className="aw-meta__sep" aria-hidden="true">•</span>
          <span className="aw-meta__item">Today {totalTodayLabel}</span>
          <span className="aw-meta__sep" aria-hidden="true">•</span>
          <span className="aw-meta__item">{formatWorkDate(summary?.workDate ?? today())}</span>
        </div>

        <div className="aw-timer-group">
          <span className="aw-timer-label">{isCheckedIn ? "Live" : "Today"}</span>
          <div className="aw-elapsed">{heroValue}</div>
        </div>

        {loading ? (
          <div className="skeleton skeleton-text w-20 h-3.5" />
        ) : (
          <div className="aw-actions">
            <button
              className={`aw-btn ${isCheckedIn ? "aw-btn--out" : "aw-btn--in"}`}
              onClick={() => void (isCheckedIn ? handleCheckOut() : handleCheckIn())}
              disabled={actionLoading}
            >
              {isCheckedIn ? "Check out" : "Check in"}
            </button>
            {actionLoading && (
              <span className="aw-loading" aria-live="polite">
                Saving...
              </span>
            )}
          </div>
        )}
      </div>

      {error && <p className="aw-error">{error}</p>}

      {sessionCount > 0 && (
        <>
          <button
            type="button"
            className="aw-disclosure"
            onClick={() => setShowSessions((current) => !current)}
            aria-expanded={showSessions}
          >
            <span>{showSessions ? "Hide today's sessions" : `View today's sessions (${sessionCount})`}</span>
            <span className="aw-disclosure__meta">{showSessions ? "Collapse" : `${sessionCount} recorded`}</span>
          </button>

          {showSessions && (
            <div className="aw-sessions">
              <div className="aw-sessions__label">Today&apos;s sessions</div>
              {sessions.map((session) => {
                const isActiveSession = session.checkOutAtUtc === null;
                return (
                  <div
                    key={session.id}
                    className={`aw-session-row ${isActiveSession ? "aw-session-row--active" : "aw-session-row--done"}`}
                  >
                    <span className="aw-session-row__range">
                      {formatTime(session.checkInAtUtc, timeZoneId)}
                      {" -> "}
                      {isActiveSession ? "now" : formatTime(session.checkOutAtUtc!, timeZoneId)}
                    </span>
                    <span className={isActiveSession ? "aw-session-row__badge" : "aw-session-row__dur"}>
                      {isActiveSession
                        ? "Live"
                        : session.durationMinutes !== null
                          ? formatMinutes(session.durationMinutes)
                          : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Parse a UTC ISO string from the API (may lack trailing Z) as UTC. */
function parseUtc(iso: string): Date {
  if (!iso.endsWith("Z") && !iso.includes("+")) return new Date(`${iso}Z`);
  return new Date(iso);
}

function formatTime(iso: string, timeZoneId?: string) {
  return parseUtc(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZoneId,
  });
}

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function formatHoursMinutes(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatWorkDate(workDate: string) {
  const date = new Date(`${workDate}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
