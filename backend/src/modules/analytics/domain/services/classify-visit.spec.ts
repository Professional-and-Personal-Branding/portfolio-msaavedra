import { classifyVisit } from './classify-visit';

const BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BOT = 'Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36';

describe('classifyVisit', () => {
  it.each([
    [true, BROWSER, 'OWNER'],
    [true, BOT, 'OWNER'],
    [true, undefined, 'OWNER'],
    [false, BROWSER, 'HUMAN'],
    [false, BOT, 'BOT'],
    [false, undefined, 'BOT'],
  ] as const)(
    'sesión=%s UA=%s -> %s (OWNER > BOT > HUMAN)',
    (adminSession, userAgent, expected) => {
      expect(classifyVisit({ adminSession, userAgent })).toBe(expected);
    },
  );
});
