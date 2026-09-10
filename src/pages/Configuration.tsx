import { DEFAULT_VISIBLE_WIDGETS, WIDGET_CATALOG, type WidgetKey, type WidgetTier } from "./dashboard/widgetCatalog";

interface ConfigurationProps {
  visibleWidgets: Set<WidgetKey>;
  onChange: (next: Set<WidgetKey>) => void;
}

// Human-friendly group headers for the checklist — purely presentational,
// doesn't affect how Dashboard.tsx lays anything out (that's driven by
// WidgetDef.tier in widgetCatalog.tsx, not this label). "tall" covers both
// the donut/bar charts and the two approval-queue tables — they're grouped
// together on the dashboard because they render at the same height, not
// because they're the same kind of thing, so the checklist gives them a
// label that says so rather than calling them all "Charts".
const TIER_LABELS: Record<WidgetTier, string> = {
  tall: "Charts & Approval Queues",
  short: "Stat Tiles",
  full: "Tables & Full-width Reports",
};

const TIER_GROUP_ORDER: WidgetTier[] = ["tall", "short", "full"];

function toggle(set: Set<WidgetKey>, key: WidgetKey): Set<WidgetKey> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export default function Configuration({ visibleWidgets, onChange }: ConfigurationProps) {
  const groups = TIER_GROUP_ORDER.map((tier) => ({
    label: TIER_LABELS[tier],
    items: WIDGET_CATALOG.filter((w) => w.tier === tier),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Configuration</h1>
          <p className="text-xs text-slate-500">Choose which widgets appear on the Dashboard</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <button type="button" onClick={() => onChange(new Set(DEFAULT_VISIBLE_WIDGETS))} className="text-indigo-600 hover:text-indigo-800">
            Select all
          </button>
          <button type="button" onClick={() => onChange(new Set())} className="text-slate-500 hover:text-slate-700">
            Clear all
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-xs text-slate-400">
          {visibleWidgets.size} of {WIDGET_CATALOG.length} widgets shown. Changes apply to the Dashboard immediately.
        </p>
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{group.label}</h3>
              <div className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-100">
                {group.items.map((w) => (
                  <label
                    key={w.key}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={visibleWidgets.has(w.key)}
                      onChange={() => onChange(toggle(visibleWidgets, w.key))}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    {w.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
