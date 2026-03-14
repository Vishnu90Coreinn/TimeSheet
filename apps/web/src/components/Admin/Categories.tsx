import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { TaskCategory } from "../../types";

export function Categories() {
  const [categories, setCategories] = useState<TaskCategory[]>([]);

  useEffect(() => {
    apiFetch("/task-categories").then(async (r) => { if (r.ok) setCategories(await r.json()); });
  }, []);

  return (
    <section>
      <h2>Category Admin</h2>
      <button onClick={() => apiFetch("/task-categories").then(async (r) => { if (r.ok) setCategories(await r.json()); })}>Refresh</button>
      <ul>{categories.map((c) => <li key={c.id}>{c.name} {c.isBillable ? "(billable)" : ""} {!c.isActive ? "[inactive]" : ""}</li>)}</ul>
    </section>
  );
}
