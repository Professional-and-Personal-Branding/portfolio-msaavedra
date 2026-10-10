import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROJECT,
  EMPTY_SOCIAL_LINK,
  isSocialLinkDirty,
  toProjectBody,
} from './proyectos-form';
import { EMPTY_CERTIFICATION, toCertificationBody } from '../formacion/formacion-form';
import { EMPTY_LANGUAGE, toLanguageBody } from '../portada/language-form';
import { toCategoryBody } from '../skills/skills-form';

const dirty = <T>(toBody: (v: T) => unknown, a: T, b: T) =>
  JSON.stringify(toBody(a)) !== JSON.stringify(toBody(b));

describe('regla de "sucio" de los formularios en diálogo (D12)', () => {
  it('recortar espacios al borde no ensucia', () => {
    expect(
      dirty(toProjectBody, { ...EMPTY_PROJECT, name: 'Bot ' }, { ...EMPTY_PROJECT, name: 'Bot' }),
    ).toBe(false);
    expect(
      dirty(
        toLanguageBody,
        { ...EMPTY_LANGUAGE, level: { es: ' B2 ', en: ' B2' } },
        { ...EMPTY_LANGUAGE, level: { es: 'B2', en: 'B2' } },
      ),
    ).toBe(false);
  });

  it('el nivel bilingüe: el inglés vacío se omite y cambiarlo ensucia', () => {
    expect(
      toLanguageBody({ ...EMPTY_LANGUAGE, name: 'Inglés', level: { es: ' B2 ', en: ' ' } }),
    ).toEqual({
      name: 'Inglés',
      nameI18n: null,
      level: { es: 'B2' },
      detail: null,
    });
    expect(
      dirty(
        toLanguageBody,
        { ...EMPTY_LANGUAGE, level: { es: 'Nativo', en: 'Native' } },
        { ...EMPTY_LANGUAGE, level: { es: 'Nativo', en: '' } },
      ),
    ).toBe(true);
  });

  it('abrir un alta y no tocar nada no ensucia', () => {
    expect(dirty(toProjectBody, { ...EMPTY_PROJECT }, EMPTY_PROJECT)).toBe(false);
    expect(dirty(toCertificationBody, { ...EMPTY_CERTIFICATION }, EMPTY_CERTIFICATION)).toBe(false);
    expect(
      dirty(
        toCategoryBody,
        { name: { es: '', en: '' }, order: 0 },
        { name: { es: '', en: '' }, order: 0 },
      ),
    ).toBe(false);
  });

  it('un cambio real ensucia', () => {
    expect(dirty(toProjectBody, { ...EMPTY_PROJECT, name: 'Bot' }, EMPTY_PROJECT)).toBe(true);
  });

  describe('enlace social', () => {
    it('stats con JSON inválido ensucia aunque no llegue al cuerpo', () => {
      expect(isSocialLinkDirty({ ...EMPTY_SOCIAL_LINK, stats: '{' }, EMPTY_SOCIAL_LINK)).toBe(true);
    });

    it('stats con solo espacios al borde no ensucia', () => {
      expect(isSocialLinkDirty({ ...EMPTY_SOCIAL_LINK, stats: '  ' }, EMPTY_SOCIAL_LINK)).toBe(
        false,
      );
    });

    it('sin tocar nada no ensucia', () => {
      expect(isSocialLinkDirty({ ...EMPTY_SOCIAL_LINK }, EMPTY_SOCIAL_LINK)).toBe(false);
    });
  });
});
