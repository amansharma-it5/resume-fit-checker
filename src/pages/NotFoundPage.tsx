import { Link } from "react-router-dom";
export function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">404</p>
      <h1>That page is unavailable</h1>
      <p>The address may be outdated or mistyped.</p>
      <Link className="button-link" to="/">
        Return to RecruitOS AI
      </Link>
    </section>
  );
}
