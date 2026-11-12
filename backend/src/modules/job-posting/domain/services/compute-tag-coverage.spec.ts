import fc from 'fast-check';
import { collectTagVocabulary, TagVocabulary } from '../../../../shared/domain/tag-vocabulary';
import { slugifyDraft } from '../../../../shared/domain/slugify-draft';
import { computeTagCoverage, MAX_SUGGESTED_TAGS } from './compute-tag-coverage';

/** Misma forma que `SLUG_REGEX` de `curated-profile` (el módulo no lo importa, D19). */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function vocabularyOf(...entries: Array<[string, number]>): TagVocabulary {
  const items = entries.flatMap(([tag, count]) =>
    Array.from({ length: count }, () => ({ tags: [tag], visible: true })),
  );
  return collectTagVocabulary(items);
}

describe('computeTagCoverage (D12)', () => {
  it('cubre 2 de 4: ratio 0,5 y los otros dos sin respaldo', () => {
    const coverage = computeTagCoverage(
      ['java', 'spring-boot', 'kubernetes', 'go'],
      vocabularyOf(['java', 3], ['spring-boot', 1]),
    );
    expect(coverage.detectedCount).toBe(4);
    expect(coverage.coveredCount).toBe(2);
    expect(coverage.ratio).toBe(0.5);
    expect(coverage.uncovered).toEqual(['go', 'kubernetes']);
    expect(coverage.covered).toEqual([
      { tag: 'java', evidence: 3 },
      { tag: 'spring-boot', evidence: 1 },
    ]);
    expect(coverage.suggestedFilterTags).toEqual(['java', 'spring-boot']);
  });

  it('nada detectado: ratio nulo y sin sugeridos', () => {
    const coverage = computeTagCoverage([], vocabularyOf(['java', 1]));
    expect(coverage.ratio).toBeNull();
    expect(coverage.detectedCount).toBe(0);
    expect(coverage.suggestedFilterTags).toEqual([]);
  });

  it('redondea la proporción a dos decimales', () => {
    const coverage = computeTagCoverage(['a1', 'b1', 'c1'], vocabularyOf(['a1', 1]));
    expect(coverage.ratio).toBe(0.33);
  });

  it('ordena por evidencia descendente y tag ascendente', () => {
    const coverage = computeTagCoverage(
      ['b', 'a', 'c', 'd'],
      vocabularyOf(['a', 1], ['b', 5], ['c', 5], ['d', 2]),
    );
    expect(coverage.covered.map((entry) => entry.tag)).toEqual(['b', 'c', 'd', 'a']);
  });

  it(`sugiere como máximo ${MAX_SUGGESTED_TAGS}`, () => {
    const tags = Array.from({ length: 10 }, (_, index) => `tag${String(index).padStart(2, '0')}`);
    const coverage = computeTagCoverage(
      tags,
      vocabularyOf(...tags.map((tag): [string, number] => [tag, 1])),
    );
    expect(coverage.coveredCount).toBe(10);
    expect(coverage.suggestedFilterTags).toHaveLength(MAX_SUGGESTED_TAGS);
    expect(coverage.suggestedFilterTags).toEqual(tags.slice(0, MAX_SUGGESTED_TAGS));
  });

  it('un término repetido se cuenta una vez', () => {
    const coverage = computeTagCoverage(['java', 'java', 'go'], vocabularyOf(['java', 1]));
    expect(coverage.detectedCount).toBe(2);
  });

  it('propiedad: los sugeridos ⊆ vocabulario, sin repetidos, y las cuentas cierran', () => {
    const word = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);
    fc.assert(
      fc.property(
        fc.array(word, { maxLength: 30 }),
        fc.array(fc.record({ tags: fc.array(word, { maxLength: 4 }), visible: fc.boolean() }), {
          maxLength: 20,
        }),
        (detected, items) => {
          const vocabulary = collectTagVocabulary(items);
          const coverage = computeTagCoverage(detected, vocabulary);
          const inVocabulary = new Set(vocabulary.tags);
          expect(coverage.suggestedFilterTags.every((tag) => inVocabulary.has(tag))).toBe(true);
          expect(new Set(coverage.suggestedFilterTags).size).toBe(
            coverage.suggestedFilterTags.length,
          );
          expect(coverage.suggestedFilterTags.length).toBeLessThanOrEqual(MAX_SUGGESTED_TAGS);
          expect(coverage.coveredCount + coverage.uncovered.length).toBe(coverage.detectedCount);
          expect(coverage.covered.length).toBe(coverage.coveredCount);
        },
      ),
    );
  });
});

describe('slugifyDraft (D12)', () => {
  it('empresa + puesto en kebab-case sin tildes', () => {
    expect(slugifyDraft('Acme Ejemplo', 'Tech Lead Backend (Java) — Remoto')).toBe(
      'acme-ejemplo-tech-lead-backend-java-remoto',
    );
    expect(slugifyDraft(null, 'Líder Técnico')).toBe('lider-tecnico');
  });

  it('entrada vacía o sin caracteres válidos da «vacante»', () => {
    expect(slugifyDraft('', '')).toBe('vacante');
    expect(slugifyDraft(null, '***')).toBe('vacante');
  });

  it('corta a 60 caracteres en un guion', () => {
    const slug = slugifyDraft(
      'Acme Ejemplo',
      'Senior Software Engineer Platform Infrastructure Team Lead',
    );
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
    expect('acme-ejemplo-senior-software-engineer-platform-infrastructure-team-lead').toContain(
      slug,
    );
    // «…-platform-infrastructure» mide 61: se vuelve al último guion que cabe.
    expect(slug).toBe('acme-ejemplo-senior-software-engineer-platform');
  });

  it('una sola palabra larguísima se corta a 60 igual', () => {
    expect(slugifyDraft(null, 'x'.repeat(100))).toBe('x'.repeat(60));
  });

  it('propiedad: siempre cumple SLUG_REGEX y ≤ 60', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 120 }),
        fc.option(fc.string({ maxLength: 80 })),
        (title, company) => {
          const slug = slugifyDraft(company, title);
          expect(SLUG_REGEX.test(slug)).toBe(true);
          expect(slug.length).toBeLessThanOrEqual(60);
        },
      ),
    );
  });
});
