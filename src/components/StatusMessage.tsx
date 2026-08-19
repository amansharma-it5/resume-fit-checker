export function StatusMessage({ message, error = false }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return (
    <p
      className={error ? "status-message error" : "status-message"}
      role={error ? "alert" : "status"}
      aria-live="polite"
    >
      {message}
    </p>
  );
}
