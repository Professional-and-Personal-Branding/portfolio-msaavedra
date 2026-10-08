import { Experience } from '../../../experience/domain/entities/experience.entity';
import { detectMissingTranslations, MissingTranslationsInput } from './detect-missing-translations';

/** Dobles mínimos: el detector solo lee los campos bilingües de cada entidad. */
function stub<T>(fields: Record<string, unknown>): T {
  return fields as unknown as T;
}

const emptyInput: MissingTranslationsInput = {
  locale: 'en',
  curated: stub({ id: 'c1', title: null, headline: null, description: null, roleType: null }),
  profile: null,
  experiences: [],
  skillCategories: [],
  projects: [],
  education: [],
  certifications: [],
  socialLinks: [],
};

function withExperience(
  locale: 'es' | 'en',
  fields: Record<string, unknown>,
): MissingTranslationsInput {
  return {
    ...emptyInput,
    locale,
    experiences: [
      stub<Experience>({ id: 'e1', role: 'x', summary: 'x', highlights: [], ...fields }),
    ],
  };
}

describe('detectMissingTranslations', () => {
  const cases: [string, MissingTranslationsInput, unknown[]][] = [
    [
      'campo de texto vacío en el idioma pedido',
      withExperience('en', { role: { es: 'Líder', en: '' }, highlights: { es: ['a'], en: ['a'] } }),
      [{ entity: 'experience', id: 'e1', field: 'role' }],
    ],
    [
      'campo de texto ausente en el idioma pedido',
      withExperience('en', { summary: { es: 'Resumen' } }),
      [{ entity: 'experience', id: 'e1', field: 'summary' }],
    ],
    [
      'lista vacía en el idioma pedido',
      withExperience('en', { highlights: { es: ['Logro'], en: [] } }),
      [{ entity: 'experience', id: 'e1', field: 'highlights' }],
    ],
    [
      'valor idéntico al otro idioma: no cuenta',
      withExperience('en', {
        role: { es: 'Tech Lead', en: 'Tech Lead' },
        highlights: { es: ['.NET'], en: ['.NET'] },
      }),
      [],
    ],
    [
      'entidad completa',
      withExperience('en', {
        role: { es: 'Líder', en: 'Lead' },
        summary: { es: 'Resumen', en: 'Summary' },
        highlights: { es: ['a'], en: ['b'] },
      }),
      [],
    ],
    [
      'idioma es: falta el es y hay en',
      withExperience('es', { role: { es: '', en: 'Lead' } }),
      [{ entity: 'experience', id: 'e1', field: 'role' }],
    ],
    [
      'idioma es con el español completo y el inglés a medias: nada',
      withExperience('es', {
        role: { es: 'Líder' },
        summary: { es: 'Resumen', en: '' },
        highlights: { es: ['a'], en: [] },
      }),
      [],
    ],
    [
      'opcional vacío en todos los idiomas: no cuenta',
      {
        ...emptyInput,
        socialLinks: [
          stub({ id: 's1', label: { es: 'Web', en: 'Web' }, description: { es: '', en: '' } }),
        ],
        curated: stub({
          id: 'c1',
          title: { es: 'T', en: 'T' },
          headline: { es: '', en: '' },
          description: null,
          roleType: null,
        }),
      },
      [],
    ],
    [
      'texto plano legado: no se reporta',
      withExperience('en', { role: 'Solo texto', summary: '', highlights: ['a'] }),
      [],
    ],
    [
      'recorre las demás entidades, con campos anidados del perfil',
      {
        ...emptyInput,
        curated: stub({
          id: 'c1',
          title: { es: 'T' },
          headline: null,
          description: null,
          roleType: { es: 'R', en: 'R' },
        }),
        profile: stub({
          id: 'p1',
          headline: { es: 'H', en: 'H' },
          summary: { es: 'S', en: ' ' },
          availability: {
            modality: { es: 'Remoto' },
            contractType: null,
            startDate: { es: '', en: '' },
          },
        }),
        skillCategories: [stub({ id: 'k1', name: { es: 'Lenguajes' } })],
        projects: [stub({ id: 'pr1', role: { es: 'Rol', en: 'Role' }, summary: { es: 'S' } })],
        education: [stub({ id: 'ed1', degree: { es: 'Grado' } })],
        certifications: [stub({ id: 'ce1', name: { es: 'Cert', en: 'Cert' } })],
        socialLinks: [stub({ id: 's1', label: { es: 'Web' }, description: { es: 'D', en: 'D' } })],
      },
      [
        { entity: 'curatedProfile', id: 'c1', field: 'title' },
        { entity: 'profile', id: 'p1', field: 'summary' },
        { entity: 'profile', id: 'p1', field: 'availability.modality' },
        { entity: 'skillCategory', id: 'k1', field: 'name' },
        { entity: 'project', id: 'pr1', field: 'summary' },
        { entity: 'education', id: 'ed1', field: 'degree' },
        { entity: 'socialLink', id: 's1', field: 'label' },
      ],
    ],
  ];

  it.each(cases)('%s', (_name, input, expected) => {
    expect(detectMissingTranslations(input)).toEqual(expected);
  });
});
