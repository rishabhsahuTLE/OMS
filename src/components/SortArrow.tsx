import type { SortDirection } from "../utils";

// Shared clickable-header arrow: triangle rotates 180° on desc, indigo when
// this column is the active sort key, slate otherwise.
export default function SortArrow({ direction, active }: { direction: SortDirection; active: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${direction === "desc" ? "rotate-180" : ""} ${
        active ? "text-indigo-600" : "text-slate-400"
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M10 5l5 6H5l5-6z" />
    </svg>
  );
}
