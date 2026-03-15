/**
 * Reports.tsx — Pulse SaaS design v2.0
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { ReportKey } from "../types";

const REPORT_OPTIONS: { value: ReportKey; label: string }[] = [
  { value: "attendance-summary", label: "Attendance Summary" },
  { value: "timesheet-summary",  label: "Timesheet Summary" },
  { value: "project-effort",     label: "Project Effort" },
  { value: "leave-utilization",  label: "Leave & Utilization" },
];

export function Reports() {
  const [reportKey, setReportKey] = useState<ReportKey>("attendance-summary");
  const [reportRows, setReportRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  function loadReport(key: ReportKey) {
    setLoading(true);
    apiFetch(`/reports/${key}`).then(async (r) => {
      if (r.ok) { const d = await r.json(); setReportRows(d.items ?? []); }
      setLoading(false);
    });
  }

  useEffect(() => { loadReport(reportKey); }, []);

  async function exportReport(format: "csv" | "excel" | "pdf") {
    const r = await apiFetch(`/reports/${reportKey}/export?format=${format}`);
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportKey}.${format === "excel" ? "xlsx" : format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const columns = reportRows.length > 0 ? Object.keys(reportRows[0]) : [];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Generate and export workforce reports</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={() => void exportReport("csv")}>↓ CSV</button>
          <button className="btn btn-outline btn-sm" onClick={() => void exportReport("excel")}>↓ Excel</button>
          <button className="btn btn-outline btn-sm" onClick={() => void exportReport("pdf")}>↓ PDF</button>
        </div>
      </div>

      {/* Controls */}
      <div className="card-flat" style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div className="form-field" style={{ minWidth: "220px" }}>
          <label className="form-label" htmlFor="report-type">Report Type</label>
          <select
            id="report-type"
            className="input-field"
            value={reportKey}
            onChange={(e) => { const key = e.target.value as ReportKey; setReportKey(key); loadReport(key); }}
          >
            {REPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">{REPORT_OPTIONS.find(o => o.value === reportKey)?.label}</div>
            <div className="card-subtitle">{loading ? "Loading…" : `${reportRows.length} rows`}</div>
          </div>
        </div>
        {loading ? (
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state__icon">⏳</div>
              <p className="empty-state__title">Loading report…</p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>{columns.map((k) => <th key={k}>{k}</th>)}</tr>
              </thead>
              <tbody>
                {reportRows.map((row, i) => (
                  <tr key={i}>{Object.entries(row).map(([k, v]) => <td key={k}>{String(v ?? "—")}</td>)}</tr>
                ))}
                {reportRows.length === 0 && <tr className="empty-row"><td colSpan={Math.max(columns.length, 1)}>No data for this report.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
