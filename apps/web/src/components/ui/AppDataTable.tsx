/**
 * AppDataTable — Generic table with built-in search, sort, and pagination.
 *
 * Usage:
 *   const columns: ColumnDef<User>[] = [
 *     { key: "name", label: "Name", sortable: true,
 *       sortValue: u => u.name, searchValue: u => u.name,
 *       render: u => <span>{u.name}</span> },
 *   ];
 *   <AppDataTable columns={columns} data={users} rowKey={u => u.id} />
 */
import { useState, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  label: string;
  /** Show sort chevrons and allow clicking to sort */
  sortable?: boolean;
  /** Return comparable primitive for sorting */
  sortValue?: (row: T) => string | number | boolean;
  /** Return searchable string (defaults to String(sortValue)) */
  searchValue?: (row: T) => string;
  /** Fixed column width, e.g. "120px" */
  width?: string;
  /** Cell renderer */
  render: (row: T) => React.ReactNode;
}

interface AppDataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Stable unique key for each row */
  rowKey: (row: T) => string;
  /** Default rows per page (default 10) */
  defaultPageSize?: number;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Text shown when no rows match */
  emptyText?: string;
  /** Show skeleton rows while loading */
  loading?: boolean;
  /** Extra content in the toolbar right-hand side (filters, buttons…) */
  toolbar?: React.ReactNode;
  /** Apply row-level opacity for inactive/soft-deleted rows */
  rowOpacity?: (row: T) => number;
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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

function EmptyIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--n-300)"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AppDataTable<T>({
  columns,
  data,
  rowKey,
  defaultPageSize = 10,
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  loading = false,
  toolbar,
  rowOpacity,
}: AppDataTableProps<T>) {
  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState<string | null>(null);
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(defaultPageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  // ── Filter ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(row =>
      columns.some(col => {
        const v = col.searchValue
          ? col.searchValue(row)
          : col.sortValue
          ? String(col.sortValue(row))
          : "";
        return v.toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  // ── Sort ──
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "string"
        ? av.localeCompare(bv as string)
        : (Number(av) - Number(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // ── Paginate ──
  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage    = Math.min(page, totalPages);
  const start       = (safePage - 1) * pageSize;
  const pageRows    = sorted.slice(start, start + pageSize);
  const showingFrom = sorted.length === 0 ? 0 : start + 1;
  const showingTo   = Math.min(start + pageSize, sorted.length);

  // Page number pills (max 7 visible: first, …, window, …, last)
  const pageNums: (number | "…")[] = useMemo(() => {
    const nums: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (safePage > 3) nums.push("…");
      const lo = Math.max(2, safePage - 1);
      const hi = Math.min(totalPages - 1, safePage + 1);
      for (let i = lo; i <= hi; i++) nums.push(i);
      if (safePage < totalPages - 2) nums.push("…");
      nums.push(totalPages);
    }
    return nums;
  }, [totalPages, safePage]);

  // ── Styles ──
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

  const pageBtnBase: React.CSSProperties = {
    width: 30, height: 30,
    borderRadius: 6,
    border: "1px solid var(--border-default)",
    background: "var(--n-0)",
    color: "var(--text-primary)",
    fontSize: 13, fontWeight: 400,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.12s, color 0.12s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>

        {/* Search input */}
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none", display: "flex" }}>
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%", boxSizing: "border-box",
              paddingLeft: 32, paddingRight: 10, height: 34,
              borderRadius: 7, border: "1px solid var(--border-default)",
              background: "var(--n-0)", fontSize: 13,
              color: "var(--text-primary)", outline: "none",
            }}
          />
        </div>

        {/* Extra toolbar content */}
        {toolbar && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {toolbar}
          </div>
        )}

        {/* Rows-per-page selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", marginLeft: "auto", whiteSpace: "nowrap" }}>
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{
              height: 30, borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--n-0)", fontSize: 12,
              padding: "0 8px", color: "var(--text-primary)", cursor: "pointer",
            }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  style={{
                    ...thBase,
                    width: col.width,
                    cursor: col.sortable ? "pointer" : "default",
                  }}
                >
                  {col.label}
                  {col.sortable && (
                    <SortChevrons active={sortKey === col.key} dir={sortDir} />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              // ── Skeleton ──
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {columns.map(col => (
                    <td key={col.key} style={tdBase}>
                      <div style={{ height: 13, borderRadius: 4, background: "var(--n-100)", opacity: 1 - i * 0.15 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              // ── Empty state ──
              <tr>
                <td colSpan={columns.length} style={{ ...tdBase, padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <EmptyIcon />
                    <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{emptyText}</span>
                  </div>
                </td>
              </tr>
            ) : (
              // ── Data rows ──
              pageRows.map(row => (
                <tr
                  key={rowKey(row)}
                  style={{ opacity: rowOpacity ? rowOpacity(row) : 1 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--n-50)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                >
                  {columns.map(col => (
                    <td key={col.key} style={tdBase}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ─────────────────────────────────────────────────── */}
      {!loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap", gap: 8, background: "var(--n-25, #f9fafb)" }}>

          {/* Count label */}
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {sorted.length === 0
              ? "No results"
              : `Showing ${showingFrom}–${showingTo} of ${sorted.length} result${sorted.length !== 1 ? "s" : ""}`}
          </span>

          {/* Page controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

              {/* Prev */}
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(p => p - 1)}
                aria-label="Previous page"
                style={{ ...pageBtnBase, opacity: safePage <= 1 ? 0.35 : 1, cursor: safePage <= 1 ? "not-allowed" : "pointer", fontSize: 16 }}
              >
                ‹
              </button>

              {/* Page numbers */}
              {pageNums.map((p, i) =>
                p === "…" ? (
                  <span key={`ell-${i}`} style={{ width: 30, textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === safePage ? "page" : undefined}
                    style={{
                      ...pageBtnBase,
                      border: p === safePage ? "none" : "1px solid var(--border-default)",
                      background: p === safePage ? "var(--brand-500, #6366f1)" : "var(--n-0)",
                      color: p === safePage ? "#fff" : "var(--text-primary)",
                      fontWeight: p === safePage ? 700 : 400,
                    }}
                  >
                    {p}
                  </button>
                )
              )}

              {/* Next */}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => p + 1)}
                aria-label="Next page"
                style={{ ...pageBtnBase, opacity: safePage >= totalPages ? 0.35 : 1, cursor: safePage >= totalPages ? "not-allowed" : "pointer", fontSize: 16 }}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
