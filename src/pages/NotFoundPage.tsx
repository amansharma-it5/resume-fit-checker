import { Link } from "react-router-dom";
export function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">404</p>
      <h1>That page is not in the lab</h1>
      <p>The address may be outdated or mistyped.</p>
      <Link className="button-link" to="/">
        Return to Resume Lab
      </Link>
    </section>
  );
}
