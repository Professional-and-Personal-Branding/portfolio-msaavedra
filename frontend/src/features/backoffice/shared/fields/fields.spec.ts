import { describe, expect, it } from 'vitest';
import { toLocalizedListPayload, toLocalizedPayload } from './localized';

describe('toLocalizedPayload', () => {
  it('recorta y conserva ambos idiomas cuando hay traducción', () => {
    expect(toLocalizedPayload({ es: '  Rol  ', en: ' Role ' })).toEqual({ es: 'Rol', en: 'Role' });
  });

  it('omite `en` cuando está vacío o solo tiene espacios', () => {
    expect(toLocalizedPayload({ es: 'Rol', en: '' })).toEqual({ es: 'Rol' });
    expect(toLocalizedPayload({ es: 'Rol', en: '   ' })).toEqual({ es: 'Rol' });
    expect(toLocalizedPayload({ es: 'Rol' })).toEqual({ es: 'Rol' });
  });

  it('un valor ausente produce `es` vacío (el formulario lo valida antes de enviar)', () => {
    expect(toLocalizedPayload(undefined)).toEqual({ es: '' });
  });
});

describe('toLocalizedListPayload', () => {
  it('descarta elementos vacíos y recorta', () => {
    expect(toLocalizedListPayload({ es: [' uno ', '', '  ', 'dos'] })).toEqual({
      es: ['uno', 'dos'],
    });
  });

  it('omite `en` si queda vacía', () => {
    expect(toLocalizedListPayload({ es: ['uno'], en: ['   '] })).toEqual({ es: ['uno'] });
    expect(toLocalizedListPayload({ es: ['uno'], en: ['one'] })).toEqual({
      es: ['uno'],
      en: ['one'],
    });
  });

  it('sin valor devuelve lista vacía en `es`', () => {
    expect(toLocalizedListPayload(undefined)).toEqual({ es: [] });
  });
});
