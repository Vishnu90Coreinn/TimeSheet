/**
 * ReportCharts.tsx — Chart.js chart views for the Reports page.
 * Four purpose-built charts for the high-value report tabs.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

// ── Shared helpers ────────────────────────────────────────────────────────────
const BRAND_PALETTE = [
  "#4f46e5", "#7c3aed", "#9333ea", "#0ea5e9",
  "#10b981", "#f59e0b", "#f43f5e", "#64748b",
];

function fmtMins(m: number): string {
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const min = abs % 60;
  const sign = m < 0 ? "-" : "";
  return min === 0 ? `${sign}${h}h` : `${sign}${h}h ${min}m`;
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const GRID_COLOR = "#e5e7eb";
const FONT_FAMILY = "inherit";

const baseScales = {
  x: { grid: { color: GRID_COLOR }, ticks: { font: { family: FONT_FAMILY, size: 11 } } },
  y: { grid: { color: GRID_COLOR }, ticks: { font: { family: FONT_FAMILY, size: 11 } } },
};

// ── Attendance Chart ──────────────────────────────────────────────────────────
export function AttendanceChart({ items }: { items: Record<string, unknown>[] }) {
  // Aggregate avg attendance minutes per date
  const dateMap = new Map<string, { total: number; count: number }>();
  for (const row of items) {
    const date = String(row.workDate ?? "");
    if (!date) continue;
    const mins = Number(row.attendanceMinutes) || 0;
    const existing = dateMap.get(date);
    if (existing) {
      existing.total += mins;
      existing.count += 1;
    } else {
      dateMap.set(date, { total: mins, count: 1 });
    }
  }

  const sorted = Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const labels = sorted.map(([date]) => fmtDateShort(date));
  const values = sorted.map(([, { total, count }]) => parseFloat((total / count / 60).toFixed(2)));

  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Avg Hours Present",
        data: values,
        backgroundColor: "rgba(79,70,229,0.7)",
        borderColor: "#4f46e5",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `${fmtMins(Math.round((ctx.parsed.y ?? 0) * 60))} avg`,
        },
      },
    },
    scales: {
      ...baseScales,
      y: {
        ...baseScales.y,
        title: { display: true, text: "Hours", font: { family: FONT_FAMILY, size: 11 } },
      },
    },
  };

  return (
    <div style={{ height: 300, position: "relative", padding: "16px 20px" }}>
      <Bar data={data} options={options} />
    </div>
  );
}

// ── Project Effort Chart ──────────────────────────────────────────────────────
export function ProjectEffortChart({ items }: { items: Record<string, unknown>[] }) {
  const sorted = [...items].sort((a, b) => (Number(b.totalMinutes) || 0) - (Number(a.totalMinutes) || 0));
  const top = sorted.slice(0, 12);

  const labels = top.map(r => String(r.projectName ?? ""));
  const values = top.map(r => parseFloat(((Number(r.totalMinutes) || 0) / 60).toFixed(2)));

  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Total Hours",
        data: values,
        backgroundColor: top.map((_, i) => BRAND_PALETTE[i % BRAND_PALETTE.length] + "cc"),
        borderColor: top.map((_, i) => BRAND_PALETTE[i % BRAND_PALETTE.length]),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => fmtMins(Math.round((ctx.parsed.x ?? 0) * 60)),
        },
      },
    },
    scales: {
      x: {
        ...baseScales.x,
        title: { display: true, text: "Hours", font: { family: FONT_FAMILY, size: 11 } },
      },
      y: { ...baseScales.y, grid: { display: false } },
    },
  };

  const height = Math.max(300, top.length * 36 + 40);

  return (
    <div style={{ height, position: "relative", padding: "16px 20px" }}>
      <Bar data={data} options={options} />
    </div>
  );
}

// ── Leave Usage Chart ─────────────────────────────────────────────────────────
export function LeaveUsageChart({ items }: { items: Record<string, unknown>[] }) {
  // Sum leave days per employee
  const empMap = new Map<string, number>();
  for (const row of items) {
    const name = String(row.username ?? "");
    empMap.set(name, (empMap.get(name) ?? 0) + (Number(row.leaveDays) || 0));
  }

  const sorted = Array.from(empMap.entries())
    .sort(([, a], [, b]) => b - a);

  const MAX_SEGMENTS = 8;
  const visible = sorted.slice(0, MAX_SEGMENTS);
  const overflow = sorted.slice(MAX_SEGMENTS);
  const overflowTotal = overflow.reduce((s, [, v]) => s + v, 0);

  const labels = visible.map(([name]) => name);
  const values = visible.map(([, v]) => v);
  if (overflowTotal > 0) {
    labels.push(`+${overflow.length} more`);
    values.push(overflowTotal);
  }

  const totalDays = sorted.reduce((s, [, v]) => s + v, 0);

  const data: ChartData<"doughnut"> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((_, i) =>
          i < MAX_SEGMENTS ? BRAND_PALETTE[i % BRAND_PALETTE.length] + "cc" : "#94a3b8cc"
        ),
        borderColor: labels.map((_, i) =>
          i < MAX_SEGMENTS ? BRAND_PALETTE[i % BRAND_PALETTE.length] : "#94a3b8"
        ),
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: {
        position: "right",
        labels: { font: { family: FONT_FAMILY, size: 11 }, boxWidth: 12, padding: 10 },
      },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.label}: ${ctx.parsed}d`,
        },
      },
    },
  };

  return (
    <div style={{ height: 300, position: "relative", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <Doughnut data={data} options={options} />
        <div style={{ position: "absolute", top: "50%", left: "30%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{totalDays}d</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 3 }}>total leave</div>
        </div>
      </div>
    </div>
  );
}

// ── Overtime / Deficit Chart ──────────────────────────────────────────────────
export function OvertimeDeficitChart({ items }: { items: Record<string, unknown>[] }) {
  // Aggregate delta per week
  const weekMap = new Map<string, number>();
  for (const row of items) {
    const week = String(row.weekStart ?? "");
    if (!week) continue;
    weekMap.set(week, (weekMap.get(week) ?? 0) + (Number(row.deltaMinutes) || 0));
  }

  const sorted = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const labels = sorted.map(([week]) => fmtDateShort(week));
  const values = sorted.map(([, mins]) => parseFloat((mins / 60).toFixed(2)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Delta",
        data: values,
        backgroundColor: values.map(v => v > 0 ? "rgba(16,185,129,0.75)" : v < 0 ? "rgba(239,68,68,0.75)" : "rgba(107,114,128,0.5)"),
        borderColor: values.map(v => v > 0 ? "#10b981" : v < 0 ? "#ef4444" : "#6b7280"),
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        type: "line",
        label: "Zero line",
        data: values.map(() => 0),
        borderColor: "#9ca3af",
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ctx.datasetIndex === 0
            ? fmtMins(Math.round((ctx.parsed.y ?? 0) * 60))
            : "",
        },
      },
    },
    scales: {
      ...baseScales,
      y: {
        ...baseScales.y,
        title: { display: true, text: "Hours", font: { family: FONT_FAMILY, size: 11 } },
      },
    },
  };

  return (
    <div style={{ height: 300, position: "relative", padding: "16px 20px" }}>
      <Bar data={data} options={options} />
    </div>
  );
}
