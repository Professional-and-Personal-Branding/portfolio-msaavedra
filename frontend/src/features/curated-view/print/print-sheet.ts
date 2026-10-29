import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locale';
import { translate, type MessageKey } from '@/shared/i18n/messages';
import { certificationValidity } from '@/shared/lib/certification-validity';
import { formatPeriod } from '@/shared/lib/format';
import { metaFromProfile } from '@/shared/lib/document-meta';
import type { CuratedProfile } from '@/shared/types/portfolio';
import type { SectionId } from '@/themes/layouts/sections';

/**
 * Límites de la hoja imprimible (decisión D3 de `add-printable-one-page`). Están calculados
 * contra la caja de D5 (A4 de ancho, Letter de alto) con el volumen real del seed. Los valores
 * iniciales de D3 (6 en una línea, 6 categorías, 3 logros) no entraban en una hoja y se bajaron
 * con `print:check`. Cambiar uno exige actualizar la spec `printable-curated-profile` y la tabla de D3.
 */
export const PRINT_LIMITS = {
  /** Experiencias con rol, empresa, período, logros y tecnologías. */
  detailedExperiences: 3,
  /** Experiencias de una línea, después de las detalladas. */
  lineExperiences: 3,
  achievementsPerExperience: 2,
  technologiesPerExperience: 8,
  skillCategories: 3,
  skillsPerCategory: 10,
  projects: 2,
  education: 3,
  certifications: 4,
  /** Enlaces `featured` de `presence` que se suman al encabezado, además de LinkedIn. */
  featuredLinks: 2,
} as const;

export interface PrintLink {
  /** Lo que se ve en el papel: dominio y ruta, sin protocolo. */
  text: string;
  /** Destino clicable en el PDF; sin `href` es texto plano. */
  href?: string;
}

export interface PrintHeader {
  fullName: string;
  headline: string;
  /** `null` en `all` y cuando el perfil no tiene descripción. */
  description: string | null;
  contact: PrintLink[];
  /** Idiomas y disponibilidad (solo si `contact` figura en `sections`). */
  details: string[];
}

export interface PrintExperience {
  role: string;
  company: string;
  period: string;
  location: string;
  achievements: string[];
  technologies: string[];
  /** Tecnologías que no entraron en `technologies`. */
  technologiesMore: number;
}

interface BlockBase {
  section: SectionId;
  label: string;
  /** Cantidad de entradas que no entraron; 0 si entraron todas. */
  omitted: number;
  /** "y 6 experiencias más" en el idioma de la vista, o `null` si no se omitió nada. */
  omittedLabel: string | null;
}

export type PrintBlock =
  | (BlockBase & { kind: 'summary'; text: string })
  | (BlockBase & { kind: 'experience'; detailed: PrintExperience[]; lines: string[] })
  | (BlockBase & {
      kind: 'skills';
      categories: { name: string; skills: string[]; more: number }[];
    })
  | (BlockBase & {
      kind: 'projects';
      items: { name: string; role: string; summary: string; url: PrintLink | null }[];
    })
  | (BlockBase & {
      kind: 'education';
      items: { degree: string; institution: string; period: string; inProgress: boolean }[];
    })
  | (BlockBase & {
      kind: 'certifications';
      items: {
        /** "Nombre (emisor, año, vencida)": la marca solo si la credencial ya venció. */
        text: string;
        /** "Ver credencial" con el destino clicable en el PDF; la URL no se imprime. */
        credential: PrintLink | null;
        expired: boolean;
      }[];
    });

export interface PrintSheetModel {
  locale: Locale;
  header: PrintHeader;
  blocks: PrintBlock[];
  /** URL de la versión en línea: canónica, con `?lang=` si no es `es`, sin token. */
  fullUrl: string;
}

type OmittedKind = 'experience' | 'skills' | 'projects' | 'education' | 'certifications';

const OMITTED_KEYS: Record<OmittedKind, { one: MessageKey; other: MessageKey }> = {
  experience: { one: 'print.omitted.experience.one', other: 'print.omitted.experience.other' },
  skills: { one: 'print.omitted.skills.one', other: 'print.omitted.skills.other' },
  projects: { one: 'print.omitted.projects.one', other: 'print.omitted.projects.other' },
  education: { one: 'print.omitted.education.one', other: 'print.omitted.education.other' },
  certifications: {
    one: 'print.omitted.certifications.one',
    other: 'print.omitted.certifications.other',
  },
};

/** `https://www.linkedin.com/in/ada/` → `linkedin.com/in/ada`. */
export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/**
 * Decide qué entra en la hoja a partir del perfil curado ya resuelto (decisiones D2 y D3).
 * Es pura: sin React ni DOM. El orden y el ocultado de las secciones ya los aplicó el backend
 * en `sections`; acá solo se recorta y se cuenta lo omitido.
 */
export function buildPrintSheet(
  data: CuratedProfile,
  locale: Locale,
  origin: string,
  now: Date = new Date(),
): PrintSheetModel {
  const t = (key: MessageKey) => translate(locale, key);
  const sections = data.sections as SectionId[];

  const blocks: PrintBlock[] = [];
  for (const section of sections) {
    const block = buildBlock(section, data, locale, t, now);
    if (block) blocks.push(block);
  }

  return {
    locale,
    header: buildHeader(data, sections, locale),
    blocks,
    fullUrl: fullVersionUrl(data, locale, origin),
  };
}

function buildHeader(data: CuratedProfile, sections: SectionId[], locale: Locale): PrintHeader {
  const t = (key: MessageKey) => translate(locale, key);
  const profile = data.profile;
  const contact: PrintLink[] = [];
  const details: string[] = [];

  if (profile) {
    contact.push({ text: profile.email, href: `mailto:${profile.email}` });
    if (sections.includes('contact') && profile.phone) {
      contact.push({ text: profile.phone, href: `tel:${profile.phone.replace(/\s+/g, '')}` });
    }
    if (profile.location) contact.push({ text: profile.location });
  }

  const linkedin = data.socialLinks.find((link) => link.platform.toLowerCase() === 'linkedin');
  if (linkedin) contact.push({ text: displayUrl(linkedin.url), href: linkedin.url });

  if (sections.includes('presence')) {
    data.socialLinks
      .filter((link) => link.featured && link !== linkedin)
      .slice(0, PRINT_LIMITS.featuredLinks)
      .forEach((link) => contact.push({ text: displayUrl(link.url), href: link.url }));
  }

  if (profile && sections.includes('contact')) {
    if (profile.languages.length > 0) {
      details.push(
        `${t('contact.languages')}: ${profile.languages.map((l) => `${l.name} · ${l.level}`).join(' / ')}`,
      );
    }
    const { modality, contractType, startDate } = profile.availability;
    const availability = [
      [t('contact.modality'), modality],
      [t('contact.contractType'), contractType],
      [t('contact.startDate'), startDate],
    ]
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => `${label}: ${value}`);
    if (availability.length > 0) details.push(availability.join(' · '));
  }

  return {
    fullName: profile?.fullName ?? data.title,
    headline: data.headline || profile?.headline || '',
    description: data.slug !== 'all' && data.description ? data.description : null,
    contact,
    details,
  };
}

function buildBlock(
  section: SectionId,
  data: CuratedProfile,
  locale: Locale,
  t: (key: MessageKey) => string,
  now: Date,
): PrintBlock | null {
  switch (section) {
    case 'hero': {
      const text = data.profile?.summary?.trim();
      if (!text) return null;
      return {
        kind: 'summary',
        section,
        label: t('print.block.summary'),
        text,
        omitted: 0,
        omittedLabel: null,
      };
    }
    case 'experience': {
      const all = data.experiences;
      if (all.length === 0) return null;
      const detailed = all.slice(0, PRINT_LIMITS.detailedExperiences).map((e): PrintExperience => ({
        role: e.role,
        company: e.company,
        period: formatPeriod(e.startDate, e.endDate, locale, t('experience.present')),
        location: e.location,
        achievements: e.highlights.slice(0, PRINT_LIMITS.achievementsPerExperience),
        technologies: e.technologies.slice(0, PRINT_LIMITS.technologiesPerExperience),
        technologiesMore: Math.max(
          0,
          e.technologies.length - PRINT_LIMITS.technologiesPerExperience,
        ),
      }));
      const rest = all.slice(PRINT_LIMITS.detailedExperiences);
      const lines = rest
        .slice(0, PRINT_LIMITS.lineExperiences)
        .map(
          (e) =>
            `${formatPeriod(e.startDate, e.endDate, locale, t('experience.present'))} · ${e.role} — ${e.company}`,
        );
      return {
        kind: 'experience',
        section,
        label: t('print.block.experience'),
        detailed,
        lines,
        ...omitted('experience', rest.length - lines.length, locale),
      };
    }
    case 'skills': {
      const all = data.skillCategories.filter((c) => c.skills.length > 0);
      if (all.length === 0) return null;
      const shown = all.slice(0, PRINT_LIMITS.skillCategories);
      return {
        kind: 'skills',
        section,
        label: t('print.block.skills'),
        categories: shown.map((c) => ({
          name: c.name,
          skills: c.skills.slice(0, PRINT_LIMITS.skillsPerCategory),
          more: Math.max(0, c.skills.length - PRINT_LIMITS.skillsPerCategory),
        })),
        ...omitted('skills', all.length - shown.length, locale),
      };
    }
    case 'projects': {
      const all = data.projects;
      if (all.length === 0) return null;
      const shown = all.slice(0, PRINT_LIMITS.projects);
      return {
        kind: 'projects',
        section,
        label: t('print.block.projects'),
        items: shown.map((p) => ({
          name: p.name,
          role: p.role,
          summary: p.summary,
          url: p.url ? { text: displayUrl(p.url), href: p.url } : null,
        })),
        ...omitted('projects', all.length - shown.length, locale),
      };
    }
    case 'education': {
      const all = data.education;
      if (all.length === 0) return null;
      const shown = all.slice(0, PRINT_LIMITS.education);
      return {
        kind: 'education',
        section,
        label: t('print.block.education'),
        items: shown.map((e) => ({
          degree: e.degree,
          institution: e.institution,
          period: formatPeriod(
            e.startDate,
            e.inProgress ? null : e.endDate,
            locale,
            t('education.inProgress'),
          ),
          inProgress: e.inProgress,
        })),
        ...omitted('education', all.length - shown.length, locale),
      };
    }
    case 'certifications': {
      const all = data.certifications;
      if (all.length === 0) return null;
      const shown = all.slice(0, PRINT_LIMITS.certifications);
      return {
        kind: 'certifications',
        section,
        label: t('print.block.certifications'),
        items: shown.map((c) => {
          const expired = certificationValidity(c.expiresAt, now) === 'expired';
          const detail = [c.issuer, c.year, expired ? t('print.certification.expired') : null]
            .filter(Boolean)
            .join(', ');
          return {
            text: detail ? `${c.name} (${detail})` : c.name,
            credential: c.verificationUrl
              ? { text: t('certification.verify'), href: c.verificationUrl }
              : null,
            expired,
          };
        }),
        ...omitted('certifications', all.length - shown.length, locale),
      };
    }
    // `stats` no se imprime; `contact` y `presence` suman al encabezado (decisión D3).
    default:
      return null;
  }
}

function omitted(
  kind: OmittedKind,
  count: number,
  locale: Locale,
): Pick<BlockBase, 'omitted' | 'omittedLabel'> {
  if (count <= 0) return { omitted: 0, omittedLabel: null };
  const keys = OMITTED_KEYS[kind];
  const template = translate(locale, count === 1 ? keys.one : keys.other);
  return { omitted: count, omittedLabel: template.replace('{n}', String(count)) };
}

/**
 * La canónica del perfil, más `?lang=` si el idioma no es el por defecto. Nunca lleva
 * `token`, `theme` ni `layout`: el papel y el PDF circulan más allá de quien recibió el link
 * (decisión D8).
 */
function fullVersionUrl(data: CuratedProfile, locale: Locale, origin: string): string {
  const { canonical } = metaFromProfile(data, locale, origin);
  return locale === DEFAULT_LOCALE ? canonical : `${canonical}?lang=${locale}`;
}
