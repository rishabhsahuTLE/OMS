import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} widthClassName="max-w-sm">
      <div className="flex flex-col items-center px-8 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-300 text-amber-400">
          <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v7a1 1 0 11-2 0V4a1 1 0 011-1zm0 11.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
          </svg>
        </span>
        <h2 className="mt-4 text-xl font-bold text-slate-700">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="rounded-md bg-indigo-700 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-800"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md bg-rose-400 px-5 py-2 text-sm font-medium text-white hover:bg-rose-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
