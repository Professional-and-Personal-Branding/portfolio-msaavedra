/** Entrada del sitemap: URL absoluta y su última modificación. */
export interface SitemapEntry {
  path: string;
  lastModified?: Date;
}

/** Perfil tal como lo necesita el sitemap (spec `public-seo`). */
export interface SitemapProfile {
  slug: string;
  visibility: string;
  updatedAt?: Date;
}

const HOME_SLUG = 'all';

/** Solo los perfiles públicos entran; el resto no debe ni insinuarse. */
export function toSitemapEntries(profiles: readonly SitemapProfile[]): SitemapEntry[] {
  const publicos = profiles.filter((profile) => profile.visibility === 'PUBLIC');
  const home = publicos.find((profile) => profile.slug === HOME_SLUG);

  return [
    { path: '/', lastModified: home?.updatedAt },
    ...publicos
      .filter((profile) => profile.slug !== HOME_SLUG)
      .map((profile) => ({ path: `/${profile.slug}`, lastModified: profile.updatedAt })),
  ];
}

/** XML del sitemap con URLs absolutas sobre `baseUrl`. */
export function buildSitemapXml(baseUrl: string, entries: readonly SitemapEntry[]): string {
  const origin = baseUrl.replace(/\/+$/, '');
  const urls = entries
    .map((entry) => {
      const loc = escapeXml(`${origin}${entry.path}`);
      const lastmod = entry.lastModified
        ? `\n    <lastmod>${entry.lastModified.toISOString().slice(0, 10)}</lastmod>`
        : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** `robots.txt`: la vista pública se indexa, el backoffice no. */
export function buildRobotsTxt(baseUrl: string): string {
  const origin = baseUrl.replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
