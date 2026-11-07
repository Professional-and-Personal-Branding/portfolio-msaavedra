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

/**
 * Valores por defecto: los mismos que el fallback de `index.html` y que el
 * fragmento genérico del backend (`profile-head.renderer.ts`, `GENERIC_HEAD.es`).
 */
export const DEFAULT_META = {
  title: 'Manuel Saavedra · Portafolio profesional',
  description:
    'Portafolio profesional de Manuel Saavedra: experiencia, skills y perfiles curados por rol.',
} as const;

/** Metadatos derivados de un perfil curado resuelto. */
export function metaFromProfile(
  data: CuratedProfile,
  locale: Locale,
  origin: string,
): DocumentMeta {
  const name = data.profile?.fullName ?? DEFAULT_META.title;
  const path = data.slug === 'all' ? '/' : `/${data.slug}`;
  const base = origin.replace(/\/+$/, '');
  const title = `${data.title} · ${name}`;
  const description = truncate(
    data.description || data.headline || data.profile?.summary || '',
    300,
  );
  const canonical = `${base}${path}`;
  const noindex = data.visibility !== 'PUBLIC';

  return {
    title,
    description,
    canonical,
    locale,
    noindex,
    // Una página noindex no lleva datos estructurados (D6): `setJsonLd` quita el bloque.
    jsonLd: noindex
      ? undefined
      : profilePageJsonLd(data, { title, description, canonical, locale, origin: base }),
  };
}

/** Textos ya derivados, el idioma y el origen (sin `/` final) con los que se arma el bloque. */
interface ProfilePageContext {
  title: string;
  description: string;
  canonical: string;
  locale: Locale;
  origin: string;
}

/** Tope de `knowsAbout` (D3). */
const KNOWS_ABOUT_MAX = 50;

/**
 * `schema.org/ProfilePage` con el `Person` en `mainEntity`. Gemela de `profilePageJsonLd`
 * del backend (`profile-head.renderer.ts`): mismas reglas y mismo orden de claves; el
 * fixture compartido compara las dos.
 */
export function profilePageJsonLd(
  data: CuratedProfile,
  context: ProfilePageContext,
): Record<string, unknown> | undefined {
  const profile = data.profile;
  if (!profile) return undefined;

  const knowsAbout = data.sections.includes('skills')
    ? distinct(data.skillCategories.flatMap((category) => category.skills)).slice(
        0,
        KNOWS_ABOUT_MAX,
      )
    : [];
  const alumniOf = data.sections.includes('education')
    ? distinct(data.education.map((item) => item.institution))
    : [];
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
    // Día UTC del ISO (nunca `new Date` con métodos locales: en una zona negativa caería en otro día).
    ...(data.updatedAt ? { dateModified: data.updatedAt.slice(0, 10) } : {}),
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

function credentialJsonLd(item: CuratedProfile['certifications'][number]) {
  return {
    '@type': 'EducationalOccupationalCredential',
    name: item.name,
    recognizedBy: { '@type': 'Organization', name: item.issuer },
    ...(item.verificationUrl ? { url: item.verificationUrl } : {}),
    ...(item.credentialId ? { identifier: item.credentialId } : {}),
    ...(item.expiresAt ? { expires: item.expiresAt } : {}),
  };
}

/**
 * Aplica los metadatos al documento. Es idempotente sobre un head ya poblado: si
 * la etiqueta existe (la trajo el fragmento del servidor o el fallback de
 * `index.html`) la reutiliza en lugar de duplicarla, y la marca con
 * `data-managed-meta` al escribirla (spec `public-portfolio-frontend`).
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

/** Quita lo que el cliente escribió o reescribió y devuelve el título base. */
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
    document.head.appendChild(element);
  }
  element.setAttribute(MANAGED, '');
  element.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.setAttribute(MANAGED, '');
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
