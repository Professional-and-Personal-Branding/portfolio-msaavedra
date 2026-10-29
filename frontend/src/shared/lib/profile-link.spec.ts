import { describe, expect, it } from 'vitest';
import { buildProfileLink } from './profile-link';

describe('buildProfileLink', () => {
  it('conserva idioma, tema y layout y quita token, via y src (change add-share-links)', () => {
    const link = buildProfileLink(
      'backend',
      new URLSearchParams(
        'lang=en&theme=elegant&token=abc&via=k7m2q9xw4t&src=indeed&layout=sidebar',
      ),
    );
    expect(link).toEqual({ pathname: '/backend', search: 'lang=en&theme=elegant&layout=sidebar' });
  });

  it('desde la home con código, el enlace al perfil `all` queda sin atribución', () => {
    const link = buildProfileLink('all', new URLSearchParams('via=k7m2q9xw4t&src=indeed&lang=en'));
    expect(link).toEqual({ pathname: '/', search: 'lang=en' });
  });

  it('un parámetro desconocido sigue pasando (solo se quitan los de atribución y token)', () => {
    const link = buildProfileLink('backend', new URLSearchParams('utm=1&via=k7m2q9xw4t'));
    expect(link.search).toBe('utm=1');
  });
});
