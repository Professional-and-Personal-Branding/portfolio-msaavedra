import { Locale } from '../../../../shared/domain/i18n';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import {
  JsonResumeBasics,
  JsonResumeCertificate,
  JsonResumeEducation,
  JsonResumeLanguage,
  JsonResumeOutput,
  JsonResumeProfile,
  JsonResumeProject,
  JsonResumeSkill,
  JsonResumeWork,
} from '../dto/json-resume.output';
import { parseProjectPeriod } from '../services/parse-project-period';
import { profilePath } from '../services/profile-path';

/** URL del schema del tag publicado: lo que el documento declara cumplir. */
export const JSON_RESUME_SCHEMA_URL =
  'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json';
export const JSON_RESUME_VERSION = 'v1.0.0';

export interface JsonResumeContext {
  /** Origen público del sitio (`FRONTEND_URL`), con o sin `/` final. */
  baseUrl: string;
  locale: Locale;
}

/** Patrón `iso8601` del schema: `AAAA-MM-DD`, `AAAA-MM` o `AAAA`. */
const ISO8601 = /^([1-2][0-9]{3}-[0-1][0-9]-[0-3][0-9]|[1-2][0-9]{3}-[0-1][0-9]|[1-2][0-9]{3})$/;

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function date(value: string | null | undefined): string | undefined {
  return value && ISO8601.test(value) ? value : undefined;
}

/** Solo URL absolutas con esquema: el schema las valida con `format: uri` (RFC 3986). */
function uri(value: string | null | undefined): string | undefined {
  const candidate = text(value);
  if (!candidate || /\s/.test(candidate)) return undefined;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

function list(values: readonly string[]): string[] | undefined {
  const clean = values.map((value) => value.trim()).filter((value) => value !== '');
  return clean.length > 0 ? clean : undefined;
}

/** Quita las claves `undefined`: ningún valor vacío llega al documento (D3). */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function origin(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function toBasics(
  output: CuratedProfileOutput,
  has: (section: string) => boolean,
  url: string,
): JsonResumeBasics {
  const profile = output.profile;
  if (!profile) return { url };

  const profiles: JsonResumeProfile[] = has('presence')
    ? output.socialLinks
        .map((link) =>
          compact<JsonResumeProfile>({
            network: text(link.platform),
            username: text(link.handle),
            url: uri(link.url),
          }),
        )
        .filter((entry) => Object.keys(entry).length > 0)
    : [];
  const address = text(profile.location);

  return compact<JsonResumeBasics>({
    name: text(profile.fullName),
    // La misma regla que el hero y la hoja impresa: el titular curado, si no el del perfil.
    label: text(output.headline) ?? text(profile.headline),
    email: has('contact') ? text(profile.email) : undefined,
    phone: has('contact') ? text(profile.phone) : undefined,
    url,
    summary: text(profile.summary),
    location: address ? { address } : undefined,
    profiles: profiles.length > 0 ? profiles : undefined,
  });
}

function toWork(output: CuratedProfileOutput): JsonResumeWork[] {
  return output.experiences.flatMap((experience) => {
    const name = text(experience.company);
    if (!name) return [];
    return [
      compact<JsonResumeWork>({
        name,
        position: text(experience.role),
        location: text(experience.location),
        startDate: date(experience.startDate),
        endDate: date(experience.endDate),
        summary: text(experience.summary),
        highlights: list(experience.highlights),
      }),
    ];
  });
}

function toEducation(output: CuratedProfileOutput): JsonResumeEducation[] {
  return output.education.flatMap((entry) => {
    const institution = text(entry.institution);
    if (!institution) return [];
    return [
      compact<JsonResumeEducation>({
        institution,
        area: text(entry.degree),
        startDate: date(entry.startDate),
        endDate: date(entry.endDate),
      }),
    ];
  });
}

/** Sin `date`: el schema pide fecha completa y la certificación solo guarda el año (P1 → A). */
function toCertificates(output: CuratedProfileOutput): JsonResumeCertificate[] {
  return output.certifications.flatMap((certification) => {
    const name = text(certification.name);
    if (!name) return [];
    return [
      compact<JsonResumeCertificate>({
        name,
        issuer: text(certification.issuer),
        url: uri(certification.verificationUrl),
      }),
    ];
  });
}

function toSkills(output: CuratedProfileOutput): JsonResumeSkill[] {
  return output.skillCategories.flatMap((category) => {
    const keywords = list(category.skills);
    const name = text(category.name);
    return keywords && name ? [{ name, keywords }] : [];
  });
}

function toLanguages(output: CuratedProfileOutput): JsonResumeLanguage[] {
  return (output.profile?.languages ?? []).flatMap((language) => {
    const name = text(language.name);
    return name
      ? [compact<JsonResumeLanguage>({ language: name, fluency: text(language.level) })]
      : [];
  });
}

function toProjects(output: CuratedProfileOutput): JsonResumeProject[] {
  return output.projects.flatMap((project) => {
    const name = text(project.name);
    if (!name) return [];
    const role = text(project.role);
    return [
      compact<JsonResumeProject>({
        name,
        description: text(project.summary),
        roles: role ? [role] : undefined,
        keywords: list(project.technologies),
        ...parseProjectPeriod(project.period),
        url: uri(project.url),
      }),
    ];
  });
}

/**
 * Los repositorios destacados van a `projects` (D10), después de los proyectos, con
 * `type: "repository"`. `keywords`: el lenguaje primero si no está ya en las tecnologías,
 * luego las tecnologías, sin repetidos (sin distinguir mayúsculas). Sin fechas ni `roles`.
 */
function toRepositoryProjects(output: CuratedProfileOutput): JsonResumeProject[] {
  return output.repositories.flatMap((repository) => {
    const name = text(repository.name);
    if (!name) return [];
    const language = text(repository.language);
    const inTechnologies = repository.technologies.some(
      (tech) => tech.trim().toLowerCase() === language?.toLowerCase(),
    );
    const seen = new Set<string>();
    const keywords = [
      ...(language && !inTechnologies ? [language] : []),
      ...repository.technologies,
    ]
      .map((keyword) => keyword.trim())
      .filter((keyword) => {
        const key = keyword.toLowerCase();
        if (keyword === '' || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return [
      compact<JsonResumeProject>({
        name,
        description: text(repository.description),
        keywords: list(keywords),
        url: uri(repository.url),
        type: 'repository',
      }),
    ];
  });
}

/** `AAAA-MM-DDThh:mm:ss` en UTC, sin milisegundos ni `Z`, como pide la descripción del schema. */
function lastModified(updatedAt: string | null): string | undefined {
  if (!updatedAt) return undefined;
  const parsed = new Date(updatedAt);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 19);
}

/**
 * Traduce la vista resuelta de un perfil curado a JSON Resume v1.0.0 (spec `json-resume-export`).
 * Función pura: no vuelve a seleccionar nada, y una clave sale solo si su sección está en
 * `output.sections` (lo oculto y lo vacío se tratan como en la página). `basics` sale siempre.
 * Solo claves del schema y sin valores vacíos; el orden de las claves es fijo.
 */
export function toJsonResume(
  output: CuratedProfileOutput,
  context: JsonResumeContext,
): JsonResumeOutput {
  const base = origin(context.baseUrl);
  const visible = new Set(output.sections);
  const has = (section: string): boolean => visible.has(section);
  const slug = encodeURIComponent(output.slug);

  const work = has('experience') ? toWork(output) : [];
  const education = has('education') ? toEducation(output) : [];
  const certificates = has('certifications') ? toCertificates(output) : [];
  const skills = has('skills') ? toSkills(output) : [];
  const languages = has('contact') ? toLanguages(output) : [];
  // La clave `projects` sale si está `projects` o `repositories` en `sections`.
  const projects = [
    ...(has('projects') ? toProjects(output) : []),
    ...(has('repositories') ? toRepositoryProjects(output) : []),
  ];

  return {
    $schema: JSON_RESUME_SCHEMA_URL,
    basics: toBasics(output, has, `${base}${profilePath(output.slug)}`),
    ...(work.length > 0 && { work }),
    ...(education.length > 0 && { education }),
    ...(certificates.length > 0 && { certificates }),
    ...(skills.length > 0 && { skills }),
    ...(languages.length > 0 && { languages }),
    ...(projects.length > 0 && { projects }),
    meta: compact({
      canonical: `${base}/api/curated-profiles/${slug}/resume.json?lang=${context.locale}`,
      version: JSON_RESUME_VERSION,
      lastModified: lastModified(output.updatedAt),
    }),
  };
}
