import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { TaskCategory } from "../../types";

type CatForm = { name: string; isBillable: boolean; isActive: boolean };
const BLANK: CatForm = { name: "", isBillable: false, isActive: true };

export function Categories() {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [editing, setEditing] = useState<TaskCategory | "new" | null>(null);
  const [form, setForm] = useState<CatForm>(BLANK);
  const [error, setError] = useState("");

  async function load() {
    const r = await apiFetch("/task-categories/admin");
    if (r.ok) setCategories(await r.json());
  }

  useEffect(() => { void load(); }, []);

  function openCreate() { setForm(BLANK); setError(""); setEditing("new"); }

  function openEdit(c: TaskCategory) {
    setForm({ name: c.name, isBillable: c.isBillable, isActive: c.isActive });
    setError("");
    setEditing(c);
  }

  async function save() {
    setError("");
    const body = { name: form.name, isBillable: form.isBillable, isActive: form.isActive };
    const r = editing === "new"
      ? await apiFetch("/task-categories", { method: "POST", body: JSON.stringify(body) })
      : await apiFetch(`/task-categories/${(editing as TaskCategory).id}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.ok || r.status === 204) { setEditing(null); void load(); }
    else { const d = await r.json().catch(() => ({})); setError((d as { message?: string }).message ?? "Save failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category?")) return;
    await apiFetch(`/task-categories/${id}`, { method: "DELETE" });
    void load();
  }

  const f = (k: keyof CatForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <section>
      <h2>Category Admin</h2>
      <div style={{ marginBottom: "12px" }}>
        <button onClick={openCreate}>+ New Category</button>
        <button onClick={() => void load()} style={{ marginLeft: "8px" }}>Refresh</button>
      </div>

      {editing && (
        <div style={{ border: "1px solid #ccc", padding: "16px", borderRadius: "4px", marginBottom: "16px" }}>
          <h3>{editing === "new" ? "Create Category" : `Edit: ${(editing as TaskCategory).name}`}</h3>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "340px" }}>
            <label>Name<input value={form.name} onChange={(e) => f("name", e.target.value)} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={form.isBillable} onChange={(e) => f("isBillable", e.target.checked)} /> Billable
            </label>
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
            {["Name", "Billable", "Active", "Actions"].map((h) => (
              <th key={h} style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
              <td style={{ padding: "6px 8px" }}>{c.name}</td>
              <td style={{ padding: "6px 8px" }}>{c.isBillable ? "Yes" : "No"}</td>
              <td style={{ padding: "6px 8px" }}>{c.isActive ? "Yes" : "No"}</td>
              <td style={{ padding: "6px 8px", display: "flex", gap: "4px" }}>
                <button onClick={() => openEdit(c)}>Edit</button>
                <button onClick={() => void remove(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {categories.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "16px", color: "#888" }}>No categories</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
