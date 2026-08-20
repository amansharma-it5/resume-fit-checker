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
      <h2>AI Rewrite</h2>
      <p>
        AI Rewrite is optional and requires unchecked, per-use consent. It sends only the selected bullet, target role,
        a limited relevant job-description excerpt, and context you explicitly approve to Groq through a same-origin
        Netlify Function. The complete resume is not sent. Provider retention depends on the site owner&apos;s
        configured Groq terms; Resume Lab does not claim zero data retention.
      </p>
      <h2>Accounts</h2>
      <p>
        Signed-in account records are stored in Supabase and protected by row-level security. Server credentials are
        never included in the browser bundle. You can request an export or account deletion from Settings.
      </p>
      <h2>Analytics</h2>
      <p>No external analytics or tracking service is enabled in this phase.</p>
    </article>
  );
}
