# Reports Page — Chart Views Design

**Date:** 2026-04-04
**Branch:** `feature/BackendAPIPagedResponse`
**Status:** Approved

---

## Problem

The Reports page has 7 data tabs, each showing only a table + KPI cards. There are no charts, making it hard to spot trends and distributions at a glance. This is flagged as a "High Impact" UI audit item.

---

## Decision

Add Chart.js-powered chart views to the 4 high-value tabs via a Chart / Table toggle. No new API calls — charts consume the same data already loaded for the table.

**Library:** `chart.js` + `react-chartjs-2` (official React bindings).

---

## Scope — High-Value Tabs

| Tab | Chart Type | Key Insight |
|-----|-----------|-------------|
| Attendance | Vertical Bar | Avg hours present per day over date range |
| Project Effort | Horizontal Bar | Total hours per project, sorted descending |
| Leave Usage | Doughnut | Leave days per employee (top 8 + overflow) |
| Overtime / Deficit | Vertical Bar | Weekly delta — green OT, red deficit |

Tabs not in scope (table-only): Timesheets, Leave Balance, Approvals.

---

## Section 1: Layout & Toggle

- A `Chart / Table` segmented control renders in the content card header row, on the right side alongside Search + Export controls.
- The toggle is only visible when `CHART_TABS.includes(reportKey)` (the 4 tabs above).
- When "Chart" is active: the table area is replaced by a 300px chart panel. Pagination footer is hidden.
- When "Table" is active: current table + pagination layout is unchanged.
- `viewMode` resets to `"table"` whenever the user switches tabs.
- KPI cards above always remain visible regardless of view mode.

---

## Section 2: Chart Specifications

### Attendance — Vertical Bar
- **X-axis:** Unique dates in current page data, formatted `"Mar 1"`, `"Mar 2"` etc.
- **Y-axis:** Hours (converted from minutes).
- **Value per bar:** Average `attendanceMinutes` across all employees for that date (reuses existing `aggregateAttendance()` output).
- **Color:** Indigo `#4f46e5` at 70% opacity.

### Project Effort — Horizontal Bar
- **`indexAxis: "y"`** — horizontal orientation.
- **Y-axis:** Project names.
- **X-axis:** Total hours.
- **Sort:** Descending by `totalMinutes`.
- **Colors:** Cycle through 8-color brand palette (indigo, violet, purple, sky, emerald, amber, rose, slate).

### Leave Usage — Doughnut
- **Segments:** Each employee's total `leaveDays`.
- **Cutout:** 60% (ring style).
- **Center label:** Total leave days (custom plugin or overlay div).
- **Legend:** Right side, max 8 items; if more employees, show "+N more" in a sub-label.
- **Colors:** 8-color brand palette cycling.

### Overtime / Deficit — Vertical Bar
- **X-axis:** Week start dates, formatted `"Mar 3"`, `"Mar 10"` etc.
- **Y-axis:** Delta hours (positive = OT, negative = deficit).
- **Bar colors:** Dynamic per bar — green `#10b981` (delta > 0), red `#ef4444` (delta < 0), grey `#6b7280` (delta = 0).
- **Zero reference line:** A second dataset with constant value `0` across all labels, rendered as a `line` type with no fill and a dashed border (`borderDash: [4, 4]`, grey `#9ca3af`). No extra plugins needed.

---

## Section 3: Architecture

### New File: `src/components/ui/ReportCharts.tsx`

Four named exports:
- `AttendanceChart({ items })`
- `ProjectEffortChart({ items })`
- `LeaveUsageChart({ items })`
- `OvertimeDeficitChart({ items })`

Each component:
1. Registers only the Chart.js modules it needs (`Chart.register(...)`) at the top of the file — not globally.
2. Derives chart data from the `items: Record<string, unknown>[]` prop (same array the table uses).
3. Renders inside a `<div style={{ height: 300, position: "relative" }}>` with `<ChartComponent ... options={{ responsive: true, maintainAspectRatio: false }} />`.

**Shared chart option defaults (defined once in the file):**
- `borderRadius: 4` on bars
- Gridline color: `#e5e7eb` (matches `--border-default`)
- Tooltip: custom formatter showing `fmtMins(minutes)` style output
- No chart title (KPI cards above already describe the data)
- Font: inherit from CSS (`"inherit"`)

Export `ReportCharts.tsx` from `src/components/ui/index.ts`.

### `Reports.tsx` Changes

1. `npm install chart.js react-chartjs-2` in `apps/web`.
2. Add `const CHART_TABS: ReportKey[] = ["attendance-summary", "project-effort", "leave-utilization", "overtime-deficit"]`.
3. Add `const [viewMode, setViewMode] = useState<"table" | "chart">("table")`.
4. In `switchTab()`: add `setViewMode("table")`.
5. In the content card header row: render the `Chart / Table` toggle when `CHART_TABS.includes(reportKey)`.
6. Replace the table section with a conditional: `viewMode === "chart" ? <ChartPanel /> : <TablePanel />`.

The chart panel renders the correct chart component based on `reportKey`. Pagination is not rendered in chart view.

---

## Dependencies

```
chart.js ^4.x
react-chartjs-2 ^5.x
```

No backend changes. No new API endpoints. No new state beyond `viewMode`.

---

## Out of Scope

- Charts on Timesheets, Leave Balance, Approvals tabs
- Downloading the chart as an image
- Chart animation configuration (use Chart.js defaults)
- Dark mode chart theming
