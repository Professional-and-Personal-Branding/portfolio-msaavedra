import * as fs from 'fs';
import * as path from 'path';
import { Locale, SUPPORTED_LOCALES } from '../../../../shared/domain/i18n';
import { selectByTags } from '../../domain/services/select-by-tags';
import { detectMissingTranslations, MissingTranslationsInput } from './detect-missing-translations';

/**
 * Contenido del seed (`docs/cv-data.json`): el informe de faltantes debe dar
 * cero en ES y en EN para el perfil `all` y las 13 plantillas
 * (`add-bilingual-builder-parity`, tarea 5.1). Sin base de datos: arma las
 * entidades bilingües como `scripts/seed.ts` y aplica la misma selección por
 * tags que `CuratedProfileComposer` (servicio puro `selectByTags`).
 *
 * Simplificación deliberada: de las skills solo importa el `name` bilingüe de la
 * categoría, y la heurística de tags de las skills vive en el script del seed, no
 * en el dominio; por eso se revisan TODAS las categorías (superconjunto de lo
 * que cualquier perfil mostraría, así que la comprobación es más estricta).
 */
type Bilingual = Record<string, unknown>;
interface CvTemplate {
  slug: string;
  title: Bilingual;
  description: Bilingual;
  headline: Bilingual;
  roleType?: Bilingual;
  filterTags: string[];
}
interface CvData {
  profile: {
    headline: Bilingual;
    summary: Bilingual;
    availability: { modality: Bilingual; contractType: Bilingual; startDate: Bilingual };
    socialLinks?: { label: Bilingual; description?: Bilingual }[];
  };
  experiences: {
    id: string;
    role: Bilingual;
    summary: Bilingual;
    highlights: Bilingual;
    tags: string[];
  }[];
  skillCategories: { name: Bilingual }[];
  education: { degree: Bilingual }[];
  certifications: { name: Bilingual }[];
  projects: {
    id: string;
    role: Bilingual;
    summary: Bilingual;
    tags: string[];
    visible: boolean;
  }[];
  profileTemplates: CvTemplate[];
}

const data = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../../../../docs/cv-data.json'), 'utf-8'),
) as CvData;

/** Igual que el seed: `all` es un perfil más, sin filtro y sin titular propio. */
const profiles: CvTemplate[] = [
  ...data.profileTemplates,
  {
    slug: 'all',
    title: { es: 'Perfil Completo', en: 'Full Profile' },
    headline: {},
    description: {
      es: 'Vista completa del portafolio profesional.',
      en: 'Complete view of the professional portfolio.',
    },
    filterTags: [],
  },
];

function inputFor(template: CvTemplate, locale: Locale): MissingTranslationsInput {
  const criteria = { filterTags: template.filterTags, includeIds: [], excludeIds: [] };
  const stub = <T>(fields: unknown) => fields as T;
  const { profile } = data;
  return {
    locale,
    curated: stub({
      id: template.slug,
      title: template.title,
      headline: template.headline,
      description: template.description,
      roleType: template.roleType,
    }),
    profile: stub({
      id: 'profile',
      headline: profile.headline,
      summary: profile.summary,
      availability: profile.availability,
    }),
    experiences: selectByTags(data.experiences, criteria).map((e) => stub(e)),
    skillCategories: data.skillCategories.map((c, i) => stub({ id: `cat-${i}`, name: c.name })),
    projects: selectByTags(
      data.projects.filter((p) => p.visible),
      criteria,
    ).map((p) => stub(p)),
    education: data.education.map((e, i) => stub({ id: `edu-${i}`, degree: e.degree })),
    certifications: data.certifications.map((c, i) => stub({ id: `cert-${i}`, name: c.name })),
    socialLinks: (profile.socialLinks ?? []).map((l, i) =>
      stub({ id: `link-${i}`, label: l.label, description: l.description }),
    ),
  };
}

describe('Seed bilingüe (docs/cv-data.json)', () => {
  it('cubre el perfil all y las 13 plantillas', () => {
    expect(data.profileTemplates).toHaveLength(13);
    expect(profiles).toHaveLength(14);
  });

  describe.each(SUPPORTED_LOCALES.map((locale) => [locale] as const))('en %s', (locale) => {
    it.each(profiles.map((p) => [p.slug, p] as const))(
      'el perfil %s no tiene faltantes de traducción',
      (_slug, template) => {
        expect(detectMissingTranslations(inputFor(template, locale))).toEqual([]);
      },
    );
  });
});
