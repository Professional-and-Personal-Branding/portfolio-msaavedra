import { normalizeLocale, pickFromAcceptLanguage, resolveLocale } from './resolve-locale';

describe('normalizeLocale', () => {
  it('acepta variantes regionales y mayúsculas', () => {
    expect(normalizeLocale('EN-us')).toBe('en');
    expect(normalizeLocale('es-BO')).toBe('es');
    expect(normalizeLocale(' en ')).toBe('en');
  });

  it('cae al default para valores vacíos o no soportados', () => {
    expect(normalizeLocale(undefined)).toBe('es');
    expect(normalizeLocale(null)).toBe('es');
    expect(normalizeLocale('')).toBe('es');
    expect(normalizeLocale('fr')).toBe('es');
  });
});

describe('pickFromAcceptLanguage', () => {
  it('elige el idioma soportado de mayor preferencia', () => {
    expect(pickFromAcceptLanguage('en-US,en;q=0.9,es;q=0.8')).toBe('en');
    expect(pickFromAcceptLanguage('fr-FR,fr;q=0.9,es;q=0.5,en;q=0.8')).toBe('en');
  });

  it('devuelve undefined si ningún idioma es soportado o el header está vacío', () => {
    expect(pickFromAcceptLanguage('fr,de;q=0.5')).toBeUndefined();
    expect(pickFromAcceptLanguage(undefined)).toBeUndefined();
    expect(pickFromAcceptLanguage('')).toBeUndefined();
  });
});

describe('fachada: re-exporta el núcleo de dominio', () => {
  it('resolveLocale sigue disponible desde la ruta histórica', () => {
    expect(resolveLocale({ es: 'Hola' }, 'en')).toBe('Hola');
  });
});
