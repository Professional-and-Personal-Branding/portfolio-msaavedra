import { describe, expect, it } from 'vitest';
import { adminKeys } from './use-admin-api';

describe('adminKeys.preview', () => {
  it('el idioma es un segmento propio de la clave, no parte del borrador', () => {
    expect(adminKeys.preview('borrador', 'en')).toEqual(['admin', 'preview', 'borrador', 'en']);
  });

  it('el mismo borrador en otro idioma produce otra clave y no pisa a la anterior', () => {
    const es = adminKeys.preview('borrador', 'es');
    const en = adminKeys.preview('borrador', 'en');
    expect(es).not.toEqual(en);
    expect(es.slice(0, 3)).toEqual(en.slice(0, 3));
  });
});
