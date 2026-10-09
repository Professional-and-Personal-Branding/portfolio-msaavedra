import { CuratedProfileOutput } from '../dto/curated-profile.output';
import {
  GENERIC_HEAD,
  genericHeadMeta,
  headMetaFromProfile,
  renderProfileHead,
} from './profile-head.renderer';
import { buildSitemapXml, toSitemapEntries } from './sitemap.builder';

const BASE = 'https://manuel.dev/';

function output(overrides: Partial<CuratedProfileOutput> = {}): CuratedProfileOutput {
  return {
    slug: 'tech-lead-dotnet',
    title: 'Tech Lead .NET',
    headline: '14 años en .NET',
    description: 'Liderazgo técnico y arquitectura .NET.',
    roleType: 'Tech Lead',
    techFocus: '.NET',
    layout: 'classic',
    visibility: 'PUBLIC',
    sections: [],
    hiddenSections: [],
    theme: null,
    profile: {
      fullName: 'Ada Ejemplo',
      headline: 'Ingeniera de software',
      summary: 'Resumen del perfil.',
      email: 'ada@example.com',
      location: 'Santa Cruz',
    } as CuratedProfileOutput['profile'],
    experiences: [],
    skillCategories: [],
    projects: [],
    education: [],
    certifications: [],
    socialLinks: [{ url: 'https://github.com/ada' }] as CuratedProfileOutput['socialLinks'],
    ...overrides,
  };
}

const render = (data: CuratedProfileOutput, locale: 'es' | 'en' = 'es') =>
  renderProfileHead(headMetaFromProfile(data, locale, BASE), BASE);

const content = (html: string, key: string) =>
  new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`).exec(html)?.[1];

describe('renderProfileHead', () => {
  it('perfil completo: todas las etiquetas, URLs absolutas y JSON-LD', () => {
    const html = render(output());
    expect(html).toContain('<title>Tech Lead .NET · Ada Ejemplo</title>');
    expect(content(html, 'og:title')).toBe('Tech Lead .NET · Ada Ejemplo');
    expect(content(html, 'description')).toBe('Liderazgo técnico y arquitectura .NET.');
    expect(html).toContain('<link rel="canonical" href="https://manuel.dev/tech-lead-dotnet" />');
    expect(content(html, 'og:url')).toBe('https://manuel.dev/tech-lead-dotnet');
    expect(content(html, 'robots')).toBe('index, follow');
    expect(content(html, 'og:locale')).toBe('es_ES');
    expect(content(html, 'og:image')).toBe('https://manuel.dev/og-default.png');
    expect(content(html, 'og:image:width')).toBe('1200');
    expect(content(html, 'og:image:height')).toBe('630');
    expect(content(html, 'og:image:alt')).toBeTruthy();
    expect(content(html, 'twitter:card')).toBe('summary_large_image');
    const ld = /<script type="application\/ld\+json">(.*)<\/script>/.exec(html)?.[1];
    expect(JSON.parse(ld ?? '{}')).toMatchObject({
      '@type': 'Person',
      name: 'Ada Ejemplo',
      sameAs: ['https://github.com/ada'],
    });
  });

  it('la home (`all`) tiene canonical en la raíz', () => {
    expect(render(output({ slug: 'all' }))).toContain('href="https://manuel.dev/"');
  });

  it('sin descripción usa el titular', () => {
    expect(content(render(output({ description: '' })), 'description')).toBe('14 años en .NET');
  });

  it('en inglés: og:locale en_US', () => {
    expect(content(render(output(), 'en'), 'og:locale')).toBe('en_US');
  });

  it('escapa `<`, `&` y `"` en los textos, también dentro del JSON-LD', () => {
    const html = render(output({ title: 'A <b> & "B"', headline: '</script><script>x' }));
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;B&quot; · Ada Ejemplo</title>');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('</script><script>');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('el genérico: textos del portafolio, noindex y sin JSON-LD', () => {
    const html = renderProfileHead(genericHeadMeta('es', BASE), BASE);
    expect(html).toContain(`<title>${GENERIC_HEAD.es.title}</title>`);
    expect(content(html, 'robots')).toBe('noindex, nofollow');
    expect(html).not.toContain('application/ld+json');
  });
});

describe('canonical del fragmento y sitemap', () => {
  it.each(['tech-lead-dotnet', 'all'])('coinciden para %s', (slug) => {
    const html = render(output({ slug }));
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    const sitemap = buildSitemapXml(
      BASE,
      toSitemapEntries([{ slug, visibility: 'PUBLIC', listed: true, archivedAt: null }]),
    );
    expect(sitemap).toContain(`<loc>${canonical}</loc>`);
  });
});
