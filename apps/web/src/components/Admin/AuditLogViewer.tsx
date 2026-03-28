/**
 * AuditLogViewer.tsx — Searchable, paginated audit log for admins.
 */
import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "../../api/client";

interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAtUtc: string;
}

interface PageResponse {
  items: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function AuditLogViewer() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set("search", search);
    const r = await apiFetch(`/admin/audit-logs?${params.toString()}`);
    if (r.ok) setData(await r.json() as PageResponse);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 1;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-subtitle">All user actions recorded in the system</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            className="form-input pl-8"
            placeholder="Search action, entity type, ID…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        {search && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j}><div className="skeleton h-3 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-tertiary py-8">No audit log entries found</td>
                </tr>
              ) : (
                data?.items.map(entry => (
                  <tr key={entry.id}>
                    <td className="text-[0.75rem] text-text-secondary whitespace-nowrap">
                      {new Date(entry.createdAtUtc).toLocaleString()}
                    </td>
                    <td className="font-mono text-[0.72rem] text-text-tertiary">
                      {entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "—"}
                    </td>
                    <td>
                      <span className="badge badge-info text-[0.72rem]">{entry.action}</span>
                    </td>
                    <td className="text-[0.8rem] text-text-secondary">{entry.entityType}</td>
                    <td className="font-mono text-[0.72rem] text-text-tertiary">
                      {entry.entityId.length > 12 ? entry.entityId.slice(0, 12) + "…" : entry.entityId}
                    </td>
                    <td className="text-[0.75rem] text-text-secondary max-w-[200px] truncate" title={entry.details ?? undefined}>
                      {entry.details ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
            <span className="text-[0.75rem] text-text-tertiary">
              {data.totalCount} total entries
            </span>
            <div className="flex gap-1">
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-[0.8rem] text-text-secondary">
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
