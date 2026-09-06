/**
 * Slug generation for schools and programmes.
 *
 * Must satisfy the `schools_slug_format` DB constraint:
 * lowercase alphanumeric groups separated by single hyphens.
 */

/** Common diacritics → ASCII, so "São Paulo" → "sao-paulo". */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    // strip combining marks
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ØøŁł]/g, (c) => ({ Ø: 'O', ø: 'o', Ł: 'L', ł: 'l' })[c] ?? c)
    .replace(/[&]/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * Produce a slug that does not collide with `existing`.
 * Appends -2, -3, … as needed.
 */
export function uniqueSlug(input: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const base = slugify(input);
  if (!base) throw new Error(`Cannot derive a slug from "${input}"`);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Unable to find a unique slug for "${input}"`);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
