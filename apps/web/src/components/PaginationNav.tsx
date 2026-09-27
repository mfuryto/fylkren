export const queuePageSize = 20;

export function PaginationNav({ page, totalItems, onPageChange, label }: { page: number; totalItems: number; onPageChange: (page: number) => void; label: string }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / queuePageSize));
  if (totalPages <= 1) return null;
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index);
  return <nav className="pagination" aria-label={label}>
    <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Forrige</button>
    <span className="pagination-pages" aria-label={`Side ${page} av ${totalPages}`}>{pages.map(value => <button className={value === page ? "pagination-page active" : "pagination-page"} type="button" aria-current={value === page ? "page" : undefined} onClick={() => onPageChange(value)} key={value}>{value}</button>)}</span>
    <button className="secondary-button" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Neste</button>
  </nav>;
}
