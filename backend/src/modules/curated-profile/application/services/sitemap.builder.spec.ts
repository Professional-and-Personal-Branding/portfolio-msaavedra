import {
  buildRobotsTxt,
  buildSitemapXml,
  toSitemapEntries,
  type SitemapProfile,
} from './sitemap.builder';

const vivo = { listed: true, archivedAt: null };
const profiles: SitemapProfile[] = [
  { slug: 'all', visibility: 'PUBLIC', ...vivo, updatedAt: new Date('2026-09-01T10:00:00Z') },
  {
    slug: 'tech-lead-dotnet',
    visibility: 'PUBLIC',
    ...vivo,
    updatedAt: new Date('2026-09-05T10:00:00Z'),
  },
  { slug: 'borrador', visibility: 'PRIVATE', ...vivo },
  { slug: 'para-acme', visibility: 'PROTECTED', ...vivo },
  // add-curated-profile-lifecycle: públicos que no se enumeran.
  { slug: 'dirigido', visibility: 'PUBLIC', listed: false, archivedAt: null },
  { slug: 'retirado', visibility: 'PUBLIC', listed: true, archivedAt: new Date('2026-10-01') },
];

describe('toSitemapEntries', () => {
  it('incluye la home y los perfiles públicos', () => {
    expect(toSitemapEntries(profiles).map((e) => e.path)).toEqual(['/', '/tech-lead-dotnet']);
  });

  it('excluye los perfiles PRIVATE y PROTECTED', () => {
    const paths = toSitemapEntries(profiles).map((e) => e.path);
    expect(paths).not.toContain('/borrador');
    expect(paths).not.toContain('/para-acme');
  });

  it('excluye los no enumerados y los archivados aunque sean PUBLIC', () => {
    const paths = toSitemapEntries(profiles).map((e) => e.path);
    expect(paths).not.toContain('/dirigido');
    expect(paths).not.toContain('/retirado');
  });

  it('el perfil `all` es la home, no una URL aparte', () => {
    expect(toSitemapEntries(profiles).map((e) => e.path)).not.toContain('/all');
    expect(toSitemapEntries(profiles)[0]?.lastModified).toEqual(new Date('2026-09-01T10:00:00Z'));
  });

  it('sin perfiles públicos deja al menos la home', () => {
    expect(
      toSitemapEntries([{ slug: 'x', visibility: 'PRIVATE', ...vivo }]).map((e) => e.path),
    ).toEqual(['/']);
  });
});

describe('buildSitemapXml', () => {
  it('genera URLs absolutas con su fecha', () => {
    const xml = buildSitemapXml('https://portafolio.example.com', toSitemapEntries(profiles));

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://portafolio.example.com/</loc>');
    expect(xml).toContain('<loc>https://portafolio.example.com/tech-lead-dotnet</loc>');
    expect(xml).toContain('<lastmod>2026-09-05</lastmod>');
    expect(xml).not.toContain('borrador');
  });

  it('normaliza la barra final de la base', () => {
    expect(buildSitemapXml('https://x.com/', [{ path: '/y' }])).toContain(
      '<loc>https://x.com/y</loc>',
    );
  });

  it('escapa los caracteres especiales de la URL', () => {
    expect(buildSitemapXml('https://x.com', [{ path: '/a&b' }])).toContain('/a&amp;b');
  });
});

describe('buildRobotsTxt', () => {
  it('permite la vista pública, bloquea el panel y apunta al sitemap', () => {
    const robots = buildRobotsTxt('https://portafolio.example.com');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap: https://portafolio.example.com/sitemap.xml');
  });
});
