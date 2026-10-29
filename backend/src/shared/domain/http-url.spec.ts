import { isHttpsUrl } from './http-url';

describe('isHttpsUrl', () => {
  it('acepta una URL https absoluta', () => {
    expect(isHttpsUrl('https://a.dev')).toBe(true);
    expect(isHttpsUrl('https://www.credly.com/badges/abc?x=1')).toBe(true);
  });

  it.each(['http://a.dev', 'javascript:alert(1)', 'data:text/html,x', '/c/1', 'no es url', ''])(
    'rechaza %p',
    (value) => {
      expect(isHttpsUrl(value)).toBe(false);
    },
  );
});
