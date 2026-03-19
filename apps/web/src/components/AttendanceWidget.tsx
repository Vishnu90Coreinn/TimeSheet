/**
 * AttendanceWidget.tsx — Task 4: Check-in / Check-out widget.
 * Shows current attendance status, elapsed timer while checked in,
 * and Check In / Check Out buttons. Available hours are surfaced
 * so the Timesheets form can use them as a cap.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";

export interface AttendanceSummary {
  activeSessionId: string | null;
  workDate: string;
  status: string;
  lastCheckInAtUtc: string | null;
  lastCheckOutAtUtc: string | null;
  netMinutes: number;
}

interface AttendanceWidgetProps {
  /** Called whenever the summary changes so Timesheets can refresh its cap. */
  onSummaryChange?: (summary: AttendanceSummary) => void;
}

export function AttendanceWidget({ onSummaryChange }: AttendanceWidgetProps) {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0); // seconds since last check-in
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSummary = useCallback(async () => {
    const r = await apiFetch("/attendance/summary/today");
    if (r.ok) {
      const data: AttendanceSummary = await r.json();
      setSummary(data);
      onSummaryChange?.(data);
    }
    setLoading(false);
  }, [onSummaryChange]);

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

  useEffect(() => { void loadSummary(); }, [loadSummary]);

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
    } else {
      const body = await r.json().catch(() => ({}));
      setError((body as { message?: string }).message ?? "Check-out failed.");
    }
    setActionLoading(false);
  }

  const isCheckedIn = Boolean(summary?.activeSessionId);
  const netHours = summary ? formatMinutes(summary.netMinutes) : "—";

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
            In at {formatTime(summary.lastCheckInAtUtc)}
          </div>
          <div className="aw-elapsed">
            ⏱ {formatElapsed(elapsed)}
          </div>
        </div>
      )}

      {!isCheckedIn && summary?.lastCheckOutAtUtc && (
        <div className="aw-check-time">
          Checked out at {formatTime(summary.lastCheckOutAtUtc)}
        </div>
      )}

      <div className="aw-net">
        <span className="aw-net__label">Total today</span>
        <span className="aw-net__value">{netHours}</span>
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

function formatTime(iso: string) {
  return parseUtc(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
