import { localize, localizeList, resolveLocale, resolveLocaleList } from './resolve-locale';

describe('resolveLocale (spec content-localization — fallback por campo)', () => {
  it('devuelve el idioma pedido cuando existe', () => {
    expect(resolveLocale({ es: 'Hola', en: 'Hello' }, 'en')).toBe('Hello');
    expect(resolveLocale({ es: 'Hola', en: 'Hello' }, 'es')).toBe('Hola');
  });

  it('cae al default cuando falta la traducción pedida', () => {
    expect(resolveLocale({ es: 'Hola' }, 'en')).toBe('Hola');
  });

  it('cae al primer valor disponible cuando falta también el default', () => {
    expect(resolveLocale({ pt: 'Olá' } as Record<string, string>, 'en')).toBe('Olá');
  });

  it('devuelve cadena vacía para campo nulo o indefinido', () => {
    expect(resolveLocale(null, 'en')).toBe('');
    expect(resolveLocale(undefined, 'es')).toBe('');
  });

  it('devuelve un dato plano legado tal cual', () => {
    expect(resolveLocale('Texto plano', 'en')).toBe('Texto plano');
  });

  it('localize construye el objeto bilingüe', () => {
    expect(localize('Hola', 'Hello')).toEqual({ es: 'Hola', en: 'Hello' });
  });
});

describe('resolveLocaleList', () => {
  it('devuelve la lista del idioma pedido', () => {
    expect(resolveLocaleList({ es: ['a'], en: ['b'] }, 'en')).toEqual(['b']);
  });

  it('cae al default y luego al primer valor disponible', () => {
    expect(resolveLocaleList({ es: ['a'] }, 'en')).toEqual(['a']);
    expect(resolveLocaleList({ pt: ['c'] } as Record<string, string[]>, 'en')).toEqual(['c']);
  });

  it('devuelve lista vacía para campo nulo', () => {
    expect(resolveLocaleList(null, 'en')).toEqual([]);
    expect(resolveLocaleList(undefined, 'es')).toEqual([]);
  });

  it('devuelve una lista plana legada tal cual', () => {
    expect(resolveLocaleList(['x', 'y'], 'en')).toEqual(['x', 'y']);
  });

  it('localizeList construye el objeto bilingüe', () => {
    expect(localizeList(['a'], ['b'])).toEqual({ es: ['a'], en: ['b'] });
  });
});
