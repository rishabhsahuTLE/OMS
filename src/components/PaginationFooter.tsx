interface PaginationFooterProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalRecords: number;
}

// Windows the page-button list around the current page once there are many
// pages, rather than rendering an unbounded row of numbers.
function pageButtons(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const keep = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = Array.from(keep)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

// Shared footer for every record-listing table — numbered page buttons +
// prev/next on the left, an editable page-size box + total-record count on
// the right, matching the reference "Empower" screenshot's table footer.
export default function PaginationFooter({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalRecords,
}: PaginationFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        {pageButtons(page, totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                p === page
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          value={pageSize}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n > 0) onPageSizeChange(n);
          }}
          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span>Total {totalRecords} records</span>
      </div>
    </div>
  );
}
