import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../api/client";

interface ExportUser {
  id: string;
  displayName: string;
  username: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function thisWeek(): [string, string] {
  const t = new Date();
  const dow = t.getDay();
  const mon = new Date(t);
  mon.setDate(t.getDate() + (dow === 0 ? -6 : 1 - dow));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [iso(mon), iso(sun)];
}
function thisMonth(): [string, string] {
  const t = new Date();
  return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
}
function lastMonth(): [string, string] {
  const t = new Date();
  const last = new Date(t.getFullYear(), t.getMonth(), 0);
  const first = new Date(last.getFullYear(), last.getMonth(), 1);
  return [iso(first), iso(last)];
}

type Preset = "this-week" | "this-month" | "last-month" | "custom";

const PRESETS: { key: Preset; label: string; range: () => [string, string] }[] = [
  { key: "this-week",   label: "This Week",   range: thisWeek   },
  { key: "this-month",  label: "This Month",  range: thisMonth  },
  { key: "last-month",  label: "Last Month",  range: lastMonth  },
  { key: "custom",      label: "Custom",      range: () => ["", ""] },
];

// ── Format cards ─────────────────────────────────────────────────────────────
type ExportFormat = "csv" | "excel" | "pdf";

const FORMAT_OPTIONS: {
  key: ExportFormat;
  label: string;
  ext: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    key: "csv",
    label: "CSV",
    ext: ".csv",
    accent: "#059669",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
        <line x1="8" y1="9"  x2="10" y2="9"/>
      </svg>
    ),
  },
  {
    key: "excel",
    label: "Excel",
    ext: ".xlsx",
    accent: "#217346",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8"  y1="12" x2="16" y2="12"/>
        <line x1="8"  y1="16" x2="16" y2="16"/>
        <line x1="12" y1="8"  x2="12" y2="20"/>
      </svg>
    ),
  },
  {
    key: "pdf",
    label: "PDF",
    ext: ".pdf",
    accent: "#dc2626",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M9 15c0 1.1.9 2 2 2h2a2 2 0 0 0 0-4h-2a2 2 0 0 1 0-4h2a2 2 0 0 1 1.7 1"/>
      </svg>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function TimesheetExportModal({ open, onClose }: Props) {
  const [preset, setPreset]               = useState<Preset>("this-month");
  const [fromDate, setFromDate]           = useState(() => thisMonth()[0]);
  const [toDate, setToDate]               = useState(() => thisMonth()[1]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch]       = useState("");
  const [format, setFormat]               = useState<ExportFormat>("csv");
  const [users, setUsers]                 = useState<ExportUser[]>([]);
  const [exporting, setExporting]         = useState(false);
  const [error, setError]                 = useState("");
  const overlayRef                        = useRef<HTMLDivElement>(null);

  // Fetch users when modal opens
  useEffect(() => {
    if (!open) return;
    setError("");
    setUserSearch("");
    setSelectedUserIds([]);
    apiFetch("/timesheets/export/users")
      .then(async (r) => { if (r.ok) setUsers((await r.json()) as ExportUser[]); })
      .catch(() => setError("Failed to load users."));
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Apply preset
  function applyPreset(key: Preset) {
    setPreset(key);
    if (key !== "custom") {
      const [f, t] = PRESETS.find(p => p.key === key)!.range();
      setFromDate(f);
      setToDate(t);
    }
  }

  // Manual date edit → switch to custom
  function handleFromChange(v: string) { setFromDate(v); setPreset("custom"); }
  function handleToChange(v: string)   { setToDate(v);   setPreset("custom"); }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.displayName || u.username).toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  function toggleUser(id: string) {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleExport() {
    if (!fromDate || !toDate) { setError("Please select a date range."); return; }
    if (toDate < fromDate)    { setError("End date must be on or after start date."); return; }
    setError("");
    setExporting(true);

    const params = new URLSearchParams({ fromDate, toDate, format });
    selectedUserIds.forEach(id => params.append("userIds", id));

    try {
      const r = await apiFetch(`/timesheets/export?${params.toString()}`);
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Export failed. Please try again.");
        return;
      }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const ext  = format === "excel" ? "xlsx" : format;
      a.href = url;
      a.download = `timesheets-${fromDate}-to-${toDate}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  const showUserPicker   = users.length > 1;
  const selectedCount    = selectedUserIds.length;
  const exportLabel      = selectedCount > 0
    ? `${selectedCount} employee${selectedCount > 1 ? "s" : ""}`
    : showUserPicker ? "all employees" : "my timesheets";

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(16,16,26,0.45)" }}
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        style={{
          position: "fixed",
          zIndex: 60,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          maxWidth: 480,
          background: "var(--n-0)",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(16,16,26,0.18), 0 4px 16px rgba(16,16,26,0.10)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--brand-50)",
            border: "1px solid var(--brand-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--brand-600)",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="export-modal-title"
                style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: "1.3" }}>
              Export Timesheets
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              Download entries as CSV, Excel, or PDF
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-secondary)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Date Range */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "0.72rem", fontWeight: 600,
                        color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Date Range
            </p>

            {/* Preset pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {PRESETS.map(p => {
                const active = preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    style={{
                      height: 28,
                      padding: "0 10px",
                      borderRadius: 20,
                      border: active ? "1.5px solid var(--brand-400)" : "1px solid var(--border-default)",
                      background: active ? "var(--brand-50)" : "var(--n-0)",
                      color: active ? "var(--brand-700)" : "var(--text-secondary)",
                      fontSize: "0.75rem",
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Date inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(["from", "to"] as const).map(side => (
                <div key={side}>
                  <label
                    htmlFor={`export-${side}`}
                    style={{ display: "block", fontSize: "0.72rem", fontWeight: 500,
                             color: "var(--text-secondary)", marginBottom: 4 }}
                  >
                    {side === "from" ? "Start date" : "End date"}
                  </label>
                  <input
                    id={`export-${side}`}
                    type="date"
                    value={side === "from" ? fromDate : toDate}
                    max={side === "from" ? toDate || undefined : undefined}
                    min={side === "to"   ? fromDate || undefined : undefined}
                    onChange={e => side === "from" ? handleFromChange(e.target.value) : handleToChange(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border-default)",
                      background: "var(--n-0)",
                      color: "var(--text-primary)",
                      fontSize: "0.82rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Employee picker */}
          {showUserPicker && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600,
                            color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Employees
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedCount > 0 && (
                    <span style={{
                      padding: "1px 7px", borderRadius: 10,
                      background: "var(--brand-50)",
                      border: "1px solid var(--brand-100)",
                      fontSize: "0.70rem", fontWeight: 600, color: "var(--brand-700)",
                    }}>
                      {selectedCount} selected
                    </span>
                  )}
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      style={{ fontSize: "0.72rem", color: "var(--text-secondary)",
                               background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Search */}
              <div style={{ position: "relative", marginBottom: 6 }}>
                <svg
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                           color: "var(--text-secondary)", pointerEvents: "none" }}
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search employees…"
                  style={{
                    width: "100%",
                    height: 34,
                    paddingLeft: 30,
                    paddingRight: 10,
                    borderRadius: 8,
                    border: "1px solid var(--border-default)",
                    background: "var(--n-50)",
                    color: "var(--text-primary)",
                    fontSize: "0.82rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* User list */}
              <div style={{
                maxHeight: 128,
                overflowY: "auto",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                background: "var(--n-0)",
              }}>
                {filteredUsers.length === 0 ? (
                  <p style={{ margin: 0, padding: "10px 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    No employees found.
                  </p>
                ) : (
                  filteredUsers.map((u, i) => {
                    const label   = u.displayName || u.username;
                    const checked = selectedUserIds.includes(u.id);
                    const initials = label.slice(0, 2).toUpperCase();
                    return (
                      <label
                        key={u.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "7px 12px",
                          cursor: "pointer",
                          borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                          background: checked ? "var(--brand-50)" : "transparent",
                          transition: "background 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUser(u.id)}
                          style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--brand-600)" }}
                        />
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                          background: "var(--brand-100)",
                          color: "var(--brand-700)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.60rem", fontWeight: 700,
                        }}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)",
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {label}
                          </div>
                          {u.displayName && u.displayName !== u.username && (
                            <div style={{ fontSize: "0.70rem", color: "var(--text-secondary)" }}>
                              @{u.username}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <p style={{ margin: "5px 0 0", fontSize: "0.70rem", color: "var(--text-secondary)" }}>
                No selection exports all available employees.
              </p>
            </div>
          )}

          {/* Format */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "0.72rem", fontWeight: 600,
                        color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Format
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {FORMAT_OPTIONS.map(f => {
                const active = format === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFormat(f.key)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      padding: "12px 8px",
                      borderRadius: 10,
                      border: active ? `1.5px solid var(--brand-400)` : "1px solid var(--border-default)",
                      background: active ? "var(--brand-50)" : "var(--n-0)",
                      cursor: "pointer",
                      transition: "all 0.12s",
                      color: active ? "var(--brand-600)" : "var(--text-secondary)",
                    }}
                  >
                    <span style={{ color: active ? f.accent : "var(--text-secondary)", transition: "color 0.12s" }}>
                      {f.icon}
                    </span>
                    <span style={{ fontSize: "0.78rem", fontWeight: active ? 600 : 500,
                                   color: active ? "var(--brand-700)" : "var(--text-primary)" }}>
                      {f.label}
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                      {f.ext}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "12px 20px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          {error && (
            <p role="alert" style={{
              margin: 0, padding: "8px 10px",
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              fontSize: "0.78rem",
              color: "#b91c1c",
            }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              style={{
                height: 36, padding: "0 14px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--n-0)",
                color: "var(--text-primary)",
                fontSize: "0.82rem", fontWeight: 500,
                cursor: "pointer",
                opacity: exporting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !fromDate || !toDate}
              style={{
                height: 36, padding: "0 16px",
                borderRadius: 8,
                border: "1px solid var(--brand-600)",
                background: exporting ? "var(--brand-400)" : "var(--brand-600)",
                color: "#fff",
                fontSize: "0.82rem", fontWeight: 600,
                cursor: exporting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 7,
                transition: "background 0.15s",
                opacity: (!fromDate || !toDate) ? 0.5 : 1,
              }}
            >
              {exporting ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"
                       style={{ animation: "spin 0.8s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Exporting…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export {exportLabel}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
