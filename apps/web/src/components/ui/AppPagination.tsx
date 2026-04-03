import { useMemo } from "react";

interface AppPaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onPage?: (p: number) => void;
  className?: string;
}

export function AppPagination({ page, totalPages, onPrev, onNext, onPage, className = "" }: AppPaginationProps) {
  const pageNums: (number | "…")[] = useMemo(() => {
    const nums: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push("…");
      const lo = Math.max(2, page - 1);
      const hi = Math.min(totalPages - 1, page + 1);
      for (let i = lo; i <= hi; i++) nums.push(i);
      if (page < totalPages - 2) nums.push("…");
      nums.push(totalPages);
    }
    return nums;
  }, [page, totalPages]);

  const btnBase: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 6,
    border: "1px solid var(--border-default)",
    background: "var(--n-0)", color: "var(--text-primary)",
    fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.12s, color 0.12s",
  };

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        aria-label="Previous page"
        style={{ ...btnBase, opacity: page <= 1 ? 0.35 : 1, cursor: page <= 1 ? "not-allowed" : "pointer", fontSize: 16 }}
      >
        ‹
      </button>

      {pageNums.map((p, i) =>
        p === "…" ? (
          <span key={`ell-${i}`} style={{ width: 30, textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage ? onPage(p) : undefined}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            style={{
              ...btnBase,
              border: p === page ? "none" : "1px solid var(--border-default)",
              background: p === page ? "var(--brand-500, #6366f1)" : "var(--n-0)",
              color: p === page ? "#fff" : "var(--text-primary)",
              fontWeight: p === page ? 700 : 400,
              cursor: onPage ? "pointer" : "default",
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label="Next page"
        style={{ ...btnBase, opacity: page >= totalPages ? 0.35 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer", fontSize: 16 }}
      >
        ›
      </button>
    </div>
  );
}
