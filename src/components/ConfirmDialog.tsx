import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-2xl font-bold text-stone-900">
          {title}
        </h2>
        {message && (
          <p className="text-lg text-stone-700 leading-relaxed">{message}</p>
        )}
        <div className="flex flex-col gap-2 mt-2">
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`min-h-[56px] text-xl font-semibold rounded-xl active:scale-[0.98] transition ${
              destructive
                ? "bg-rose-700 text-white"
                : "bg-stone-900 text-stone-50"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[56px] text-xl font-medium bg-stone-200 text-stone-900 rounded-xl active:scale-[0.98] transition"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
