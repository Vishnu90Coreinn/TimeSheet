import type { CSSProperties } from "react";

/* ─── Base shimmer ────────────────────────────────────────── */
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}

/* ─── KPI card skeleton ───────────────────────────────────── */
export function SkeletonKPI() {
  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width={100} height={13} />
        <Skeleton width={32} height={32} borderRadius={8} />
      </div>
      <Skeleton width={70} height={28} borderRadius={6} />
      <Skeleton width={120} height={11} />
    </div>
  );
}

/* ─── Table row skeleton ──────────────────────────────────── */
export function SkeletonTableRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: "0.75rem 1rem" }}>
              <Skeleton width={c === 0 ? "60%" : c === cols - 1 ? 60 : "80%"} height={13} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ─── List item skeleton ──────────────────────────────────── */
export function SkeletonListItem() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0" }}>
      <Skeleton width={36} height={36} borderRadius={8} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="35%" height={11} />
      </div>
      <Skeleton width={60} height={22} borderRadius={99} />
    </div>
  );
}

/* ─── Page header skeleton ────────────────────────────────── */
export function SkeletonPageHeader() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton width={160} height={22} />
        <Skeleton width={240} height={13} />
      </div>
      <Skeleton width={120} height={36} borderRadius={8} />
    </div>
  );
}

/* ─── Full page skeleton (KPIs + table) ───────────────────── */
export function SkeletonPage({ kpis = 4, rows = 6, cols = 4 }: { kpis?: number; rows?: number; cols?: number }) {
  return (
    <div>
      <SkeletonPageHeader />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${kpis}, 1fr)`, gap: "1rem", marginBottom: "1.5rem" }}>
        {Array.from({ length: kpis }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} style={{ padding: "0.75rem 1rem", textAlign: "left" }}>
                  <Skeleton width={i === 0 ? 80 : 60} height={11} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkeletonTableRows rows={rows} cols={cols} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
