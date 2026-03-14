import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    apiFetch("/projects").then(async (r) => { if (r.ok) setProjects(await r.json()); });
  }, []);

  return (
    <section>
      <h2>Project Admin</h2>
      <button onClick={() => apiFetch("/projects").then(async (r) => { if (r.ok) setProjects(await r.json()); })}>Refresh</button>
      <ul>{projects.map((p) => <li key={p.id}>{p.name} ({p.code}) {p.isArchived ? "[archived]" : ""}</li>)}</ul>
    </section>
  );
}
