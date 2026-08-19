import { useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h2 id="dialog-title">{title}</h2>
        <div>{children}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button className={destructive ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
