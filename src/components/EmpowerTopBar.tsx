import { CURRENT_USER_EMAIL, deriveCreatedByName } from "../utils";

// Static shell top bar — OMS is being slotted in as a new tab of a larger
// "Empower" webapp (per the reference screenshot). Every tab except OMS is
// inert (nothing built behind them in this prototype); the dropdowns on the
// right are decorative only, matching the screenshot, not wired to anything.
const INACTIVE_TABS = ["Debtors & CashFlow", "Budget & MIS", "Setting & Tools", "Pipeline Management", "Finance"];

function LogoIcon() {
  return (
    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 2a5 5 0 00-5 5c0 1.6.73 3.02 1.88 3.96L6.5 15h7l-.38-4.04A5 5 0 0015 7a5 5 0 00-5-5zm-2 13.5h4L11.6 18a1 1 0 01-.9.5h-1.4a1 1 0 01-.9-.5l-.4-2.5z"
        clipRule="evenodd"
      />
      <circle cx="8" cy="7" r="1" />
      <circle cx="12" cy="7" r="1" />
    </svg>
  );
}

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

function DecorativeDropdown({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
      {label}
      <ChevronDownIcon />
    </div>
  );
}

export default function EmpowerTopBar() {
  const displayName = deriveCreatedByName(CURRENT_USER_EMAIL);
  const initial = displayName.charAt(0).toUpperCase();
  const truncatedName = `${displayName.split(" ")[0].toLowerCase()}...`;

  return (
    <div className="shrink-0">
      <div className="h-1 bg-slate-950" />
      <div className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900">
              <LogoIcon />
            </span>
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
              className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white"
            >
              OMS
            </button>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <DecorativeDropdown label="Lakhs" />
          <DecorativeDropdown label="This Month" />
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
