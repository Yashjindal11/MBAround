import { Link, useLocation } from 'react-router-dom';
import { useSeo } from '../lib/seo';

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
  const { pathname } = useLocation();

  // Always noindex. An empty placeholder that ranks is a thin-content page: it
  // wins a click, delivers nothing, and teaches search engines the whole site
  // is low quality. It gets indexed when it has something to say.
  useSeo({ title, description, path: pathname, noindex: true });

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
