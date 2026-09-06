import { Link } from 'react-router-dom';
import { useSeo } from '../lib/seo';
import { breadcrumbSchema } from '../lib/structuredData';

/**
 * The shared shell owns metadata so a new static page cannot ship without it.
 * Each caller passes the `path` and `description` it is served at; deriving
 * them from the URL would silently give every page the same description.
 */
function Page({
  title,
  path,
  description,
  children,
}: {
  title: string;
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  useSeo({
    title,
    description,
    path,
    jsonLd: [
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: title, path },
      ]),
    ],
  });

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-600">{children}</div>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <Page
      title="About MBAround"
      path="/about"
      description="MBAround helps applicants find MBA programmes and plan around application rounds, with every deadline traced back to the school's own admissions page."
    >
      <p>
        MBAround is a structured reference for MBA programmes and their application
        rounds. The goal is narrow and deliberate: make it fast to find out when a
        programme&rsquo;s deadlines are, and where that information came from.
      </p>
      <p>
        <strong className="text-ink-900">MBAround does not publish its own ranking.</strong>{' '}
        Where ranking information appears, it is attributed to the organisation that
        produced it. Our directory order is for browsing convenience, not merit.
      </p>
      <p>
        Every deadline is either traced to an official school page or clearly marked
        as unverified or unannounced. We would rather show a gap than a guess.
      </p>
      <p>
        <Link to="/suggest" className="text-accent-700 underline underline-offset-2">
          Spotted an error? Suggest a correction →
        </Link>
      </p>
    </Page>
  );
}

export function DataSourcesPage() {
  return (
    <Page
      title="Data sources"
      path="/data-sources"
      description="How MBAround sources MBA deadlines: official school admissions pages only, each round stored with its source URL, and no estimated or carried-forward dates."
    >
      <h2 className="font-display text-lg font-semibold text-ink-900">
        Canonical deadline data
      </h2>
      <p>
        Application deadlines and decision dates come from the school&rsquo;s own
        admissions website. Each round stores the source URL and the date it was last
        checked, both shown on the deadline record.
      </p>

      <h2 className="pt-2 font-display text-lg font-semibold text-ink-900">
        What we do not use as canonical sources
      </h2>
      <p>
        Forums, blogs, admissions consultancies, MBA aggregators and third-party
        databases are not treated as authoritative. They may help us discover that a
        date has changed, but a change is only recorded once confirmed on the
        school&rsquo;s official page.
      </p>

      <h2 className="pt-2 font-display text-lg font-semibold text-ink-900">
        Rankings
      </h2>
      <p>
        Recognised rankings — such as those published by the Financial Times, QS,
        Bloomberg Businessweek and U.S. News — were used only to decide which schools
        to include initially. They are not combined into a score, and MBAround does
        not produce a ranking of its own.
      </p>

      <h2 className="pt-2 font-display text-lg font-semibold text-ink-900">
        How to read the badges
      </h2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li><strong className="text-ink-900">Verified</strong> — confirmed against an official source, with the date recorded.</li>
        <li><strong className="text-ink-900">Needs review</strong> — a date exists but has not been confidently confirmed.</li>
        <li><strong className="text-ink-900">Not announced</strong> — the school has not yet published this date.</li>
        <li><strong className="text-ink-900">Unavailable</strong> — we could not locate the information.</li>
      </ul>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page
      title="Privacy"
      path="/privacy"
      description="MBAround's privacy approach: what the site stores, what it does not collect, and how suggestion submissions are handled."
    >
      <p>
        MBAround does not require an account to browse. We do not sell personal data.
      </p>
      <p>
        If you submit a correction you may optionally include an email address. It is
        used only to follow up on that submission.
      </p>
      <p>
        Administrator accounts authenticate through Supabase Auth. Access to the
        content-management interface is granted per user and enforced by the database.
      </p>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page
      title="Terms"
      path="/terms"
      description="Terms of use for MBAround, including the limits of the deadline data published here and why applicants should always confirm with the school."
    >
      <p>
        MBAround is an independent reference tool and is not affiliated with,
        endorsed by, or partnered with any school listed.
      </p>
      <p>
        We work to keep deadline information accurate, but admissions dates change.
        <strong className="text-ink-900">
          {' '}Always confirm on the school&rsquo;s official admissions page before
          relying on a date.
        </strong>{' '}
        Each record links to its official source for exactly this reason.
      </p>
      <p>
        School names and trademarks belong to their respective institutions.
      </p>
    </Page>
  );
}
