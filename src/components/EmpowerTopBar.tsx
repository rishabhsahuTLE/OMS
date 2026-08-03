import { CURRENT_USER_EMAIL, deriveCreatedByName } from "../utils";

// Static shell top bar — OMS is being slotted in as a new tab of a larger
// "Empower" webapp (per the reference screenshot). Every tab except OMS is
// inert (nothing built behind them in this prototype); the dropdowns on the
// right are decorative only, matching the screenshot, not wired to anything.
const INACTIVE_TABS = ["Debtors & CashFlow", "Budget & MIS", "Setting & Tools", "Pipeline Management", "Finance"];

function ChevronDownIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        d="M9.1 9a3 3 0 015.8 1c0 2-3 2.25-3 4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a1 1 0 011 1v.6a5 5 0 014 4.9v3.2l1.3 2a1 1 0 01-.84 1.3H4.54a1 1 0 01-.84-1.3l1.3-2V8.5a5 5 0 014-4.9V3a1 1 0 011-1zm0 15.5a1.8 1.8 0 001.8-1.5h-3.6A1.8 1.8 0 0010 17.5z" />
    </svg>
  );
}

export default function EmpowerTopBar() {
  const displayName = deriveCreatedByName(CURRENT_USER_EMAIL);
  const initial = displayName.charAt(0).toUpperCase();
  const truncatedName = `${displayName.split(" ")[0].toLowerCase()}...`;

  return (
    <div className="shrink-0">
      <div className="h-1 bg-indigo-950" />
      <div className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/empower-icon-black.png" alt="Empower" className="h-9 w-9 object-contain" />
            <span className="text-xl font-bold text-slate-900">Empower</span>
          </div>

          <nav className="flex items-center gap-2">
            {INACTIVE_TABS.map((label) => (
              <button
                key={label}
                type="button"
                disabled
                title="Not part of this prototype"
                className="cursor-not-allowed rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-400"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full bg-indigo-900 px-4 py-1.5 text-sm font-semibold text-white"
            >
              OMS
            </button>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button type="button" className="text-slate-500 hover:text-slate-700" aria-label="Help">
            <HelpIcon />
          </button>
          <button type="button" className="text-slate-500 hover:text-slate-700" aria-label="Notifications">
            <BellIcon />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
              {initial}
            </span>
            <span className="text-sm text-slate-600">{truncatedName}</span>
            <ChevronDownIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
