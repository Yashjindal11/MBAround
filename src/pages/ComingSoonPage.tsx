import { Link } from 'react-router-dom';

/**
 * Placeholder for routes that are scaffolded but not yet built out.
 * Honest about being incomplete rather than showing fake content.
 */
export default function ComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg text-center">
        <p className="label-caps">In progress</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{description}</p>
        <Link to="/" className="btn-secondary mt-6">
          Back to home
        </Link>
      </div>
    </div>
  );
}
