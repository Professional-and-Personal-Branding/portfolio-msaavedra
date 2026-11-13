import { CuratedProfileOutput } from '../dto/curated-profile.output';
import {
  GENERIC_HEAD,
  KNOWS_ABOUT_MAX,
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
    updatedAt: null,
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
    repositories: [],
    education: [],
    certifications: [],
    socialLinks: [{ url: 'https://github.com/ada' }] as CuratedProfileOutput['socialLinks'],
    ...overrides,
  };
}

const render = (data: CuratedProfileOutput, locale: 'es' | 'en' = 'es') =>
  renderProfileHead(headMetaFromProfile(data, locale, BASE), BASE);

const SCRIPT = /<script type="application\/ld\+json">(.*?)<\/script>/s;

/** El `ProfilePage` embebido, parseado; `undefined` si el fragmento no trae bloque. */
const jsonLd = (html: string): Record<string, unknown> | undefined => {
  const raw = SCRIPT.exec(html)?.[1];
  return raw === undefined ? undefined : (JSON.parse(raw) as Record<string, unknown>);
};

/** El `Person` de `mainEntity` del bloque embebido. */
const person = (html: string): Record<string, unknown> =>
  (jsonLd(html)?.mainEntity ?? {}) as Record<string, unknown>;

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
    expect(jsonLd(html)).toMatchObject({
      '@type': 'ProfilePage',
      mainEntity: { '@type': 'Person', name: 'Ada Ejemplo', sameAs: ['https://github.com/ada'] },
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

describe('JSON-LD ProfilePage (upgrade-profile-structured-data)', () => {
  const full = (overrides: Partial<CuratedProfileOutput> = {}) =>
    output({
      sections: ['hero', 'skills', 'education', 'certifications'],
      skillCategories: [
        { name: 'Lenguajes', skills: ['TypeScript', 'C#'] },
        { name: 'Plataforma', skills: ['typescript', ' Docker '] },
      ],
      education: [
        { institution: 'Universidad Ejemplo', degree: 'Sistemas' },
        { institution: 'universidad ejemplo', degree: 'Maestría' },
        { institution: 'Instituto Muestra', degree: 'Diplomado' },
      ] as CuratedProfileOutput['education'],
      certifications: [
        {
          name: 'Scrum Foundation',
          issuer: 'CertifPro',
          verificationUrl: 'https://example.org/c/1',
          credentialId: 'EJ-1',
          expiresAt: '2029-06',
        },
        {
          name: 'Cloud',
          issuer: 'Nube',
          verificationUrl: null,
          credentialId: null,
          expiresAt: null,
        },
      ] as CuratedProfileOutput['certifications'],
      ...overrides,
    });

  it('forma de D2: ProfilePage con url, name, description e inLanguage, y el Person en mainEntity', () => {
    const html = render(full());
    const ld = jsonLd(html);
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: 'https://manuel.dev/tech-lead-dotnet',
      name: 'Tech Lead .NET · Ada Ejemplo',
      description: 'Liderazgo técnico y arquitectura .NET.',
      inLanguage: 'es',
    });
    expect(ld?.url).toBe(/<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]);
    expect(ld?.name).toBe(/<title>(.*)<\/title>/.exec(html)?.[1]);
    expect(Object.keys(person(html))).toEqual([
      '@type',
      '@id',
      'url',
      'name',
      'jobTitle',
      'email',
      'address',
      'sameAs',
      'knowsAbout',
      'alumniOf',
      'hasCredential',
    ]);
    expect(person(html)).toMatchObject({
      '@type': 'Person',
      name: 'Ada Ejemplo',
      jobTitle: '14 años en .NET',
      email: 'mailto:ada@example.com',
      address: { '@type': 'PostalAddress', addressLocality: 'Santa Cruz' },
      sameAs: ['https://github.com/ada'],
    });
  });

  it('el Person tiene el mismo @id y la misma url en todos los perfiles; inLanguage sigue al idioma', () => {
    const home = person(render(output({ slug: 'all' })));
    const otro = person(render(output(), 'en'));
    expect(home['@id']).toBe('https://manuel.dev/#person');
    expect(home.url).toBe('https://manuel.dev/');
    expect(otro['@id']).toBe(home['@id']);
    expect(otro.url).toBe(home.url);
    expect(jsonLd(render(output(), 'en'))?.inLanguage).toBe('en');
  });

  it('knowsAbout: sin repetidos (sin distinguir mayúsculas), en orden y con la primera escritura', () => {
    expect(person(render(full())).knowsAbout).toEqual(['TypeScript', 'C#', 'Docker']);
  });

  it('knowsAbout se corta en 50', () => {
    const skills = Array.from({ length: 70 }, (_, i) => `Skill ${i + 1}`);
    const html = render(full({ skillCategories: [{ name: 'Todo', skills }] }));
    const knows = person(html).knowsAbout as string[];
    expect(knows).toHaveLength(KNOWS_ABOUT_MAX);
    expect(knows).toEqual(skills.slice(0, 50));
  });

  it('alumniOf: una organización por institución distinta; el título no entra', () => {
    expect(person(render(full())).alumniOf).toEqual([
      { '@type': 'EducationalOrganization', name: 'Universidad Ejemplo' },
      { '@type': 'EducationalOrganization', name: 'Instituto Muestra' },
    ]);
  });

  it('hasCredential: con campos de credencial y sin claves nulas cuando faltan', () => {
    expect(person(render(full())).hasCredential).toEqual([
      {
        '@type': 'EducationalOccupationalCredential',
        name: 'Scrum Foundation',
        recognizedBy: { '@type': 'Organization', name: 'CertifPro' },
        url: 'https://example.org/c/1',
        identifier: 'EJ-1',
        expires: '2029-06',
      },
      {
        '@type': 'EducationalOccupationalCredential',
        name: 'Cloud',
        recognizedBy: { '@type': 'Organization', name: 'Nube' },
      },
    ]);
    expect(render(full())).not.toContain('null');
  });

  it('sin la sección o sin datos, las listas se omiten (nunca [] ni null)', () => {
    const oculto = person(render(full({ sections: ['hero'] })));
    expect(oculto).not.toHaveProperty('knowsAbout');
    expect(oculto).not.toHaveProperty('alumniOf');
    expect(oculto).not.toHaveProperty('hasCredential');

    const vacio = person(
      render(output({ sections: ['skills', 'education', 'certifications'], socialLinks: [] })),
    );
    expect(Object.keys(vacio)).toEqual([
      '@type',
      '@id',
      'url',
      'name',
      'jobTitle',
      'email',
      'address',
    ]);
  });

  it('sin fecha de edición (preview de un borrador) no emite dateModified, ni nunca dateCreated', () => {
    const html = render(full({ updatedAt: null }));
    expect(html).not.toContain('dateModified');
    expect(html).not.toContain('dateCreated');
    expect(render(full({ updatedAt: '2026-01-15T12:00:00.000Z' }))).not.toContain('dateCreated');
  });

  it('dateModified: el día UTC de updatedAt, entre inLanguage y mainEntity (D6, D8)', () => {
    const ld = jsonLd(render(full({ updatedAt: '2026-01-15T12:00:00.000Z' })));
    expect(ld?.dateModified).toBe('2026-01-15');
    expect(Object.keys(ld ?? {})).toEqual([
      '@context',
      '@type',
      'url',
      'name',
      'description',
      'inLanguage',
      'dateModified',
      'mainEntity',
    ]);
  });

  it('dateModified usa el día UTC aunque la hora caiga tarde: 23:30 UTC sigue siendo ese día', () => {
    expect(jsonLd(render(full({ updatedAt: '2026-03-01T23:30:00.000Z' })))?.dateModified).toBe(
      '2026-03-01',
    );
  });

  it('un perfil no público no lleva el bloque, y sin perfil base tampoco', () => {
    expect(
      headMetaFromProfile(output({ visibility: 'PROTECTED' }), 'es', BASE).jsonLd,
    ).toBeUndefined();
    expect(render(output({ visibility: 'PROTECTED' }))).not.toContain('application/ld+json');
    expect(render(output({ visibility: 'PRIVATE' }))).not.toContain('application/ld+json');
    expect(render(output({ profile: null }))).not.toContain('application/ld+json');
  });

  it('golden: el <script> completo de un caso chico, con el escape de D8', () => {
    const html = render(
      output({
        slug: 'all',
        title: 'T',
        headline: 'H',
        description: 'A & B <C>',
        socialLinks: [],
      }),
    );
    expect(SCRIPT.exec(html)?.[0]).toBe(
      String.raw`<script type="application/ld+json">{"@context":"https://schema.org","@type":"ProfilePage","url":"https://manuel.dev/","name":"T · Ada Ejemplo","description":"A \u0026 B \u003cC\u003e","inLanguage":"es","mainEntity":{"@type":"Person","@id":"https://manuel.dev/#person","url":"https://manuel.dev/","name":"Ada Ejemplo","jobTitle":"H","email":"mailto:ada@example.com","address":{"@type":"PostalAddress","addressLocality":"Santa Cruz"}}}</script>`,
    );
  });

  it('un título que intenta cerrar el script deja </script una sola vez y se recupera al parsear', () => {
    const titulo = '</script><script>alert(1)</script>';
    const html = render(full({ title: titulo }));
    expect(html.match(/<\/script/g)).toHaveLength(1);
    expect(html).not.toContain('<script>alert(1)');
    expect(jsonLd(html)?.name).toBe(`${titulo} · Ada Ejemplo`);
  });

  it('una skill con & y <> y los separadores U+2028 y U+2029 salen escapados y vuelven iguales', () => {
    const skills = ['C# & <F#>', 'a\u2028b', 'c\u2029d'];
    const html = render(full({ skillCategories: [{ name: 'X', skills }] }));
    const raw = SCRIPT.exec(html)?.[1] ?? '';
    expect(raw).not.toMatch(/[<>&\u2028\u2029]/);
    expect(raw).toContain(String.raw`C# \u0026 \u003cF#\u003e`);
    expect(raw).toContain(String.raw`a\u2028b`);
    expect(person(html).knowsAbout).toEqual(skills);
  });
});
