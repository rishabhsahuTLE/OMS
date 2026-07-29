import { useMemo, useState } from "react";
import type { DateRange } from "./DateRangePicker";

interface InlineDateRangeCalendarProps {
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBefore(a: Date, b: Date) {
  return a.getTime() < b.getTime();
}

function formatSlash(d: Date | null) {
  if (!d) return "dd-mm-yy";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
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

// The Date category panel in the Billing filter drawer: two months shown
// side by side (like the reference "Leads Filters" drawer), sharing a single
// pair of prev/next controls on the outer edges rather than one per month.
export default function InlineDateRangeCalendar({ value, onChange }: InlineDateRangeCalendarProps) {
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(() => value.start ?? new Date());

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
    return (
      t >= new Date(lo.getFullYear(), lo.getMonth(), lo.getDate()).getTime() &&
      t <= new Date(hi.getFullYear(), hi.getMonth(), hi.getDate()).getTime()
    );
  }

  function handleDayClick(day: Date) {
    if (!value.start || (value.start && value.end)) {
      onChange({ start: day, end: null });
      setHoverDate(null);
      return;
    }
    let start = value.start;
    let end = day;
    if (isBefore(end, start)) {
      [start, end] = [end, start];
    }
    onChange({ start, end });
    setHoverDate(null);
  }

  function goToMonth(offset: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  }

  function renderMonth(year: number, month: number, edge: "prev" | "next" | null) {
    const cells = buildMonthGrid(year, month);
    return (
      <div className="flex-1">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            className={`rounded p-1 text-slate-500 hover:bg-slate-100 ${edge === "prev" ? "" : "invisible"}`}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-slate-800">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            className={`rounded p-1 text-slate-500 hover:bg-slate-100 ${edge === "next" ? "" : "invisible"}`}
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
          {cells.map((day, idx) => {
            const inCurrentMonth = day.getMonth() === month;
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
                      ? "bg-indigo-600 font-medium text-white"
                      : "text-slate-700 hover:bg-indigo-100"
                  }`}
                >
                  {day.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const nextMonth0 = (viewDate.getMonth() + 1) % 12;
  const nextYear = viewDate.getMonth() === 11 ? viewDate.getFullYear() + 1 : viewDate.getFullYear();

  return (
    <div>
      <label className="mb-1 block text-sm text-slate-600">Created On</label>
      <input
        readOnly
        value={`${formatSlash(value.start)} - ${formatSlash(value.end)}`}
        className="mb-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
      />

      <div className="flex gap-8">
        {renderMonth(viewDate.getFullYear(), viewDate.getMonth(), "prev")}
        {renderMonth(nextYear, nextMonth0, "next")}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-500">
          {value.start && value.end ? `${formatSlash(value.start)} - ${formatSlash(value.end)}` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange({ start: null, end: null });
            setHoverDate(null);
          }}
          className="font-medium text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
