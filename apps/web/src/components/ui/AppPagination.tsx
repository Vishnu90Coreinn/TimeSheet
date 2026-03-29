import { AppButton } from "./AppButton";

interface AppPaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function AppPagination({ page, totalPages, onPrev, onNext, className = "" }: AppPaginationProps) {
  return (
    <div className={`mgmt-pagination ${className}`.trim()}>
      <AppButton variant="outline" size="sm" className="px-2" aria-label="Previous page" onClick={onPrev} disabled={page <= 1}>
        {"<"}
      </AppButton>
      <AppButton variant="primary" size="sm" className="px-3" aria-label={`Page ${page}`}>
        {page}
      </AppButton>
      <AppButton variant="outline" size="sm" className="px-2" aria-label="Next page" onClick={onNext} disabled={page >= totalPages}>
        {">"}
      </AppButton>
    </div>
  );
}

