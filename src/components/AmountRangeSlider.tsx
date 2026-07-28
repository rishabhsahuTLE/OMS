interface AmountRangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  onChange: (min: number, max: number) => void;
}

function formatLakhLabel(value: number, max: number, isUpper: boolean) {
  if (isUpper && value >= max) return `>${max}L`;
  if (!isUpper && value <= 0) return "<1L";
  return `₹${value}L`;
}

// Two overlapping <input type="range"> thumbs sharing one visual track —
// see the `.dual-range-input` rules in index.css for the thumb-only hit area.
export default function AmountRangeSlider({ min, max, minValue, maxValue, onChange }: AmountRangeSliderProps) {
  const span = max - min || 1;
  const minPct = ((minValue - min) / span) * 100;
  const maxPct = ((maxValue - min) / span) * 100;

  return (
    <div>
      <div className="relative h-4">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-indigo-500"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={minValue}
          onChange={(e) => onChange(Math.min(Number(e.target.value), maxValue), maxValue)}
          className="dual-range-input z-10"
          aria-label="Minimum amount (lakhs)"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxValue}
          onChange={(e) => onChange(minValue, Math.max(Number(e.target.value), minValue))}
          className="dual-range-input z-20"
          aria-label="Maximum amount (lakhs)"
        />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-slate-500">
        <span>{formatLakhLabel(minValue, max, false)}</span>
        <span>{formatLakhLabel(maxValue, max, true)}</span>
      </div>
    </div>
  );
}
