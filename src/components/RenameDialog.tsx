import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

const MAX_TITLE_LENGTH = 120;

export function RenameDialog({
  open,
  currentName,
  returnFocus,
  onSave,
  onCancel,
}: {
  open: boolean;
  currentName: string;
  returnFocus: HTMLButtonElement | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [validationError, setValidationError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (open) {
      wasOpen.current = true;
      returnFocusRef.current = returnFocus;
      setName(currentName);
      setValidationError("");
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      returnFocusRef.current?.focus();
    }
  }, [currentName, open, returnFocus]);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("Enter a resume name.");
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      setValidationError(`Use ${MAX_TITLE_LENGTH} characters or fewer.`);
      inputRef.current?.focus();
      return;
    }
    onSave(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled])") ?? [],
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="dialog rename-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
        aria-describedby="rename-dialog-help"
        onKeyDown={handleKeyDown}
      >
        <h2 id="rename-dialog-title">Rename resume</h2>
        <p id="rename-dialog-help">Choose a clear name for this resume.</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="resume-name">Resume name</label>
          <input
            ref={inputRef}
            id="resume-name"
            value={name}
            maxLength={MAX_TITLE_LENGTH + 1}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? "resume-name-error" : "rename-dialog-help"}
            onChange={(event) => {
              setName(event.target.value);
              if (validationError) setValidationError("");
            }}
          />
          <p id="resume-name-error" className="field-error" role="alert" aria-live="assertive">
            {validationError}
          </p>
          <div className="dialog-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
