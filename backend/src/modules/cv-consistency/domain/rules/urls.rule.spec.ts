import { AS_OF, cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvSnapshot } from '../cv-snapshot';
import { urlsRule } from './urls.rule';

const ctx = { asOf: AS_OF };
const withProjectUrl = (url: string | null, visible = true): CvSnapshot => {
  const s = cleanSnapshot();
  return { ...s, projects: s.projects.map((p) => ({ ...p, url, visible })) };
};
const withLinkUrl = (url: string): CvSnapshot => {
  const s = cleanSnapshot();
  return { ...s, socialLinks: s.socialLinks.map((l) => ({ ...l, url })) };
};
const withVerification = (verificationUrl: string | null): CvSnapshot => {
  const s = cleanSnapshot();
  return { ...s, certifications: s.certifications.map((c) => ({ ...c, verificationUrl })) };
};
const brief = (snapshot: CvSnapshot) =>
  urlsRule(snapshot, ctx).map((i) => `${i.severity}:${i.code}:${i.entityType}:${i.field}`);

describe('urlsRule', () => {
  it('el CV limpio no emite nada', () => {
    expect(urlsRule(cleanSnapshot(), ctx)).toEqual([]);
  });

  it('proyecto con http://: url.not-https (warning) sobre el campo url', () => {
    expect(brief(withProjectUrl('http://ejemplo.com'))).toEqual([
      'warning:url.not-https:project:url',
    ]);
  });

  it.each(['no es url', 'ftp://ejemplo.com', 'javascript:alert(1)', '/ruta'])(
    'proyecto con %s: url.invalid (error)',
    (url) => {
      expect(brief(withProjectUrl(url))).toEqual(['error:url.invalid:project:url']);
    },
  );

  it('sin url no emite, y un proyecto oculto sí se revisa', () => {
    expect(brief(withProjectUrl(null))).toEqual([]);
    expect(brief(withProjectUrl('http://ejemplo.com', false))).toEqual([
      'warning:url.not-https:project:url',
    ]);
  });

  it('enlace social: http y no http(s)', () => {
    expect(brief(withLinkUrl('http://github.com/x'))).toEqual([
      'warning:url.not-https:socialLink:url',
    ]);
    expect(brief(withLinkUrl('mailto:a@b.c'))).toEqual(['error:url.invalid:socialLink:url']);
  });

  it('verificationUrl de una certificación: cualquier cosa que no sea https es error', () => {
    expect(brief(withVerification('http://emisor.example/x'))).toEqual([
      'error:url.invalid:certification:verificationUrl',
    ]);
    expect(brief(withVerification('no es url'))).toEqual([
      'error:url.invalid:certification:verificationUrl',
    ]);
    expect(brief(withVerification(null))).toEqual([]);
  });
});
