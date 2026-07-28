import { useMemo, useState } from "react";
import Modal from "../../components/Modal";
import { DEPARTMENTS } from "../../types";
import type { ApprovalSettingRow } from "../../types";
import { mockApprovalSettings } from "../../data/mockApprovalSettings";

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

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

  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [approverFilter, setApproverFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appliedFilters, setAppliedFilters] = useState({ department: "all", approver: "all", status: "all" });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const [addOpen, setAddOpen] = useState(false);
  const [newRow, setNewRow] = useState<NewRowForm>(emptyNewRow);

  const approverOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.approver))).sort(), [rows]);

  function handleSearch() {
    setAppliedFilters({ department: departmentFilter, approver: approverFilter, status: statusFilter });
    setPage(1);
  }

  function handleClear() {
    setDepartmentFilter("all");
    setApproverFilter("all");
    setStatusFilter("all");
    setAppliedFilters({ department: "all", approver: "all", status: "all" });
    setPage(1);
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (appliedFilters.department !== "all" && r.department !== appliedFilters.department) return false;
      if (appliedFilters.approver !== "all" && r.approver !== appliedFilters.approver) return false;
      if (appliedFilters.status !== "all" && r.status !== appliedFilters.status) return false;
      return true;
    });
  }, [rows, appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

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
      <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
        <UsersIcon />
        <h2 className="text-lg font-semibold text-slate-800">Approval Setting</h2>
      </div>

      <div className="border-b border-slate-100 px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
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
          <div>
            <label className="mb-1 block text-sm text-slate-600">Approver</label>
            <select value={approverFilter} onChange={(e) => setApproverFilter(e.target.value)} className={selectClass}>
              <option value="all">--Select Approver--</option>
              {approverOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 rounded-md border border-teal-300 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.6 4.2l3.6 3.6a1 1 0 01-1.4 1.4l-3.6-3.6A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            Search
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
          <button
            onClick={handleClear}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
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
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Approver</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Department</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Technical</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Financial</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="max-w-[220px] truncate px-4 py-3 font-medium text-slate-800" title={r.approver}>
                  {r.approver}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.department}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center">
                    <BoolIcon value={r.technical} />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center">
                    <BoolIcon value={r.financial} />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
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

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-600">
        <span>Pages</span>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-500 text-white disabled:opacity-40"
        >
          ‹
        </button>
        <input
          value={currentPage}
          readOnly
          className="w-14 rounded-md border border-slate-300 px-2 py-1 text-center text-sm"
        />
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-500 text-white disabled:opacity-40"
        >
          ›
        </button>
        <span>of {totalPages}</span>
        <span>| View</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {[10, 30, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>records | Found total {filtered.length} records</span>
      </div>

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
