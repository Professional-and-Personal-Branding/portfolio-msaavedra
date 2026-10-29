import { describe, expect, it } from 'vitest';
import { linkedInShareUrl, normalizePortal, portalLinkUrl, shareLinkUrl } from './share-link-url';

const ORIGIN = 'https://portafolio.example.com';

describe('share-link-url', () => {
  it('el link con código lleva solo via en un perfil público', () => {
    expect(shareLinkUrl({ origin: ORIGIN, slug: 'acme-backend', token: null }, 'k7m2q9xw4t')).toBe(
      `${ORIGIN}/acme-backend?via=k7m2q9xw4t`,
    );
  });

  it('un perfil protegido lleva token antes que via', () => {
    expect(shareLinkUrl({ origin: ORIGIN, slug: 'acme-backend', token: 'abc' }, 'k7m2q9xw4t')).toBe(
      `${ORIGIN}/acme-backend?token=abc&via=k7m2q9xw4t`,
    );
  });

  it('el token se codifica', () => {
    const url = shareLinkUrl({ origin: ORIGIN, slug: 'p', token: 'a b&c' }, 'k7m2q9xw4t');
    expect(new URL(url).searchParams.get('token')).toBe('a b&c');
  });

  it('la home es la raíz', () => {
    expect(shareLinkUrl({ origin: ORIGIN, slug: 'all', token: null }, 'k7m2q9xw4t')).toBe(
      `${ORIGIN}/?via=k7m2q9xw4t`,
    );
  });

  it('el link por portal lleva src', () => {
    expect(portalLinkUrl({ origin: ORIGIN, slug: 'acme-backend', token: null }, 'indeed')).toBe(
      `${ORIGIN}/acme-backend?src=indeed`,
    );
  });

  it('LinkedIn recibe la URL del perfil codificada en url', () => {
    const profile = `${ORIGIN}/acme-backend?via=k7m2q9xw4t`;
    const shared = new URL(linkedInShareUrl(profile));
    expect(shared.origin + shared.pathname).toBe('https://www.linkedin.com/sharing/share-offsite/');
    expect(shared.searchParams.get('url')).toBe(profile);
  });

  it.each([
    ['Indeed', 'indeed'],
    [' get-on-board ', 'get-on-board'],
    ['mi portal', null],
    ['-x', null],
    ['', null],
    ['a'.repeat(33), null],
  ])('normalizePortal(%j) = %j', (raw, expected) => {
    expect(normalizePortal(raw)).toBe(expected);
  });
});
