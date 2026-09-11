import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <article className="prose-page">
      <p className="eyebrow">Privacy</p>
      <h1>Your data, under your control</h1>
      <p>
        Local ATS analysis runs in your browser. Guest resume documents and privacy-safe analysis summaries are stored
        in IndexedDB on this device. They are never uploaded unless you explicitly choose to import guest resumes into a
        signed-in account.
      </p>
      <h2>Where information stays</h2>
      <ul>
        <li>
          <strong>Local only:</strong> Guest resumes, job targets, applications, profile details, Content Library items,
          and Analytics stay in this browser. Clearing site data can remove them; use{" "}
          <Link to="/backup-recovery">Backup &amp; recovery</Link> first.
        </li>
        <li>
          <strong>External AI provider:</strong> An AI action sends only its bounded, selected context after you give
          consent. AI responses are transient and depend on provider availability.
        </li>
        <li>
          <strong>External job source:</strong> Job Discovery sends bounded search filters to its configured source; it
          does not send resume, application, or profile content.
        </li>
        <li>
          <strong>Assisted Apply:</strong> the unpublished browser extension detects fields locally and requires your
          review before filling. It does not upload page content or submit applications.
        </li>
      </ul>
      <h2>AI Rewrite</h2>
      <p>
        AI Rewrite is optional and requires unchecked, per-use consent. It sends only the selected bullet, target role,
        a limited relevant job-description excerpt, and context you explicitly approve to Groq through a same-origin
        Netlify Function. The complete resume is not sent. Provider retention depends on the site owner&apos;s
        configured Groq terms; RecruitOS AI does not claim zero data retention.
      </p>
      <h2>Accounts</h2>
      <p>
        Signed-in account records are stored in Supabase and protected by row-level security. Server credentials are
        never included in the browser bundle. You can request an export or account deletion from Settings.
      </p>
      <h2>Analytics</h2>
      <p>Analytics is descriptive and browser-local. No external analytics or tracking service is enabled.</p>
      <h2>Backups and accounts</h2>
      <p>
        Guest Mode is the production launch path and does not provide cross-device sync or recovery for browser-local
        data. Download a workspace backup regularly. Signed-in account storage is separate and is used only when account
        features are explicitly enabled.
      </p>
      <p>Local ATS scoring remains available without AI or an account.</p>
    </article>
  );
}
