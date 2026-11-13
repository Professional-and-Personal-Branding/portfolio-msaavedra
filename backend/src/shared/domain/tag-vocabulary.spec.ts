import { collectTagVocabulary } from './tag-vocabulary';

describe('collectTagVocabulary', () => {
  it('une los tags de los ítems visibles y cuenta la evidencia por tag', () => {
    const vocabulary = collectTagVocabulary([
      { tags: ['java', 'spring-boot'], visible: true },
      { tags: ['java', 'aws'], visible: true },
    ]);
    expect(vocabulary.tags).toEqual(['aws', 'java', 'spring-boot']);
    expect(vocabulary.evidence.get('java')).toBe(2);
    expect(vocabulary.evidence.get('aws')).toBe(1);
  });

  it('una experiencia oculta no aporta sus tags', () => {
    const vocabulary = collectTagVocabulary([
      { tags: ['cobol'], visible: false },
      { tags: ['java'], visible: true },
    ]);
    expect(vocabulary.tags).toEqual(['java']);
    expect(vocabulary.evidence.has('cobol')).toBe(false);
  });

  it('un proyecto oculto no aporta; las skills (visible: true) siempre aportan', () => {
    const vocabulary = collectTagVocabulary([
      { tags: ['react'], visible: false }, // proyecto oculto
      { tags: ['postgresql'], visible: true }, // skill
    ]);
    expect(vocabulary.tags).toEqual(['postgresql']);
  });

  it('un tag repetido dentro del mismo ítem cuenta una vez', () => {
    const vocabulary = collectTagVocabulary([{ tags: ['java', 'java'], visible: true }]);
    expect(vocabulary.evidence.get('java')).toBe(1);
  });

  it('el orden es estable e independiente del orden de entrada', () => {
    const a = collectTagVocabulary([
      { tags: ['b', 'a'], visible: true },
      { tags: ['c'], visible: true },
    ]);
    const b = collectTagVocabulary([
      { tags: ['c'], visible: true },
      { tags: ['a', 'b'], visible: true },
    ]);
    expect(a.tags).toEqual(['a', 'b', 'c']);
    expect(b.tags).toEqual(a.tags);
    expect([...a.evidence.keys()]).toEqual(a.tags);
  });

  it('sin ítems devuelve un vocabulario vacío', () => {
    expect(collectTagVocabulary([]).tags).toEqual([]);
  });
});
