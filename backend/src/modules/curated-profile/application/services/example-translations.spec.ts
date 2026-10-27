import * as fs from 'fs';
import * as path from 'path';
import { Locale, SUPPORTED_LOCALES } from '../../../../shared/domain/i18n';
import { selectByTags } from '../../domain/services/select-by-tags';
import { detectMissingTranslations, MissingTranslationsInput } from './detect-missing-translations';

/**
 * Datos de ejemplo (`docs/examples/cv-data.example.json`, change
 * `add-learning-guide-and-example-data`, D8): todo el contenido es bilingüe salvo
 * `description.en` del perfil PRIVATE, que falta a propósito para que el aviso de faltantes del
 * constructor tenga algo que mostrar. Sin base de datos: arma las entidades como el seed y aplica
 * la misma selección que `CuratedProfileComposer` (ítems visibles + `selectByTags` con las
 * referencias `experience:`/`project:` convertidas a ids).
 */
type Bilingual = Record<string, unknown>;
interface Template {
  slug: string;
  title: Bilingual;
  description: Bilingual;
  headline: Bilingual;
  roleType?: Bilingual;
  filterTags: string[];
  includeRefs?: string[];
  excludeRefs?: string[];
}
interface Example {
  profile: {
    headline: Bilingual;
    summary: Bilingual;
    availability: { modality: Bilingual; contractType: Bilingual; startDate: Bilingual };
    socialLinks?: { label: Bilingual; description?: Bilingual; visible: boolean }[];
    languages: { name: string; nameI18n: Bilingual; level: Bilingual; detail: Bilingual }[];
  };
  experiences: {
    id: string;
    role: Bilingual;
    summary: Bilingual;
    highlights: Bilingual;
    tags: string[];
    visible?: boolean;
  }[];
  skillCategories: { name: Bilingual }[];
  education: { degree: Bilingual; visible?: boolean }[];
  certifications: { name: Bilingual; visible?: boolean }[];
  projects: {
    id: string;
    role: Bilingual;
    summary: Bilingual;
    tags: string[];
    visible?: boolean;
  }[];
  profileTemplates: Template[];
}

const examplePath = path.resolve(__dirname, '../../../../../../docs/examples/cv-data.example.json');
const load = (): Example => JSON.parse(fs.readFileSync(examplePath, 'utf-8')) as Example;

const allProfile: Template = {
  slug: 'all',
  title: { es: 'Perfil Completo', en: 'Full Profile' },
  headline: {},
  description: {
    es: 'Vista completa del portafolio profesional.',
    en: 'Complete view of the professional portfolio.',
  },
  filterTags: [],
};

const idsOf = (refs: string[] | undefined, kind: string): string[] =>
  (refs ?? []).filter((r) => r.startsWith(`${kind}:`)).map((r) => r.slice(kind.length + 1));

function inputFor(data: Example, template: Template, locale: Locale): MissingTranslationsInput {
  const stub = <T>(fields: unknown) => fields as T;
  const { profile } = data;
  const visible = <T extends { visible?: boolean }>(items: T[]): T[] =>
    items.filter((i) => i.visible !== false);
  const expCriteria = {
    filterTags: template.filterTags,
    includeIds: idsOf(template.includeRefs, 'experience'),
    excludeIds: idsOf(template.excludeRefs, 'experience'),
  };
  const projCriteria = {
    filterTags: template.filterTags,
    includeIds: idsOf(template.includeRefs, 'project'),
    excludeIds: idsOf(template.excludeRefs, 'project'),
  };
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
      languages: profile.languages.map((l) => stub({ id: l.name, ...l })),
    }),
    experiences: selectByTags(visible(data.experiences), expCriteria).map((e) => stub(e)),
    skillCategories: data.skillCategories.map((c, i) => stub({ id: `cat-${i}`, name: c.name })),
    projects: selectByTags(visible(data.projects), projCriteria).map((p) => stub(p)),
    education: visible(data.education).map((e, i) => stub({ id: `edu-${i}`, degree: e.degree })),
    certifications: visible(data.certifications).map((c, i) =>
      stub({ id: `cert-${i}`, name: c.name }),
    ),
    socialLinks: visible(profile.socialLinks ?? []).map((l, i) =>
      stub({ id: `link-${i}`, label: l.label, description: l.description }),
    ),
  };
}

describe('Datos de ejemplo bilingües (docs/examples/cv-data.example.json)', () => {
  const data = load();
  const profiles = [...data.profileTemplates, allProfile];

  it('cubre el perfil all y las 8 plantillas', () => {
    expect(data.profileTemplates).toHaveLength(8);
    expect(profiles).toHaveLength(9);
  });

  describe.each(SUPPORTED_LOCALES.map((locale) => [locale] as const))('en %s', (locale) => {
    it.each(profiles.map((p) => [p.slug, p] as const))(
      'el perfil %s solo tiene el faltante deliberado',
      (slug, template) => {
        const missing = detectMissingTranslations(inputFor(data, template, locale));
        const deliberate =
          locale === 'en' && slug === 'ejemplo-borrador'
            ? [{ entity: 'curatedProfile', id: 'ejemplo-borrador', field: 'description' }]
            : [];
        expect(missing).toEqual(deliberate);
      },
    );
  });

  it('falla si se borra un en cualquiera del archivo', () => {
    const broken = load();
    delete (broken.experiences[0].role as Record<string, unknown>)['en'];
    const missing = detectMissingTranslations(inputFor(broken, allProfile, 'en'));
    expect(missing).toContainEqual({
      entity: 'experience',
      id: broken.experiences[0].id,
      field: 'role',
    });
  });
});
