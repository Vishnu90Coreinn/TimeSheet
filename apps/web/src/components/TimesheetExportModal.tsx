import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { AppButton, AppSelect } from "./ui";

interface ExportUser {
  id: string;
  displayName: string;
  username: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function TimesheetExportModal({ open, onClose }: Props) {
  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [userId, setUserId] = useState("");
  const [format, setFormat] = useState<"csv" | "excel" | "pdf">("csv");
  const [users, setUsers] = useState<ExportUser[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    apiFetch("/timesheets/export/users")
      .then(async (r) => {
        if (r.ok) setUsers((await r.json()) as ExportUser[]);
      })
      .catch(() => setError("Failed to load users."));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleExport() {
    if (!fromDate || !toDate) {
      setError("Please select both From and To dates.");
      return;
    }
    if (toDate < fromDate) {
      setError("To date must be on or after From date.");
      return;
    }

    setError("");
    setExporting(true);

    const params = new URLSearchParams({ fromDate, toDate, format });
    if (userId) params.set("userId", userId);

    try {
      const r = await apiFetch(`/timesheets/export?${params.toString()}`);
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Export failed. Please try again.");
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = format === "excel" ? "xlsx" : format;
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

  const showUserPicker = users.length > 1;

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose();
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   bg-surface-primary border border-border-default rounded-xl shadow-2xl
                   w-full max-w-md p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h2 id="export-modal-title" className="text-base font-semibold text-text-primary">
            Export Timesheets
          </h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="export-from" className="form-label">
                From
              </label>
              <input
                id="export-from"
                type="date"
                className="form-input"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="export-to" className="form-label">
                To
              </label>
              <input
                id="export-to"
                type="date"
                className="form-input"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {showUserPicker && (
            <div className="flex flex-col gap-1">
              <label htmlFor="export-user" className="form-label">
                Employee
              </label>
              <AppSelect id="export-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">All available</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.username}
                  </option>
                ))}
              </AppSelect>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="export-format" className="form-label">
              Format
            </label>
            <AppSelect
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "csv" | "excel" | "pdf")}
            >
              <option value="csv">CSV (.csv)</option>
              <option value="excel">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </AppSelect>
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger-text" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <AppButton variant="ghost" size="sm" onClick={onClose} disabled={exporting}>
            Cancel
          </AppButton>
          <AppButton variant="primary" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Download"}
          </AppButton>
        </div>
      </div>
    </>
  );
}
