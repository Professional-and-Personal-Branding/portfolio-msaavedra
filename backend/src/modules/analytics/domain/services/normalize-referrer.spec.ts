import {
  aggregateByReferrer,
  DIRECT_REFERRER,
  INTERNAL_REFERRER,
  normalizeReferrer,
} from './normalize-referrer';

const SITE = 'https://manuel.dev';

describe('normalizeReferrer (D5)', () => {
  it.each<[string | null | undefined, string]>([
    ['https://www.linkedin.com/feed/', 'linkedin.com'],
    ['https://WWW.Google.com/search?q=manuel+saavedra&utm_source=x', 'google.com'],
    ['https://lnkd.in/abc123?trk=secreto', 'lnkd.in'],
    ['http://mail.google.com/mail/u/0/#inbox', 'mail.google.com'],
    [null, DIRECT_REFERRER],
    [undefined, DIRECT_REFERRER],
    ['', DIRECT_REFERRER],
    ['   ', DIRECT_REFERRER],
    ['no es una url', DIRECT_REFERRER],
    ['linkedin.com/feed', DIRECT_REFERRER],
    ['https://manuel.dev/tech-lead-dotnet', INTERNAL_REFERRER],
    ['https://www.manuel.dev/', INTERNAL_REFERRER],
  ])('%p → %p', (referrer, expected) => {
    expect(normalizeReferrer(referrer, SITE)).toBe(expected);
  });

  it('solo el host: nunca path ni parámetros', () => {
    const origin = normalizeReferrer('https://example.com/ruta/privada?token=abc', SITE);
    expect(origin).toBe('example.com');
    expect(origin).not.toMatch(/[/?=]/);
  });

  it('sin URL del sitio, el propio host cuenta como externo', () => {
    expect(normalizeReferrer('https://manuel.dev/', null)).toBe('manuel.dev');
  });
});

describe('aggregateByReferrer', () => {
  const rows = [
    { referrer: 'https://www.linkedin.com/feed/', views: 3 },
    { referrer: 'https://linkedin.com/in/manuel', views: 2 },
    { referrer: null, views: 4 },
    { referrer: 'basura', views: 1 },
    { referrer: 'https://manuel.dev/all', views: 2 },
  ];

  it('agrupa por origen normalizado, de mayor a menor', () => {
    expect(aggregateByReferrer(rows, SITE)).toEqual([
      { referrer: 'directo', views: 5 },
      { referrer: 'linkedin.com', views: 5 },
      { referrer: 'interno', views: 2 },
    ]);
  });

  it('la suma no cambia', () => {
    const sum = (list: { views: number }[]) => list.reduce((acc, r) => acc + r.views, 0);
    expect(sum(aggregateByReferrer(rows, SITE))).toBe(sum(rows));
  });

  it('sin filas, lista vacía', () => {
    expect(aggregateByReferrer([], SITE)).toEqual([]);
  });
});
