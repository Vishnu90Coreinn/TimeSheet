import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "../../api/client";
import { AppButton, AppInput, AppPagination, AppSelect, AppTableShell } from "../ui";

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
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
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

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 1;
  const items = data?.items ?? [];
  const actionOptions = Array.from(new Set(items.map((i) => i.action))).sort((a, b) => a.localeCompare(b));
  const entityOptions = Array.from(new Set(items.map((i) => i.entityType))).sort((a, b) => a.localeCompare(b));
  const visibleItems = items.filter((entry) => {
    const actionMatch = !actionFilter || entry.action === actionFilter;
    const entityMatch = !entityFilter || entry.entityType === entityFilter;
    return actionMatch && entityMatch;
  });
  const hasFilters = Boolean(search || searchInput || actionFilter || entityFilter);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Track who changed what, and when.</p>
        </div>
        <div className="text-[0.75rem] text-text-tertiary">
          {data?.totalCount ?? 0} total records
        </div>
      </div>

      <div className="card overflow-visible mb-4">
        <form onSubmit={handleSearch} className="mgmt-toolbar p-4">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <AppInput
              type="text"
              className="pl-8"
              placeholder="Search action, entity type, ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <AppSelect className="mgmt-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All actions</option>
            {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
          </AppSelect>
          <AppSelect className="mgmt-select" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="">All entities</option>
            {entityOptions.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
          </AppSelect>
          <AppButton type="submit" variant="primary" size="sm">Search</AppButton>
          {hasFilters && (
            <AppButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setActionFilter("");
                setEntityFilter("");
                setPage(1);
              }}
            >
              Clear
            </AppButton>
          )}
        </form>
        <div className="px-4 pb-3 text-[0.75rem] text-text-tertiary">
          Showing {visibleItems.length} of {items.length} records on this page
        </div>
      </div>

      <div className="card overflow-hidden">
        <AppTableShell className="overflow-x-auto">
          <table className="table-base mgmt-table w-full">
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
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-tertiary py-8">No audit log entries found</td>
                </tr>
              ) : (
                visibleItems.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-[0.75rem] text-text-secondary whitespace-nowrap">
                      {new Date(entry.createdAtUtc).toLocaleString()}
                    </td>
                    <td className="font-mono text-[0.72rem] text-text-tertiary">
                      {entry.actorUserId ? `${entry.actorUserId.slice(0, 8)}...` : "—"}
                    </td>
                    <td>
                      <span className="badge badge-brand text-[0.72rem]">{entry.action}</span>
                    </td>
                    <td className="text-[0.8rem] text-text-secondary">{entry.entityType}</td>
                    <td className="font-mono text-[0.72rem] text-text-tertiary">
                      {entry.entityId.length > 12 ? `${entry.entityId.slice(0, 12)}...` : entry.entityId}
                    </td>
                    <td className="text-[0.75rem] text-text-secondary max-w-[260px] truncate" title={entry.details ?? undefined}>
                      {entry.details ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AppTableShell>

        {data && totalPages > 1 && (
          <div className="mgmt-card-foot">
            <span className="text-[0.75rem] text-text-tertiary">
              Page {page} of {totalPages} · {data.totalCount} total entries
            </span>
            <AppPagination page={page} totalPages={totalPages} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
          </div>
        )}
      </div>
    </section>
  );
}
