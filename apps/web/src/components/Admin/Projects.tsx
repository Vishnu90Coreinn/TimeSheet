import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { Project } from "../../types";

type ProjectForm = { name: string; code: string; isActive: boolean };
const BLANK: ProjectForm = { name: "", code: "", isActive: true };

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [form, setForm] = useState<ProjectForm>(BLANK);
  const [error, setError] = useState("");

  async function load() {
    const r = await apiFetch("/projects");
    if (r.ok) setProjects(await r.json());
  }

  useEffect(() => { void load(); }, []);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }

  function openEdit(p: Project) {
    setForm({ name: p.name, code: p.code, isActive: p.isActive });
    setError("");
    setEditing(p);
  }

  async function save() {
    setError("");
    const body = { name: form.name, code: form.code, isActive: form.isActive };
    const r = editing === "new"
      ? await apiFetch("/projects", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/projects/${(editing as Project).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function archive(id: string) {
    if (!confirm("Archive this project? It will be deactivated and hidden from timesheets.")) return;
    await apiFetch(`/projects/${id}/archive`, { method: "POST" });
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this project permanently?")) return;
    await apiFetch(`/projects/${id}`, { method: "DELETE" });
    void load();
  }

  const f = (k: keyof ProjectForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <section>
      <h2>Project Admin</h2>
      <div style={{ marginBottom: "12px" }}>
        <button onClick={openCreate}>+ New Project</button>
        <button onClick={() => void load()} style={{ marginLeft: "8px" }}>Refresh</button>
      </div>

      {editing && (
        <div style={{ border: "1px solid #ccc", padding: "16px", borderRadius: "4px", marginBottom: "16px" }}>
          <h3>{editing === "new" ? "Create Project" : `Edit: ${(editing as Project).name}`}</h3>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "340px" }}>
            <label>Name<input value={form.name} onChange={(e) => f("name", e.target.value)} /></label>
            <label>Code<input value={form.code} onChange={(e) => f("code", e.target.value.toUpperCase())} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} /> Active
            </label>
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button onClick={() => void save()}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            {["Name", "Code", "Active", "Actions"].map((h) => (
              <th key={h} style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
              <td style={{ padding: "6px 8px" }}>{p.name}</td>
              <td style={{ padding: "6px 8px" }}><code>{p.code}</code></td>
              <td style={{ padding: "6px 8px" }}>{p.isActive ? "Yes" : "No"}</td>
              <td style={{ padding: "6px 8px", display: "flex", gap: "4px" }}>
                <button onClick={() => openEdit(p)}>Edit</button>
                {!p.isArchived && <button onClick={() => void archive(p.id)}>Archive</button>}
                <button onClick={() => void remove(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {projects.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "16px", color: "#888" }}>No projects</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
