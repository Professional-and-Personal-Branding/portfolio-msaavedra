import type { Locale } from '@/shared/i18n/locale';
import type { CuratedProfile } from '@/shared/types/portfolio';

/** Metadatos que la vista pública escribe en el documento (spec `public-seo`). */
export interface DocumentMeta {
  title: string;
  description: string;
  canonical: string;
  locale: Locale;
  /** `true` para perfiles no públicos y para el panel. */
  noindex: boolean;
  jsonLd?: Record<string, unknown>;
}

const MANAGED = 'data-managed-meta';
const OG_LOCALE: Record<Locale, string> = { es: 'es_ES', en: 'en_US' };

/** Valores por defecto: los mismos que trae `index.html`. */
export const DEFAULT_META = {
  title: 'Portafolio profesional',
  description: 'Portafolio profesional administrable con perfiles curados por rol.',
} as const;

/** Metadatos derivados de un perfil curado resuelto. */
export function metaFromProfile(
  data: CuratedProfile,
  locale: Locale,
  origin: string,
): DocumentMeta {
  const name = data.profile?.fullName ?? DEFAULT_META.title;
  const path = data.slug === 'all' ? '/' : `/${data.slug}`;

  return {
    title: `${data.title} · ${name}`,
    description: truncate(data.description || data.headline || data.profile?.summary || '', 300),
    canonical: `${origin.replace(/\/+$/, '')}${path}`,
    locale,
    noindex: data.visibility !== 'PUBLIC',
    jsonLd: personJsonLd(data),
  };
}

/** `schema.org/Person` con lo que el perfil ya expone. */
export function personJsonLd(data: CuratedProfile): Record<string, unknown> | undefined {
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

/**
 * Aplica los metadatos al documento. Solo toca etiquetas propias (marcadas con
 * `data-managed-meta`), así que `restoreDocumentMeta` puede limpiarlas sin
 * tocar las que vienen en `index.html`.
 */
export function applyDocumentMeta(meta: DocumentMeta): void {
  if (typeof document === 'undefined') return;

  document.title = meta.title;
  document.documentElement.lang = meta.locale;

  setMeta('name', 'description', meta.description);
  setMeta('property', 'og:title', meta.title);
  setMeta('property', 'og:description', meta.description);
  setMeta('property', 'og:type', 'profile');
  setMeta('property', 'og:url', meta.canonical);
  setMeta('property', 'og:locale', OG_LOCALE[meta.locale]);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', meta.title);
  setMeta('name', 'twitter:description', meta.description);
  setMeta('name', 'robots', meta.noindex ? 'noindex, nofollow' : 'index, follow');

  setCanonical(meta.canonical);
  setJsonLd(meta.jsonLd);
}

/** Devuelve el documento a los valores base de `index.html`. */
export function restoreDocumentMeta(): void {
  if (typeof document === 'undefined') return;

  document.title = DEFAULT_META.title;
  for (const element of document.querySelectorAll(`[${MANAGED}]`)) element.remove();
}

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    element.setAttribute(MANAGED, '');
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    link.setAttribute(MANAGED, '');
    document.head.appendChild(link);
  }
  link.href = href;
}

function setJsonLd(data: Record<string, unknown> | undefined): void {
  const existing = document.head.querySelector('script[type="application/ld+json"]');
  if (!data) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement('script');
  script.setAttribute('type', 'application/ld+json');
  script.setAttribute(MANAGED, '');
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
