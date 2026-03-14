/**
 * Dashboard.tsx — Task 4: AttendanceWidget added at the top of the dashboard.
 * Existing role-based data fetch is unchanged.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { AttendanceWidget } from "./AttendanceWidget";

interface DashboardProps {
  role: string;
}

export function Dashboard({ role }: DashboardProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const path =
      role === "admin"
        ? "/dashboard/management"
        : role === "manager"
        ? "/dashboard/manager"
        : "/dashboard/employee";
    apiFetch(path).then(async (r) => {
      if (r.ok) setData(await r.json());
    });
  }, [role]);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Attendance widget — always visible on dashboard */}
      <AttendanceWidget />

      <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "22px", fontWeight: 700, margin: "4px 0 0", color: "#0F172A" }}>
        Dashboard
      </h2>
      <pre className="card">{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
