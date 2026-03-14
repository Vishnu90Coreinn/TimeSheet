import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { ReportKey } from "../types";

export function Reports() {
  const [reportKey, setReportKey] = useState<ReportKey>("attendance-summary");
  const [reportRows, setReportRows] = useState<Record<string, unknown>[]>([]);

  function loadReport(key: ReportKey) {
    apiFetch(`/reports/${key}`).then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setReportRows(d.items ?? []);
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

  return (
    <section>
      <h2>Reports</h2>
      <div className="actions wrap">
        <select value={reportKey} onChange={(e) => { const key = e.target.value as ReportKey; setReportKey(key); loadReport(key); }}>
          <option value="attendance-summary">Attendance Summary</option>
          <option value="timesheet-summary">Timesheet Summary</option>
          <option value="project-effort">Project Effort</option>
          <option value="leave-utilization">Leave &amp; Utilization</option>
        </select>
        <button onClick={() => void exportReport("csv")}>Export CSV</button>
        <button onClick={() => void exportReport("excel")}>Export Excel</button>
        <button onClick={() => void exportReport("pdf")}>Export PDF</button>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>{Object.keys(reportRows[0] ?? {}).map((k) => <th key={k}>{k}</th>)}</tr>
          </thead>
          <tbody>
            {reportRows.map((row, i) => (
              <tr key={i}>{Object.entries(row).map(([k, v]) => <td key={k}>{String(v)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
