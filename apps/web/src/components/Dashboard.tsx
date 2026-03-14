import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface DashboardProps {
  role: string;
}

export function Dashboard({ role }: DashboardProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const path = role === "admin" ? "/dashboard/management" : role === "manager" ? "/dashboard/manager" : "/dashboard/employee";
    apiFetch(path).then(async (r) => {
      if (r.ok) setData(await r.json());
    });
  }, [role]);

  return (
    <section>
      <h2>Dashboard</h2>
      <pre className="card">{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
