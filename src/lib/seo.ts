import { useEffect } from 'react';

/**
 * Document metadata for a client-rendered SPA.
 *
 * No react-helmet: this needs ~80 lines, and a dependency that mutates the
 * same DOM nodes would only add a second source of truth for the same tags.
 *
 * Every tag written here is marked data-seo="1" and the whole set is cleared on
 * navigation. Without that, tags from a previous route linger - the classic SPA
 * bug where a crawler sees the homepage's canonical URL on a school page and
 * silently drops the page from the index.
 *
 * These tags are set client-side. Google renders JavaScript and will see them;
 * most social scrapers (Slack, WhatsApp, LinkedIn) do NOT, and will fall back
 * to the static tags in index.html. That is a deliberate, documented limit -
 * see docs/SEO.md. Fixing it properly needs prerendering, not a bigger client.
 */

export interface SeoInput {
  title: string;
  description: string;
  /** Path only, e.g. "/schools/insead". Origin is added from VITE_SITE_URL. */
  path: string;
  /** Defaults to "website"; school pages use "article". */
  type?: 'website' | 'article';
  /** Absolute or root-relative image URL for social cards. */
  image?: string;
  /**
   * Set when a page must not be indexed - thin, duplicated, or filter-permuted
   * views. Crawl budget spent on `?country=France&sort=latest` is crawl budget
   * not spent on the school pages that actually rank.
   */
  noindex?: boolean;
  /** JSON-LD objects. Emitted as separate <script> tags. */
  jsonLd?: object[];
}

const SITE_NAME = 'MBAround';
const MARK = 'data-seo';

export function siteOrigin(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://mbaround.com';
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Titles are capped near 60 characters, where Google truncates. The suffix is
 * dropped rather than the page's own words, since "MBAround" is the least
 * informative part of any title.
 */
export function formatTitle(title: string): string {
  const full = `${title} | ${SITE_NAME}`;
  return full.length <= 60 ? full : title.slice(0, 60);
}

/** Descriptions are capped near the ~155 chars Google shows, cut on a word. */
export function clampDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, '')}…`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  el.setAttribute(MARK, '1');
  document.head.appendChild(el);
}

function clearManagedTags() {
  document.head.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());
}

export function applySeo(input: SeoInput) {
  const {
    title,
    description,
    path,
    type = 'website',
    image,
    noindex = false,
    jsonLd = [],
  } = input;

  clearManagedTags();

  const url = absoluteUrl(path);
  const desc = clampDescription(description);
  document.title = formatTitle(title);

  upsertMeta('name', 'description', desc);

  // Self-referencing canonical. Filter state lives in the query string, so the
  // canonical intentionally omits it: every filter permutation of /deadlines is
  // the same page, and without this they compete with each other.
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = url;
  canonical.setAttribute(MARK, '1');
  document.head.appendChild(canonical);

  if (noindex) {
    // "follow" on purpose: the page should not rank, but crawlers should still
    // traverse its links to the school pages that should.
    upsertMeta('name', 'robots', 'noindex, follow');
  } else {
    upsertMeta('name', 'robots', 'index, follow, max-image-preview:large');
  }

  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', desc);
  if (image) {
    upsertMeta('property', 'og:image', absoluteUrl(image));
    upsertMeta('name', 'twitter:image', absoluteUrl(image));
  }

  for (const block of jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(MARK, '1');
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  }
}

/** Declarative wrapper. Callers should memoise `jsonLd` to avoid re-running. */
export function useSeo(input: SeoInput) {
  const { title, description, path, type, image, noindex, jsonLd } = input;
  useEffect(() => {
    applySeo({ title, description, path, type, image, noindex, jsonLd });
  }, [title, description, path, type, image, noindex, jsonLd]);
}
