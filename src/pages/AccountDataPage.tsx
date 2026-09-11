import { useCallback, useEffect, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { supabase } from "../lib/supabase";

type Job = {
  id: string;
  operation: "export" | "delete";
  status: string;
  created_at: string;
  completed_at?: string;
  download_url?: string;
};
const DEFAULT_ACCOUNT_ERROR = "Account data request could not be completed. Please try again.";
const ACCOUNT_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in again.",
  SERVICE_NOT_CONFIGURED: "Account operations are unavailable.",
  DATA_SERVICE_ERROR: "Account data is temporarily unavailable.",
  INVALID_REQUEST: "Please check the request and try again.",
  REAUTH_REQUIRED: "Sign in again before requesting account deletion.",
};

export function safeAccountErrorMessage(payload: unknown) {
  const code =
    payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string" ? payload.code : "";
  return ACCOUNT_ERROR_MESSAGES[code] || DEFAULT_ACCOUNT_ERROR;
}

export function AccountDataPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const token = useCallback(async () => {
    const { data } = await supabase!.auth.getSession();
    return data.session?.access_token;
  }, []);
  const load = useCallback(async () => {
    try {
      const accessToken = await token();
      if (!accessToken) {
        setError(true);
        setMessage("Please sign in again.");
        return;
      }
      const response = await fetch("/.netlify/functions/account-data", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json();
      if (response.ok) setJobs(payload.jobs || []);
      else {
        setError(true);
        setMessage(safeAccountErrorMessage(payload));
      }
    } catch {
      setError(true);
      setMessage(DEFAULT_ACCOUNT_ERROR);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);
  async function request(operation: "export" | "delete") {
    setBusy(true);
    setError(false);
    try {
      const accessToken = await token();
      if (!accessToken) {
        setError(true);
        setMessage("Please sign in again.");
        return;
      }
      const response = await fetch("/.netlify/functions/account-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ operation, confirmation: operation === "delete" ? confirm : undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(safeAccountErrorMessage(payload));
        return;
      }
      setMessage(
        operation === "export"
          ? "Export request created. Refresh this page to check status."
          : "Deletion request created. You will be signed out when processing completes.",
      );
      setConfirm("");
      await load();
    } catch {
      setError(true);
      setMessage(DEFAULT_ACCOUNT_ERROR);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-page">
      <header className="page-heading">
        <p className="eyebrow">Account controls</p>
        <h1>Export or delete account data</h1>
        <p>
          These operations run server-side and require your current authenticated session. A recent sign-in is required
          for account deletion.
        </p>
      </header>
      <StatusMessage message={message} error={error} />
      <section>
        <h2>Personal data export</h2>
        <p>
          Create a tracked export request. Download generation remains pending until the secure processor is configured;
          the interface does not claim a file exists before it does.
        </p>
        <button disabled={busy} onClick={() => void request("export")}>
          Request data export
        </button>
      </section>
      <section className="danger-zone">
        <h2>Delete account</h2>
        <p>
          This schedules deletion of account-owned data. Enter <strong>DELETE MY ACCOUNT</strong> to confirm.
        </p>
        <label>
          Confirmation
          <input value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        <button
          className="danger"
          disabled={busy || confirm !== "DELETE MY ACCOUNT"}
          onClick={() => void request("delete")}
        >
          Request account deletion
        </button>
      </section>
      <section>
        <h2>Request status</h2>
        {jobs.length ? (
          <table>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.operation}</td>
                  <td>{job.status}</td>
                  <td>{new Date(job.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No requests yet.</p>
        )}
      </section>
    </section>
  );
}
