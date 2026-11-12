import { AS_OF, cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvExperienceSnapshot, CvRepositorySnapshot, CvSnapshot } from '../cv-snapshot';
import { translationsRule } from './translations.rule';

const ctx = { asOf: AS_OF };
const withExperience = (id: string, changes: Partial<CvExperienceSnapshot>): CvSnapshot => {
  const s = cleanSnapshot();
  return {
    ...s,
    experiences: s.experiences.map((e) => (e.id === id ? { ...e, ...changes } : e)),
  };
};
const summary = (snapshot: CvSnapshot) =>
  translationsRule(snapshot, ctx).map(
    (i) => `${i.code}:${i.entityType}:${i.entityId}:${i.field}:${JSON.stringify(i.params)}`,
  );

describe('translationsRule', () => {
  it('el CV limpio no emite nada', () => {
    expect(translationsRule(cleanSnapshot(), ctx)).toEqual([]);
  });

  it('falta el inglés de una experiencia visible', () => {
    const found = translationsRule(
      withExperience('exp-a', { summary: { es: 'Servicios', en: '' } }),
      ctx,
    );
    expect(found).toEqual([
      {
        code: 'i18n.missing-translation',
        severity: 'warning',
        entityType: 'experience',
        entityId: 'exp-a',
        field: 'summary',
        params: { locale: 'en' },
      },
    ]);
  });

  it('recorre los dos idiomas: también falta el español', () => {
    expect(summary(withExperience('exp-a', { role: { en: 'Developer' } }))).toEqual([
      'i18n.missing-translation:experience:exp-a:role:{"locale":"es"}',
    ]);
  });

  it('un valor igual en los dos idiomas no es faltante', () => {
    const s = cleanSnapshot();
    const snapshot = {
      ...s,
      curatedProfiles: s.curatedProfiles.map((c) => ({
        ...c,
        roleType: { es: 'Tech Lead', en: 'Tech Lead' },
      })),
    };
    expect(translationsRule(snapshot, ctx)).toEqual([]);
  });

  it('lo oculto no se revisa', () => {
    expect(
      translationsRule(
        withExperience('exp-a', { summary: { es: 'Servicios', en: '' }, visible: false }),
        ctx,
      ),
    ).toEqual([]);
    const s = cleanSnapshot();
    expect(
      translationsRule(
        {
          ...s,
          projects: s.projects.map((p) => ({ ...p, visible: false, summary: { es: 'Solo es' } })),
          certifications: s.certifications.map((c) => ({
            ...c,
            visible: false,
            name: { es: 'X' },
          })),
        },
        ctx,
      ),
    ).toEqual([]);
  });

  describe('descripción de los repositorios (change add-featured-repositories, D16)', () => {
    const withRepository = (changes: Partial<CvRepositorySnapshot>): CvSnapshot => {
      const s = cleanSnapshot();
      return { ...s, repositories: s.repositories.map((r) => ({ ...r, ...changes })) };
    };

    it('visible sin inglés: un issue con locale en sobre description', () => {
      expect(
        translationsRule(withRepository({ description: { es: 'API de reservas', en: '' } }), ctx),
      ).toEqual([
        {
          code: 'i18n.missing-translation',
          severity: 'warning',
          entityType: 'repository',
          entityId: 'repo-1',
          field: 'description',
          params: { locale: 'en' },
        },
      ]);
    });

    it('oculto sin inglés: no emite nada', () => {
      expect(
        translationsRule(
          withRepository({ visible: false, description: { es: 'API de reservas' } }),
          ctx,
        ),
      ).toEqual([]);
    });

    it('completo en los dos idiomas: no emite nada', () => {
      expect(translationsRule(withRepository({}), ctx)).toEqual([]);
    });
  });

  it('cubre perfil, idiomas, categorías, proyectos, formación, certificaciones, enlaces y curados', () => {
    const s = cleanSnapshot();
    const onlyEs = (text: string) => ({ es: text });
    const snapshot: CvSnapshot = {
      ...s,
      profile: s.profile && {
        ...s.profile,
        headline: onlyEs('Hola'),
        availabilityModality: onlyEs('Remoto'),
      },
      languages: s.languages.map((l) => ({ ...l, detail: onlyEs('Detalle') })),
      skillCategories: s.skillCategories.map((c) => ({ ...c, name: onlyEs('Backend') })),
      projects: s.projects.map((p) => ({ ...p, role: onlyEs('Autor') })),
      education: s.education.map((e) => ({ ...e, degree: onlyEs('Ingeniería') })),
      certifications: s.certifications.map((c) => ({ ...c, name: onlyEs('Cert') })),
      socialLinks: s.socialLinks.map((l) => ({ ...l, label: onlyEs('Código') })),
      curatedProfiles: s.curatedProfiles.map((c) => ({ ...c, title: onlyEs('Backend') })),
    };
    expect(summary(snapshot).sort()).toEqual(
      [
        'profile:profile-1:headline',
        'profile:profile-1:availability.modality',
        'language:lang-1:detail',
        'skillCategory:cat-1:name',
        'project:proj-1:role',
        'education:edu-1:degree',
        'certification:cert-1:name',
        'socialLink:link-1:label',
        'curatedProfile:cp-1:title',
      ]
        .map((key) => {
          const [entity, id, field] = key.split(':');
          return `i18n.missing-translation:${entity}:${id}:${field}:{"locale":"en"}`;
        })
        .sort(),
    );
  });

  it('un perfil curado archivado no se revisa; uno PRIVATE sí', () => {
    const s = cleanSnapshot();
    const broken = (archived: boolean): CvSnapshot => ({
      ...s,
      curatedProfiles: s.curatedProfiles.map((c) => ({ ...c, archived, title: { es: 'Backend' } })),
    });
    expect(translationsRule(broken(true), ctx)).toEqual([]);
    expect(translationsRule(broken(false), ctx)).toHaveLength(1);
  });

  describe('i18n.highlights-count-mismatch', () => {
    it('4 logros en español y 3 en inglés', () => {
      const found = translationsRule(
        withExperience('exp-a', {
          highlights: { es: ['a', 'b', 'c', 'd'], en: ['a', 'b', 'c'] },
        }),
        ctx,
      );
      expect(found).toEqual([
        {
          code: 'i18n.highlights-count-mismatch',
          severity: 'warning',
          entityType: 'experience',
          entityId: 'exp-a',
          field: 'highlights',
          params: { es: 4, en: 3 },
        },
      ]);
    });

    it('con un idioma vacío lo reporta solo missing-translation', () => {
      expect(summary(withExperience('exp-a', { highlights: { es: ['a', 'b'], en: [] } }))).toEqual([
        'i18n.missing-translation:experience:exp-a:highlights:{"locale":"en"}',
      ]);
    });

    it('una experiencia oculta no se revisa', () => {
      expect(
        translationsRule(
          withExperience('exp-a', { highlights: { es: ['a', 'b'], en: ['a'] }, visible: false }),
          ctx,
        ),
      ).toEqual([]);
    });
  });
});
