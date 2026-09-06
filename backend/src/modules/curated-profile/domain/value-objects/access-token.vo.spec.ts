import { AccessToken } from './access-token.vo';

describe('AccessToken', () => {
  it('coincide solo con el valor exacto', () => {
    const token = AccessToken.create('s3cret-abc');
    expect(token.isSet).toBe(true);
    expect(token.matches('s3cret-abc')).toBe(true);
    expect(token.matches('s3cret-abd')).toBe(false);
    expect(token.matches('s3cret-ab')).toBe(false);
    expect(token.matches('s3cret-abcd')).toBe(false);
  });

  it('sin token configurado nunca coincide', () => {
    expect(AccessToken.create(null).matches('x')).toBe(false);
    expect(AccessToken.create('   ').isSet).toBe(false);
    expect(AccessToken.none().matches('')).toBe(false);
  });

  it('candidato vacío o ausente no coincide', () => {
    const token = AccessToken.create('abc');
    expect(token.matches('')).toBe(false);
    expect(token.matches(null)).toBe(false);
    expect(token.matches(undefined)).toBe(false);
  });
});
