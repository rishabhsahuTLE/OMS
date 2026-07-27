import { useEffect, useMemo, useRef, useState } from "react";

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function sameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBefore(a: Date, b: Date) {
  return a.getTime() < b.getTime();
}

function formatShort(d: Date) {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return cells;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(() => value.start ?? new Date(2026, 6, 21));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHoverDate(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectingEnd = value.start !== null && value.end === null;

  const previewEnd = useMemo(() => {
    if (!selectingEnd) return value.end;
    return hoverDate ?? value.start;
  }, [selectingEnd, hoverDate, value.start, value.end]);

  function rangeContains(day: Date) {
    if (!value.start) return false;
    const end = previewEnd;
    if (!end) return sameDay(day, value.start);
    const lo = isBefore(value.start, end) ? value.start : end;
    const hi = isBefore(value.start, end) ? end : value.start;
    const t = day.getTime();
    return t >= new Date(lo.getFullYear(), lo.getMonth(), lo.getDate()).getTime() &&
      t <= new Date(hi.getFullYear(), hi.getMonth(), hi.getDate()).getTime();
  }

  function handleDayClick(day: Date) {
    if (!value.start || (value.start && value.end)) {
      onChange({ start: day, end: null });
      setHoverDate(null);
      return;
    }
    // second click: commit the end (swap if needed)
    let start = value.start;
    let end = day;
    if (isBefore(end, start)) {
      [start, end] = [end, start];
    }
    onChange({ start, end });
    setHoverDate(null);
    setOpen(false);
  }

  function goToMonth(offset: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  }

  const label =
    value.start && value.end
      ? `${formatShort(value.start)} – ${formatShort(value.end)}`
      : value.start
      ? `${formatShort(value.start)} – Select end date`
      : "Select date range";

  const monthCells = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth());

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400"
      >
        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z" />
        </svg>
        <span>{label}</span>
        {(value.start || value.end) && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ start: null, end: null });
              setHoverDate(null);
            }}
            className="ml-1 text-slate-400 hover:text-slate-600"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => goToMonth(-1)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-slate-800">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              onClick={() => goToMonth(1)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-slate-400">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
            {monthCells.map((day, idx) => {
              const inCurrentMonth = day.getMonth() === viewDate.getMonth();
              const isStart = sameDay(day, value.start);
              const isEnd = sameDay(day, previewEnd);
              const inRange = rangeContains(day);
              const isEdge = isStart || isEnd;

              return (
                <div
                  key={idx}
                  className={`relative py-0.5 ${inRange && !isEdge ? "bg-indigo-50" : ""} ${
                    isStart ? "rounded-l-full bg-indigo-50" : ""
                  } ${isEnd ? "rounded-r-full bg-indigo-50" : ""}`}
                >
                  <button
                    type="button"
                    disabled={!inCurrentMonth}
                    onMouseEnter={() => selectingEnd && setHoverDate(day)}
                    onClick={() => handleDayClick(day)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                      !inCurrentMonth
                        ? "text-slate-300"
                        : isEdge
                        ? "bg-indigo-600 text-white font-medium"
                        : "text-slate-700 hover:bg-indigo-100"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex justify-between border-t border-slate-100 pt-2">
            <button
              onClick={() => {
                onChange({ start: null, end: null });
                setHoverDate(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
