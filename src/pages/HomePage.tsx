import { Link } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import {
  getFeaturedSchools,
  getFilterFacets,
  getRegionCounts,
  getUpcomingDeadlines,
} from '../lib/queries/public';
import { DeadlineCard, SchoolCard } from '../components/Cards';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useSeo } from '../lib/seo';
import { organizationSchema, websiteSchema, faqSchema } from '../lib/structuredData';

/**
 * Module-level constant so the array identity is stable; useSeo depends on it,
 * and rebuilding it each render would rewrite every meta tag on every render.
 *
 * The FAQ answers below are the same claims the page and /data-sources make.
 * Google requires FAQ markup to match visible content, and asserting sourcing
 * guarantees in metadata that the site does not honour would be worse than
 * having no markup at all.
 */
const HOME_JSONLD = [
  organizationSchema(),
  websiteSchema(),
  faqSchema([
    {
      question: 'Where do MBAround deadlines come from?',
      answer:
        "Every deadline is read from the school's own admissions page and stored with a link to that source. MBAround does not use forums, aggregators or last year's dates.",
    },
    {
      question: 'What happens when a school has not announced its dates?',
      answer:
        'The round is shown as not yet announced with no date attached. MBAround never estimates or carries forward a previous cycle’s deadline.',
    },
    {
      question: 'Do all business schools use three application rounds?',
      answer:
        'No. Some run three rounds, others four, and others admit on a rolling basis. MBAround renders whatever structure each school actually publishes.',
    },
  ]),
];

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        <p className="label-caps">{eyebrow}</p>
        <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          className="text-sm font-medium text-ink-600 underline decoration-ink-300 underline-offset-4 transition-colors hover:text-accent-700"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-ink-200/70">
      {/* Subtle concentric "rounds" motif — echoes the product idea. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] opacity-[0.18]"
      >
        {[1, 2, 3, 4, 5].map((r) => (
          <div
            key={r}
            className="absolute rounded-full border border-ink-400"
            style={{ inset: `${r * 2.6}rem` }}
          />
        ))}
      </div>

      <div className="container-page relative py-20 sm:py-28">
        <div className="max-w-2xl animate-fade-up">
          <p className="label-caps">MBA discovery &amp; planning</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-6xl">
            Your MBA journey,
            <br />
            <span className="text-accent-700">around every round.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-600 sm:text-lg">
            Find MBA programmes. Understand application rounds. Plan what&rsquo;s
            next — with deadlines traced back to each school&rsquo;s official
            admissions page.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/deadlines" className="btn-primary">
              Explore deadlines
            </Link>
            <Link to="/schools" className="btn-secondary">
              Explore schools
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function UpcomingDeadlines() {
  const { data, loading, error, reload } = useAsync(() => getUpcomingDeadlines(6), []);

  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="What's next"
        title="Upcoming deadlines"
        description="The next announced application deadlines across every programme in the database."
        action={{ to: '/deadlines', label: 'All deadlines' }}
      />
      {loading && <LoadingState rows={3} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No upcoming deadlines"
          description="No school in the database has an announced deadline in the future yet."
        />
      )}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((row) => (
            <DeadlineCard key={row.roundId} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturedSchools() {
  const { data, loading, error, reload } = useAsync(() => getFeaturedSchools(6), []);

  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="Explore"
        title="Schools to start with"
        description="Curated from the database — editors control which schools are featured and in what order."
        action={{ to: '/schools', label: 'All schools' }}
      />
      {loading && <LoadingState rows={2} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState title="No featured schools yet" description="Mark schools as featured in the admin panel." />
      )}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <SchoolCard key={s.id} school={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function Regions() {
  const { data } = useAsync(() => getRegionCounts(), []);
  if (!data || data.length === 0) return null;

  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="By location"
        title="Explore by region"
        description="Regions are derived from the schools in the database — add a school anywhere and its region appears here."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((r) => (
          <Link
            key={r.region}
            to={`/schools?region=${encodeURIComponent(r.region)}`}
            className="surface flex items-center justify-between px-5 py-4 transition-colors hover:border-accent-300 hover:bg-accent-50/40"
          >
            <span className="font-medium text-ink-900">{r.region}</span>
            <span className="text-sm text-ink-500">{r.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Rounds() {
  const { data } = useAsync(() => getFilterFacets(), []);
  const rounds = data?.roundNames ?? [];
  if (rounds.length === 0) return null;

  return (
    <section className="border-y border-ink-200/70 bg-white py-16">
      <div className="container-page">
        <SectionHeader
          eyebrow="How it works"
          title="Application rounds"
          description="Schools structure their intake differently — some run three rounds, others four, others admit on a rolling basis. MBAround renders whatever each school actually publishes."
        />
        <div className="flex flex-wrap gap-2">
          {rounds.map((name) => (
            <Link
              key={name}
              to={`/deadlines?round=${encodeURIComponent(name)}`}
              className="rounded-full border border-ink-200 bg-sand px-4 py-2 text-sm text-ink-700 transition-colors hover:border-accent-300 hover:text-accent-700"
            >
              {name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  useSeo({
    title: 'MBA Deadlines & Application Rounds, Sourced From Schools',
    description:
      'Track MBA application deadlines and rounds across top business schools worldwide. Every date links to the official admissions page it came from — nothing is estimated.',
    path: '/',
    jsonLd: HOME_JSONLD,
  });

  return (
    <>
      <Hero />
      <UpcomingDeadlines />
      <FeaturedSchools />
      <Regions />
      <Rounds />
    </>
  );
}
