import { isMissingTranslation } from './missing-translation';

describe('isMissingTranslation (regla D4 de add-bilingual-builder-parity)', () => {
  it('falta si el idioma está ausente o vacío y otro tiene contenido', () => {
    expect(isMissingTranslation({ es: 'Hola' }, 'en')).toBe(true);
    expect(isMissingTranslation({ es: 'Hola', en: '  ' }, 'en')).toBe(true);
    expect(isMissingTranslation({ es: ['a'], en: [] }, 'en')).toBe(true);
    expect(isMissingTranslation({ es: ['a'], en: ['', ' '] }, 'en')).toBe(true);
  });

  it('no falta si el idioma tiene contenido, aunque sea igual al otro', () => {
    expect(isMissingTranslation({ es: 'Tech Lead', en: 'Tech Lead' }, 'en')).toBe(false);
    expect(isMissingTranslation({ es: 'Hola', en: 'Hello' }, 'es')).toBe(false);
  });

  it('no falta si está vacío en todos los idiomas', () => {
    expect(isMissingTranslation({}, 'en')).toBe(false);
    expect(isMissingTranslation({ es: '', en: '' }, 'es')).toBe(false);
  });

  it('un dato plano legado o ausente no se reporta', () => {
    expect(isMissingTranslation('texto', 'en')).toBe(false);
    expect(isMissingTranslation(['a'], 'en')).toBe(false);
    expect(isMissingTranslation(null, 'en')).toBe(false);
    expect(isMissingTranslation(undefined, 'en')).toBe(false);
  });
});
