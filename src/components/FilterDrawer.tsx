import type { ReactNode } from "react";

export interface FilterDrawerCategory {
  key: string;
  label: string;
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  categories: FilterDrawerCategory[];
  activeCategory: string;
  onSelectCategory: (key: string) => void;
  onClear: () => void;
  onApply: () => void;
  children: ReactNode;
}

function FunnelIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 4a1 1 0 011-1h12a1 1 0 01.8 1.6L12 12v4a1 1 0 01-.45.83l-2 1.34A1 1 0 018 17.3V12L3.2 4.6A1 1 0 013 4z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

// A generic right-anchored filter drawer: dark header with a title + close,
// a left rail of filter categories, and a right pane rendering whichever
// category is active. Always mounted (not conditionally rendered) so the
// open/close transition can animate instead of popping in.
export default function FilterDrawer({
  open,
  onClose,
  title,
  categories,
  activeCategory,
  onSelectCategory,
  onClear,
  onApply,
  children,
}: FilterDrawerProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />

      <div
        className={`relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between bg-indigo-900 px-6 py-4">
          <div className="flex items-center gap-2 text-white">
            <FunnelIcon />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-40 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelectCategory(c.key)}
                className={`block w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                  activeCategory === c.key
                    ? "bg-indigo-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-md bg-indigo-900 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
