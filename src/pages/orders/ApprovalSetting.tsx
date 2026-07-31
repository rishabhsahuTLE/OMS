import { useMemo, useState } from "react";
import Modal from "../../components/Modal";
import { DEPARTMENTS } from "../../types";
import type { ApprovalSettingRow } from "../../types";
import { mockApprovalSettings } from "../../data/mockApprovalSettings";
import FilterDrawer, { type FilterDrawerCategory } from "../../components/FilterDrawer";
import PaginationFooter from "../../components/PaginationFooter";
import SortArrow from "../../components/SortArrow";
import { toggleSortState, usePagination, type SortState } from "../../utils";

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

type SortableKey = "approver" | "department" | "status";

function compareByKey(a: ApprovalSettingRow, b: ApprovalSettingRow, key: SortableKey): number {
  switch (key) {
    case "approver":
      return a.approver.localeCompare(b.approver);
    case "department":
      return a.department.localeCompare(b.department);
    case "status":
      return a.status.localeCompare(b.status);
  }
}

function SortableTh({
  label,
  sortKey,
  sort,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortableKey;
  sort: SortState<SortableKey>;
  onClick: (key: SortableKey) => void;
  align?: "left" | "center";
}) {
  return (
    <th
      className={`sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 font-semibold text-slate-600 ${
        align === "center" ? "text-center" : "text-left"
      }`}
    >
      <button
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1.5 hover:text-slate-900 ${align === "center" ? "mx-auto" : ""}`}
      >
        {label}
        <SortArrow direction={sort.key === sortKey ? sort.direction : "asc"} active={sort.key === sortKey} />
      </button>
    </th>
  );
}

const FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "department", label: "Department" },
  { key: "approver", label: "Approver" },
  { key: "status", label: "Status" },
];

interface DrawerFilters {
  department: string;
  approver: string;
  status: string;
}

const defaultDrawerFilters: DrawerFilters = { department: "all", approver: "all", status: "all" };

function UsersIcon() {
  return (
    <svg className="h-5 w-5 text-slate-700" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7 0a3 3 0 100-6 3 3 0 000 6zM1 18v-1a5 5 0 015-5h2a5 5 0 015 5v1H1zm11-6a5 5 0 015 5v1h-3v-1a6.97 6.97 0 00-1.7-4.6c.23-.26.46-.4.7-.4z" />
    </svg>
  );
}

function BoolIcon({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600">
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

interface NewRowForm {
  approver: string;
  department: string;
  technical: boolean;
  financial: boolean;
}

const emptyNewRow: NewRowForm = { approver: "", department: "", technical: false, financial: false };

export default function ApprovalSetting() {
  const [rows, setRows] = useState<ApprovalSettingRow[]>(mockApprovalSettings);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(FILTER_CATEGORIES[0].key);
  const [draft, setDraft] = useState<DrawerFilters>(defaultDrawerFilters);
  const [applied, setApplied] = useState<DrawerFilters>(defaultDrawerFilters);
  const [sort, setSort] = useState<SortState<SortableKey>>({ key: null, direction: "asc" });

  const [addOpen, setAddOpen] = useState(false);
  const [newRow, setNewRow] = useState<NewRowForm>(emptyNewRow);

  const approverOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.approver))).sort(), [rows]);

  function toggleSort(key: SortableKey) {
    setSort((prev) => toggleSortState(prev, key));
  }

  function openDrawer() {
    setDraft(applied);
    setDrawerOpen(true);
  }

  function handleApply() {
    setApplied(draft);
    setDrawerOpen(false);
    setPage(1);
  }

  function handleClear() {
    setDraft(defaultDrawerFilters);
    setApplied(defaultDrawerFilters);
    setPage(1);
  }

  const hasActiveFilters = applied.department !== "all" || applied.approver !== "all" || applied.status !== "all";

  const filtered = useMemo(() => {
    let result = rows.filter((r) => {
      if (applied.department !== "all" && r.department !== applied.department) return false;
      if (applied.approver !== "all" && r.approver !== applied.approver) return false;
      if (applied.status !== "all" && r.status !== applied.status) return false;
      return true;
    });

    if (sort.key) {
      const key = sort.key;
      result = [...result].sort((a, b) => {
        const cmp = compareByKey(a, b, key);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, applied, sort]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, totalRecords } = usePagination(filtered, 30);

  function renderCategoryContent() {
    switch (activeCategory) {
      case "department":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Department</label>
            <select
              value={draft.department}
              onChange={(e) => setDraft((prev) => ({ ...prev, department: e.target.value }))}
              className={selectClass}
            >
              <option value="all">--Select Department--</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        );
      case "approver":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Approver</label>
            <select
              value={draft.approver}
              onChange={(e) => setDraft((prev) => ({ ...prev, approver: e.target.value }))}
              className={selectClass}
            >
              <option value="all">--Select Approver--</option>
              {approverOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        );
      case "status":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Status</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              className={selectClass}
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        );
      default:
        return null;
    }
  }

  function toggleStatus(id: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: r.status === "Active" ? "Inactive" : "Active" } : r))
    );
  }

  function handleAdd() {
    if (!newRow.approver.trim() || !newRow.department) return;
    setRows((prev) => [
      {
        id: `aps-${Math.random().toString(36).slice(2, 10)}`,
        approver: newRow.approver.trim(),
        department: newRow.department,
        technical: newRow.technical,
        financial: newRow.financial,
        status: "Active",
      },
      ...prev,
    ]);
    setNewRow(emptyNewRow);
    setAddOpen(false);
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <UsersIcon />
          <h2 className="text-lg font-semibold text-slate-800">Approval Setting</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openDrawer}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="Open filters"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 01.8 1.6L12 12v4a1 1 0 01-.45.83l-2 1.34A1 1 0 018 17.3V12L3.2 4.6A1 1 0 013 4z" />
            </svg>
            {hasActiveFilters && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-indigo-500" />}
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-teal-300 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Add
          </button>
        </div>
      </div>

      <p className="px-6 py-3 text-xs text-slate-500">
        Status: <span className="mx-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Active</span>
        , <span className="mx-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Inactive</span> — click
        a status pill to toggle it.
      </p>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <SortableTh label="Approver" sortKey="approver" sort={sort} onClick={toggleSort} />
              <SortableTh label="Department" sortKey="department" sort={sort} onClick={toggleSort} />
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">Technical</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">Financial</th>
              <SortableTh label="Status" sortKey="status" sort={sort} onClick={toggleSort} align="center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="max-w-[220px] truncate px-4 py-2 font-medium text-slate-800" title={r.approver}>
                  {r.approver}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.department}</td>
                <td className="px-4 py-2 text-center">
                  <div className="flex justify-center">
                    <BoolIcon value={r.technical} />
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex justify-center">
                    <BoolIcon value={r.financial} />
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => toggleStatus(r.id)}
                    title="Click to toggle"
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      r.status === "Active"
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-rose-400 text-white hover:bg-rose-500"
                    }`}
                  >
                    {r.status}
                  </button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No approvers match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        totalRecords={totalRecords}
      />

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Approval Setting Filters"
        categories={FILTER_CATEGORIES}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onClear={handleClear}
        onApply={handleApply}
      >
        {renderCategoryContent()}
      </FilterDrawer>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} widthClassName="max-w-lg">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">ADD APPROVER</h2>
        </div>
        <div className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              Approver<span className="text-rose-500">*</span>
            </label>
            <input
              className={inputClass}
              value={newRow.approver}
              onChange={(e) => setNewRow((prev) => ({ ...prev, approver: e.target.value }))}
              placeholder="Enter approver name…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              Department<span className="text-rose-500">*</span>
            </label>
            <select
              className={inputClass}
              value={newRow.department}
              onChange={(e) => setNewRow((prev) => ({ ...prev, department: e.target.value }))}
            >
              <option value="">--Select Department--</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-8">
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={newRow.technical}
                onChange={(e) => setNewRow((prev) => ({ ...prev, technical: e.target.checked }))}
              />
              Technical approver
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={newRow.financial}
                onChange={(e) => setNewRow((prev) => ({ ...prev, financial: e.target.checked }))}
              />
              Financial approver
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={() => setAddOpen(false)}
            className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Add
          </button>
        </div>
      </Modal>
    </div>
  );
}
