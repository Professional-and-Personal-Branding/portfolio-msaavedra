import { Locale } from '../../../../shared/domain/i18n';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { profilePath } from './profile-path';
import { isoDay } from './sitemap.builder';

/**
 * Fragmento de `<head>` por perfil (spec `public-seo`, change
 * `add-server-rendered-head`). Lo inserta el borde en el HTML inicial para que
 * las vistas previas de LinkedIn, WhatsApp o Slack, que no ejecutan JavaScript,
 * muestren el perfil. Los textos se derivan igual que en el cliente
 * (`frontend/src/shared/lib/document-meta.ts`, `metaFromProfile`): un test
 * compara los dos sobre el mismo fixture.
 */

const OG_LOCALE: Record<Locale, string> = { es: 'es_ES', en: 'en_US' };

/** Lo que se ve cuando no hay un perfil público que mostrar: el mismo fallback que `index.html`. */
export const GENERIC_HEAD: Record<Locale, { title: string; description: string }> = {
  es: {
    title: 'Manuel Saavedra · Portafolio profesional',
    description:
      'Portafolio profesional de Manuel Saavedra: experiencia, skills y perfiles curados por rol.',
  },
  en: {
    title: 'Manuel Saavedra · Professional portfolio',
    description:
      'Professional portfolio of Manuel Saavedra: experience, skills and role-curated profiles.',
  },
};

/** Imagen de vista previa: un PNG raster, porque los rastreadores no renderizan SVG. */
export const OG_IMAGE = {
  path: '/og-default.png',
  width: 1200,
  height: 630,
  alt: 'Manuel Saavedra — portafolio profesional',
} as const;

const DESCRIPTION_MAX = 300;

/** Tope de `knowsAbout`, para acotar el tamaño del head (D3). */
export const KNOWS_ABOUT_MAX = 50;

export interface HeadMeta {
  title: string;
  description: string;
  canonical: string;
  locale: Locale;
  noindex: boolean;
  jsonLd?: Record<string, unknown>;
}

/** Metadatos de un perfil público resuelto. Misma derivación que `metaFromProfile` del cliente. */
export function headMetaFromProfile(
  data: CuratedProfileOutput,
  locale: Locale,
  baseUrl: string,
): HeadMeta {
  const name = data.profile?.fullName ?? GENERIC_HEAD[locale].title;
  const title = `${data.title} · ${name}`;
  const description = truncate(
    data.description || data.headline || data.profile?.summary || '',
    DESCRIPTION_MAX,
  );
  const canonical = `${origin(baseUrl)}${profilePath(data.slug)}`;
  const noindex = data.visibility !== 'PUBLIC';
  return {
    title,
    description,
    canonical,
    locale,
    noindex,
    // Solo una página indexable lleva datos estructurados (D6).
    jsonLd: noindex
      ? undefined
      : profilePageJsonLd(data, { title, description, canonical, locale, origin: origin(baseUrl) }),
  };
}

/** Metadatos genéricos: perfiles no públicos o inexistentes. Nunca indexables. */
export function genericHeadMeta(locale: Locale, baseUrl: string): HeadMeta {
  return {
    ...GENERIC_HEAD[locale],
    canonical: `${origin(baseUrl)}/`,
    locale,
    noindex: true,
  };
}

/** Textos ya derivados para `<title>`, la meta `description` y el canonical, más el idioma y el origen (sin `/` final). */
export interface ProfilePageContext {
  title: string;
  description: string;
  canonical: string;
  locale: Locale;
  origin: string;
}

/**
 * `schema.org/ProfilePage` con el `Person` en `mainEntity` (D1 y D2). Idéntico al que
 * escribe el cliente (`profilePageJsonLd` de `document-meta.ts`), con las claves en el
 * mismo orden: el fixture compartido compara también la serialización.
 */
export function profilePageJsonLd(
  data: CuratedProfileOutput,
  context: ProfilePageContext,
): Record<string, unknown> | undefined {
  const profile = data.profile;
  if (!profile) return undefined;

  const knowsAbout = data.sections.includes('skills') ? skillNames(data) : [];
  const alumniOf = data.sections.includes('education') ? institutionNames(data) : [];
  const credentials = data.sections.includes('certifications')
    ? data.certifications.map(credentialJsonLd)
    : [];

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: context.canonical,
    name: context.title,
    description: context.description,
    inLanguage: context.locale,
    // Día UTC de la última edición del perfil curado, el mismo que su `<lastmod>`; sin fila, sin clave.
    ...(data.updatedAt ? { dateModified: isoDay(new Date(data.updatedAt)) } : {}),
    mainEntity: {
      '@type': 'Person',
      '@id': `${context.origin}/#person`,
      url: `${context.origin}/`,
      name: profile.fullName,
      jobTitle: data.headline || profile.headline,
      email: `mailto:${profile.email}`,
      address: { '@type': 'PostalAddress', addressLocality: profile.location },
      ...(data.socialLinks.length > 0 ? { sameAs: data.socialLinks.map((link) => link.url) } : {}),
      ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
      ...(alumniOf.length > 0
        ? { alumniOf: alumniOf.map((name) => ({ '@type': 'EducationalOrganization', name })) }
        : {}),
      ...(credentials.length > 0 ? { hasCredential: credentials } : {}),
    },
  };
}

/** Skills de las categorías ya resueltas: en orden, sin repetidos y hasta `KNOWS_ABOUT_MAX` (D3). */
function skillNames(data: CuratedProfileOutput): string[] {
  return distinct(data.skillCategories.flatMap((category) => category.skills)).slice(
    0,
    KNOWS_ABOUT_MAX,
  );
}

function institutionNames(data: CuratedProfileOutput): string[] {
  return distinct(data.education.map((item) => item.institution));
}

/** Conserva la primera aparición, tal como está escrita; compara sin mayúsculas ni espacios en los extremos. */
function distinct(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function credentialJsonLd(item: CuratedProfileOutput['certifications'][number]) {
  return {
    '@type': 'EducationalOccupationalCredential',
    name: item.name,
    recognizedBy: { '@type': 'Organization', name: item.issuer },
    ...(item.verificationUrl ? { url: item.verificationUrl } : {}),
    ...(item.credentialId ? { identifier: item.credentialId } : {}),
    ...(item.expiresAt ? { expires: item.expiresAt } : {}),
  };
}

/** El fragmento HTML, con todo el texto escapado. */
export function renderProfileHead(meta: HeadMeta, baseUrl: string): string {
  const image = `${origin(baseUrl)}${OG_IMAGE.path}`;
  const lines = [
    `<title>${escapeHtml(meta.title)}</title>`,
    metaTag('name', 'description', meta.description),
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    metaTag('name', 'robots', meta.noindex ? 'noindex, nofollow' : 'index, follow'),
    metaTag('property', 'og:type', 'profile'),
    metaTag('property', 'og:site_name', GENERIC_HEAD[meta.locale].title),
    metaTag('property', 'og:title', meta.title),
    metaTag('property', 'og:description', meta.description),
    metaTag('property', 'og:url', meta.canonical),
    metaTag('property', 'og:locale', OG_LOCALE[meta.locale]),
    metaTag('property', 'og:image', image),
    metaTag('property', 'og:image:width', String(OG_IMAGE.width)),
    metaTag('property', 'og:image:height', String(OG_IMAGE.height)),
    metaTag('property', 'og:image:alt', OG_IMAGE.alt),
    metaTag('name', 'twitter:card', 'summary_large_image'),
    metaTag('name', 'twitter:title', meta.title),
    metaTag('name', 'twitter:description', meta.description),
    metaTag('name', 'twitter:image', image),
  ];
  if (meta.jsonLd && !meta.noindex) {
    lines.push(`<script type="application/ld+json">${safeJson(meta.jsonLd)}</script>`);
  }
  return `${lines.join('\n')}\n`;
}

function metaTag(attribute: 'name' | 'property', key: string, content: string): string {
  return `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
}

function origin(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON dentro de `<script>`: `<`, `>`, `&`, U+2028 y U+2029 salen como `\uXXXX` (D8), así
 * que ningún texto puede cerrar la etiqueta ni abrir un comentario. Sigue siendo JSON válido.
 */
function safeJson(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
