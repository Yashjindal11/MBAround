import type { DeadlineRow, School } from './types';
import { absoluteUrl } from './seo';

/**
 * JSON-LD builders.
 *
 * The governing rule: structured data must not assert anything the page does
 * not show, and must not assert dates we have not sourced. Google penalises
 * mismatches, but more importantly an unannounced round emitted as a concrete
 * EducationalOccupationalProgram start date would launder a null into a fact -
 * exactly what this product exists to prevent. Undated rounds are therefore
 * omitted from JSON-LD entirely rather than given a placeholder.
 */

const ORG_ID = () => `${absoluteUrl('/')}#organization`;

export function organizationSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID(),
    name: 'MBAround',
    url: absoluteUrl('/'),
    description:
      'MBA discovery and application planning. Deadlines sourced from official school admissions pages.',
  };
}

export function websiteSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name: 'MBAround',
    url: absoluteUrl('/'),
    publisher: { '@id': ORG_ID() },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/schools')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Breadcrumbs are the highest-yield structured data here: they replace the
 * naked URL in search results with a readable trail.
 */
export function breadcrumbSchema(
  crumbs: { name: string; path: string }[],
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/**
 * A school is a CollegeOrUniversity. Only fields we actually hold are emitted;
 * absent values are omitted rather than guessed, so no empty strings ship.
 */
export function schoolSchema(school: School, rounds: DeadlineRow[] = []): object {
  const addressParts: Record<string, string> = {};
  if (school.city) addressParts.addressLocality = school.city;
  if (school.state) addressParts.addressRegion = school.state;
  if (school.country) addressParts.addressCountry = school.country;

  // Only rounds with a real, announced deadline become programme offerings.
  const programs = rounds
    .filter((r) => r.isAnnounced && r.deadline)
    .map((r) => ({
      '@type': 'EducationalOccupationalProgram',
      name: r.programName,
      programType: r.programType,      provider: { '@type': 'CollegeOrUniversity', name: school.name },
      applicationDeadline: r.deadline,
    }));

  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    '@id': absoluteUrl(`/schools/${school.slug}`) + '#school',
    name: school.name,
    url: absoluteUrl(`/schools/${school.slug}`),
  };

  if (school.shortName) node.alternateName = school.shortName;
  if (school.description) node.description = school.description;
  if (school.websiteUrl) node.sameAs = [school.websiteUrl];
  if (school.logoUrl) node.logo = school.logoUrl;  if (Object.keys(addressParts).length) {
    node.address = { '@type': 'PostalAddress', ...addressParts };
  }
  if (programs.length) node.offers = programs;

  return node;
}

/**
 * FAQ markup can win an expanded result, but only for questions genuinely
 * answered on the page. Callers pass real on-page copy; nothing is generated.
 */
export function faqSchema(qa: { question: string; answer: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map((x) => ({
      '@type': 'Question',
      name: x.question,
      acceptedAnswer: { '@type': 'Answer', text: x.answer },
    })),
  };
}

/** An ordered list of schools, for /schools and /deadlines. */
export function itemListSchema(
  items: { name: string; path: string }[],
  listName: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.path),
    })),
  };
}
