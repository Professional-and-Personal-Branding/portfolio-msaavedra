import { AS_OF, cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvCuratedProfileSnapshot, CvExperienceSnapshot, CvSnapshot } from '../cv-snapshot';
import { curatedRule } from './curated.rule';

const ctx = { asOf: AS_OF };
const withCurated = (changes: Partial<CvCuratedProfileSnapshot>): CvSnapshot => {
  const s = cleanSnapshot();
  return { ...s, curatedProfiles: s.curatedProfiles.map((c) => ({ ...c, ...changes })) };
};
const brief = (snapshot: CvSnapshot) =>
  curatedRule(snapshot, ctx).map((i) => `${i.code}:${i.field}:${JSON.stringify(i.params)}`);

describe('curatedRule', () => {
  it('el CV limpio no emite nada', () => {
    expect(curatedRule(cleanSnapshot(), ctx)).toEqual([]);
  });

  describe('curated.orphan-reference', () => {
    it('id inexistente en excludeIds, con la lista en params', () => {
      expect(curatedRule(withCurated({ excludeIds: ['no-existe'] }), ctx)).toEqual([
        {
          code: 'curated.orphan-reference',
          severity: 'warning',
          entityType: 'curatedProfile',
          entityId: 'cp-1',
          field: 'excludeIds',
          params: { list: 'excludeIds', id: 'no-existe' },
        },
      ]);
    });

    it('acepta ids de experiencias, skills y proyectos', () => {
      expect(curatedRule(withCurated({ includeIds: ['exp-a', 'skill-1', 'proj-1'] }), ctx)).toEqual(
        [],
      );
    });

    it('el id de una experiencia oculta no es huérfano', () => {
      const s = cleanSnapshot();
      const hidden: CvExperienceSnapshot = {
        ...s.experiences[0],
        id: 'exp-hidden',
        visible: false,
      };
      const snapshot: CvSnapshot = {
        ...s,
        experiences: [...s.experiences, hidden],
        curatedProfiles: s.curatedProfiles.map((c) => ({ ...c, includeIds: ['exp-hidden'] })),
      };
      expect(curatedRule(snapshot, ctx)).toEqual([]);
    });
  });

  describe('curated.conflicting-reference', () => {
    it('el mismo id en includeIds y excludeIds', () => {
      expect(brief(withCurated({ includeIds: ['exp-a'], excludeIds: ['exp-a'] }))).toEqual([
        'curated.conflicting-reference:includeIds:{"id":"exp-a"}',
      ]);
    });
  });

  describe('curated.unmatched-filter-tag', () => {
    it('un tag sin ítem visible que lo tenga', () => {
      expect(brief(withCurated({ filterTags: ['backend', 'cobol'] }))).toEqual([
        'curated.unmatched-filter-tag:filterTags:{"tag":"cobol"}',
      ]);
    });

    it('un tag que solo tiene un ítem oculto cuenta como sin coincidencia', () => {
      const s = cleanSnapshot();
      const snapshot: CvSnapshot = {
        ...s,
        experiences: [
          ...s.experiences,
          { ...s.experiences[0], id: 'exp-hidden', visible: false, tags: ['cobol'] },
        ],
        curatedProfiles: s.curatedProfiles.map((c) => ({ ...c, filterTags: ['backend', 'cobol'] })),
      };
      expect(brief(snapshot)).toEqual(['curated.unmatched-filter-tag:filterTags:{"tag":"cobol"}']);
    });

    it('un tag que solo tiene una skill o un proyecto coincide', () => {
      expect(brief(withCurated({ filterTags: ['backend'] }))).toEqual([]);
    });
  });

  describe('curated.no-experiences', () => {
    it('todas las experiencias excluidas', () => {
      expect(brief(withCurated({ excludeIds: ['exp-a', 'exp-b'] }))).toEqual([
        'curated.no-experiences:null:{}',
      ]);
    });

    it('un filtro que ninguna experiencia visible cumple (y sin includeIds)', () => {
      const s = cleanSnapshot();
      const snapshot: CvSnapshot = {
        ...s,
        projects: s.projects.map((p) => ({ ...p, tags: ['solo-proyecto'] })),
        curatedProfiles: s.curatedProfiles.map((c) => ({ ...c, filterTags: ['solo-proyecto'] })),
      };
      expect(brief(snapshot)).toEqual(['curated.no-experiences:null:{}']);
    });

    it('un includeIds fuerza la inclusión', () => {
      const s = cleanSnapshot();
      const snapshot: CvSnapshot = {
        ...s,
        projects: s.projects.map((p) => ({ ...p, tags: ['solo-proyecto'] })),
        curatedProfiles: s.curatedProfiles.map((c) => ({
          ...c,
          filterTags: ['solo-proyecto'],
          includeIds: ['exp-a'],
        })),
      };
      expect(brief(snapshot)).toEqual([]);
    });

    it('sin experiencias visibles emite', () => {
      const s = cleanSnapshot();
      const snapshot: CvSnapshot = {
        ...s,
        experiences: s.experiences.map((e) => ({ ...e, visible: false })),
      };
      expect(brief(snapshot)).toEqual(['curated.no-experiences:null:{}']);
    });
  });

  describe('alcance', () => {
    it('un perfil archivado con referencias huérfanas no emite', () => {
      expect(
        curatedRule(withCurated({ archived: true, excludeIds: ['x'], filterTags: ['y'] }), ctx),
      ).toEqual([]);
    });
  });
});
