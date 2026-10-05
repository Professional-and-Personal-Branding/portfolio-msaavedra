import { Locale } from '../../../../shared/domain/i18n';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { profilePath } from './sitemap.builder';

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
  return {
    title: `${data.title} · ${name}`,
    description: truncate(
      data.description || data.headline || data.profile?.summary || '',
      DESCRIPTION_MAX,
    ),
    canonical: `${origin(baseUrl)}${profilePath(data.slug)}`,
    locale,
    noindex: data.visibility !== 'PUBLIC',
    jsonLd: personJsonLd(data),
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

/** `schema.org/Person`, idéntico al que escribe el cliente. */
export function personJsonLd(data: CuratedProfileOutput): Record<string, unknown> | undefined {
  const profile = data.profile;
  if (!profile) return undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.fullName,
    jobTitle: data.headline || profile.headline,
    email: `mailto:${profile.email}`,
    address: { '@type': 'PostalAddress', addressLocality: profile.location },
    ...(data.socialLinks.length > 0 ? { sameAs: data.socialLinks.map((link) => link.url) } : {}),
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

/** JSON dentro de `<script>`: `<` escapado para que ningún texto pueda cerrar la etiqueta. */
function safeJson(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
