import { useEffect, useMemo, useRef, useState } from "react";

interface SearchableSelectProps {
  label: string;
  allLabel: string;
  options: string[];
  value: string; // "all" or one of options
  onChange: (value: string) => void;
  searchPlaceholder?: string;
}

export default function SearchableSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
  searchPlaceholder = "Search…",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm text-slate-600">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm hover:border-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      >
        <span className={value === "all" ? "text-slate-500" : "text-slate-800"}>
          {value === "all" ? allLabel : value}
        </span>
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.2 7.2a1 1 0 011.4 0L10 10.6l3.4-3.4a1 1 0 111.4 1.4l-4.1 4.1a1 1 0 01-1.4 0L5.2 8.6a1 1 0 010-1.4z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="max-h-56 overflow-auto py-1">
            <button
              type="button"
              onClick={() => select("all")}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 ${
                value === "all" ? "font-medium text-indigo-700" : "text-slate-700"
              }`}
            >
              {allLabel}
            </button>
            {filteredOptions.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => select(o)}
                className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-indigo-50 ${
                  value === o ? "font-medium text-indigo-700" : "text-slate-700"
                }`}
                title={o}
              >
                {o}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
