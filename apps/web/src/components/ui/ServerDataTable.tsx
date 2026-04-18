import { useMemo } from "react";
import { AppPagination } from "./AppPagination";
import { EmptyState, EmptySearch } from "../EmptyState";

export interface ServerColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  // Backward-compatible metadata used by legacy column definitions.
  // ServerDataTable does not use these values, but keeping them typed
  // avoids migration breaks while admin pages are being converged.
  sortValue?: (row: T) => unknown;
  searchValue?: (row: T) => string;
  render: (row: T) => React.ReactNode;
}

export interface ServerTableQuery {
  page: number;
  pageSize: number;
  search: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

interface ServerDataTableProps<T> {
  columns: ServerColumnDef<T>[];
  data: T[];
  totalCount: number;
  rowKey: (row: T) => string;
  query: ServerTableQuery;
  onQueryChange: (next: ServerTableQuery) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  toolbar?: React.ReactNode;
  rowOpacity?: (row: T) => number;
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SortChevrons({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  const brand = "var(--brand-500, #6366f1)";
  const dim = "var(--text-tertiary, #94a3b8)";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 1.5, marginLeft: 5, verticalAlign: "middle", lineHeight: 0 }}>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="none" aria-hidden="true">
        <path d="M3.5 0L7 4H0L3.5 0Z" fill={active && dir === "asc" ? brand : dim} />
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="none" aria-hidden="true">
        <path d="M3.5 4L0 0H7L3.5 4Z" fill={active && dir === "desc" ? brand : dim} />
      </svg>
    </span>
  );
}

export function ServerDataTable<T>({
  columns,
  data,
  totalCount,
  rowKey,
  query,
  onQueryChange,
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  loading = false,
  toolbar,
  rowOpacity,
}: ServerDataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
  const safePage = Math.min(query.page, totalPages);
  const showingFrom = totalCount === 0 ? 0 : (safePage - 1) * query.pageSize + 1;
  const showingTo = Math.min(safePage * query.pageSize, totalCount);

  const thBase: React.CSSProperties = {
    padding: "9px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--text-tertiary)",
    background: "var(--n-25, #f9fafb)",
    borderBottom: "1px solid var(--border-subtle)",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  const tdBase: React.CSSProperties = {
    padding: "11px 14px",
    borderBottom: "1px solid var(--border-subtle)",
    verticalAlign: "middle",
    color: "var(--text-secondary)",
    fontSize: 13,
  };

  const loadingRows = useMemo(() => Array.from({ length: 5 }), []);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none", display: "flex" }}>
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={query.search}
            onChange={e => onQueryChange({ ...query, search: e.target.value, page: 1 })}
            style={{
              width: "100%",
              boxSizing: "border-box",
              paddingLeft: 32,
              paddingRight: 10,
              height: 34,
              borderRadius: 7,
              border: "1px solid var(--border-default)",
              background: "var(--n-0)",
              fontSize: 13,
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>

        {toolbar && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {toolbar}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", marginLeft: "auto", whiteSpace: "nowrap" }}>
          <span>Rows per page</span>
          <select
            value={query.pageSize}
            onChange={e => onQueryChange({ ...query, pageSize: Number(e.target.value), page: 1 })}
            style={{
              height: 30,
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--n-0)",
              fontSize: 12,
              padding: "0 8px",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => {
                    const same = query.sortBy === col.key;
                    onQueryChange({
                      ...query,
                      page: 1,
                      sortBy: col.key,
                      sortDir: same ? (query.sortDir === "asc" ? "desc" : "asc") : "asc",
                    });
                  } : undefined}
                  style={{
                    ...thBase,
                    width: col.width,
                    cursor: col.sortable ? "pointer" : "default",
                  }}
                >
                  {col.label}
                  {col.sortable && <SortChevrons active={query.sortBy === col.key} dir={query.sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              loadingRows.map((_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map(col => (
                    <td key={col.key} style={tdBase}>
                      <div style={{ height: 13, borderRadius: 4, background: "var(--n-100)", opacity: 1 - i * 0.15 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ ...tdBase, padding: "40px 20px", textAlign: "center" }}>
                  {query.search.trim()
                    ? <EmptySearch query={query.search} />
                    : <EmptyState size="sm" title={emptyText} />
                  }
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={rowKey(row)} style={{ opacity: rowOpacity ? rowOpacity(row) : 1 }}>
                  {columns.map(col => (
                    <td key={col.key} style={tdBase}>{col.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Showing {showingFrom}-{showingTo} of {totalCount}
          </div>
          <AppPagination
            page={safePage}
            totalPages={totalPages}
            onPrev={() => onQueryChange({ ...query, page: Math.max(1, safePage - 1) })}
            onNext={() => onQueryChange({ ...query, page: Math.min(totalPages, safePage + 1) })}
            onPage={(p) => onQueryChange({ ...query, page: p })}
          />
        </div>
      )}
    </div>
  );
}
