import { beforeEach, describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import {
  applyDocumentMeta,
  DEFAULT_META,
  metaFromProfile,
  profilePageJsonLd,
  restoreDocumentMeta,
} from './document-meta';

const ORIGIN = 'https://portafolio.example.com';

const content = (selector: string) =>
  document.head.querySelector<HTMLMetaElement>(selector)?.content;

describe('metaFromProfile', () => {
  it('arma título, descripción y canonical del perfil', () => {
    const data = makeCuratedProfile({ slug: 'tech-lead-dotnet', title: 'Tech Lead .NET' });
    const meta = metaFromProfile(data, 'es', ORIGIN);

    expect(meta.title).toBe('Tech Lead .NET · Ada Ejemplo');
    expect(meta.description).toBe('Vista completa de la trayectoria.');
    expect(meta.canonical).toBe(`${ORIGIN}/tech-lead-dotnet`);
    expect(meta.noindex).toBe(false);
  });

  it('el perfil `all` es la home', () => {
    expect(metaFromProfile(makeCuratedProfile({ slug: 'all' }), 'es', ORIGIN).canonical).toBe(
      `${ORIGIN}/`,
    );
  });

  it('marca noindex los perfiles que no son públicos', () => {
    for (const visibility of ['PRIVATE', 'PROTECTED'] as const) {
      expect(metaFromProfile(makeCuratedProfile({ visibility }), 'es', ORIGIN).noindex).toBe(true);
    }
  });

  it('cae al titular o al resumen cuando no hay descripción, y recorta', () => {
    const sinDescripcion = makeCuratedProfile({ description: '', headline: 'Un titular' });
    expect(metaFromProfile(sinDescripcion, 'es', ORIGIN).description).toBe('Un titular');

    const larga = makeCuratedProfile({ description: 'x'.repeat(400) });
    const meta = metaFromProfile(larga, 'es', ORIGIN);
    expect(meta.description.length).toBeLessThanOrEqual(300);
    expect(meta.description.endsWith('…')).toBe(true);
  });
});

describe('profilePageJsonLd', () => {
  const jsonLd = (overrides = {}, locale: 'es' | 'en' = 'es') => {
    const data = makeCuratedProfile({ slug: 'tech-lead-dotnet', ...overrides });
    return metaFromProfile(data, locale, ORIGIN).jsonLd;
  };
  const person = (overrides = {}) =>
    (jsonLd(overrides)?.mainEntity ?? {}) as Record<string, unknown>;

  it('es un ProfilePage con el Person en mainEntity', () => {
    const ld = jsonLd();

    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: `${ORIGIN}/tech-lead-dotnet`,
      inLanguage: 'es',
      mainEntity: {
        '@type': 'Person',
        '@id': `${ORIGIN}/#person`,
        url: `${ORIGIN}/`,
        name: 'Ada Ejemplo',
        email: 'mailto:ada@example.com',
      },
    });
    expect(person().sameAs).toEqual([
      'https://github.com/ada',
      'https://linkedin.com/in/ada-ejemplo',
    ]);
  });

  it('name y description son los del título y la meta, y no hay fechas', () => {
    const data = makeCuratedProfile({ slug: 'tech-lead-dotnet', title: 'Backend' });
    const meta = metaFromProfile(data, 'en', ORIGIN);

    expect(meta.jsonLd).toMatchObject({
      url: meta.canonical,
      name: meta.title,
      description: meta.description,
      inLanguage: 'en',
    });
    expect(JSON.stringify(meta.jsonLd)).not.toMatch(/dateModified|dateCreated/);
  });

  it('el @id y la url del Person son los mismos en todos los perfiles', () => {
    const home = metaFromProfile(makeCuratedProfile({ slug: 'all' }), 'es', ORIGIN).jsonLd;
    const otro = jsonLd();
    expect((home?.mainEntity as Record<string, unknown>)['@id']).toBe(
      (otro?.mainEntity as Record<string, unknown>)['@id'],
    );
    expect((home?.mainEntity as Record<string, unknown>).url).toBe(`${ORIGIN}/`);
  });

  it('knowsAbout sale de las skills de la vista, sin repetidos y hasta 50', () => {
    const skills = Array.from({ length: 70 }, (_, i) => `Skill ${i + 1}`);
    const knows = person({
      skillCategories: [
        { name: 'A', skills: ['TypeScript', 'typescript'] },
        { name: 'B', skills },
      ],
    }).knowsAbout as string[];

    expect(knows).toHaveLength(50);
    expect(knows.slice(0, 3)).toEqual(['TypeScript', 'Skill 1', 'Skill 2']);
  });

  it('con las secciones ocultas el Person no trae knowsAbout, alumniOf ni hasCredential', () => {
    const oculto = person({ sections: ['hero', 'contact'] });
    expect(oculto).not.toHaveProperty('knowsAbout');
    expect(oculto).not.toHaveProperty('alumniOf');
    expect(oculto).not.toHaveProperty('hasCredential');
  });

  it('sin perfil base no genera nada', () => {
    const data = makeCuratedProfile({ profile: null });
    const ctx = {
      title: 't',
      description: 'd',
      canonical: `${ORIGIN}/`,
      locale: 'es' as const,
      origin: ORIGIN,
    };
    expect(profilePageJsonLd(data, ctx)).toBeUndefined();
    expect(metaFromProfile(data, 'es', ORIGIN).jsonLd).toBeUndefined();
  });

  it('un perfil no público no lleva JSON-LD (noindex)', () => {
    for (const visibility of ['PRIVATE', 'PROTECTED'] as const) {
      expect(jsonLd({ visibility })).toBeUndefined();
    }
  });
});

describe('applyDocumentMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    restoreDocumentMeta();
  });

  it('escribe título, descripción, OpenGraph, Twitter, canonical y JSON-LD', () => {
    applyDocumentMeta(metaFromProfile(makeCuratedProfile({ title: 'Backend' }), 'es', ORIGIN));

    expect(document.title).toBe('Backend · Ada Ejemplo');
    expect(document.documentElement.lang).toBe('es');
    expect(content('meta[name="description"]')).toBe('Vista completa de la trayectoria.');
    expect(content('meta[property="og:title"]')).toBe('Backend · Ada Ejemplo');
    expect(content('meta[property="og:url"]')).toBe(`${ORIGIN}/`);
    expect(content('meta[property="og:locale"]')).toBe('es_ES');
    expect(content('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      `${ORIGIN}/`,
    );

    const jsonLd = document.head.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(jsonLd?.textContent ?? '{}')).toMatchObject({
      '@type': 'ProfilePage',
      mainEntity: { '@type': 'Person' },
    });
  });

  it('con ?via= y ?src= en la URL, canonical y og:url no llevan query', () => {
    window.history.replaceState({}, '', '/tech-lead-dotnet?via=k7m2q9xw4t&src=linkedin&lang=en');
    try {
      applyDocumentMeta(
        metaFromProfile(makeCuratedProfile({ slug: 'tech-lead-dotnet' }), 'en', ORIGIN),
      );

      expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
        `${ORIGIN}/tech-lead-dotnet`,
      );
      expect(content('meta[property="og:url"]')).toBe(`${ORIGIN}/tech-lead-dotnet`);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('al cambiar de idioma actualiza los metadatos sin duplicar etiquetas', () => {
    const data = makeCuratedProfile();
    applyDocumentMeta(metaFromProfile(data, 'es', ORIGIN));
    applyDocumentMeta(metaFromProfile(data, 'en', ORIGIN));

    expect(document.documentElement.lang).toBe('en');
    expect(content('meta[property="og:locale"]')).toBe('en_US');
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it('un perfil protegido se marca noindex', () => {
    applyDocumentMeta(
      metaFromProfile(makeCuratedProfile({ visibility: 'PROTECTED' }), 'es', ORIGIN),
    );
    expect(content('meta[name="robots"]')).toBe('noindex, nofollow');
  });

  // add-server-rendered-head: el head puede llegar ya poblado por el fragmento del servidor.
  const SERVER_HEAD = `
    <title>Servidor · Ada</title>
    <meta name="description" content="del servidor" />
    <link rel="canonical" href="${ORIGIN}/otro" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="Servidor · Ada" />
    <meta property="og:description" content="del servidor" />
    <meta property="og:url" content="${ORIGIN}/otro" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:type" content="profile" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Servidor · Ada" />
    <meta name="twitter:description" content="del servidor" />
    <script type="application/ld+json">{"@type":"Person","name":"Servidor"}</script>`;

  const KEYS = [
    'meta[name="description"]',
    'meta[name="robots"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:url"]',
    'meta[property="og:locale"]',
    'meta[property="og:type"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'link[rel="canonical"]',
    'script[type="application/ld+json"]',
  ];
  const expectOnePerKey = () => {
    for (const key of KEYS) expect(document.head.querySelectorAll(key), key).toHaveLength(1);
  };

  it('sobre un head del servidor reutiliza sus etiquetas: exactamente una por clave', () => {
    document.head.innerHTML = SERVER_HEAD;
    applyDocumentMeta(
      metaFromProfile(
        makeCuratedProfile({ slug: 'tech-lead-dotnet', title: 'Backend' }),
        'es',
        ORIGIN,
      ),
    );

    expectOnePerKey();
    expect(content('meta[property="og:title"]')).toBe('Backend · Ada Ejemplo');
    expect(content('meta[name="description"]')).toBe('Vista completa de la trayectoria.');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      `${ORIGIN}/tech-lead-dotnet`,
    );
    const jsonLd = document.head.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(jsonLd?.textContent ?? '{}')).toMatchObject({
      '@type': 'ProfilePage',
      name: 'Backend · Ada Ejemplo',
      mainEntity: { name: 'Ada Ejemplo' },
    });
  });

  it('un perfil PROTECTED con token quita el bloque que trajo el servidor y no escribe ninguno', () => {
    document.head.innerHTML = SERVER_HEAD;
    applyDocumentMeta(
      metaFromProfile(makeCuratedProfile({ visibility: 'PROTECTED' }), 'es', ORIGIN),
    );

    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
    expect(content('meta[name="robots"]')).toBe('noindex, nofollow');
  });

  it('al aplicar dos perfiles seguidos queda un solo bloque, con la url del segundo', () => {
    applyDocumentMeta(metaFromProfile(makeCuratedProfile({ slug: 'all' }), 'es', ORIGIN));
    applyDocumentMeta(
      metaFromProfile(makeCuratedProfile({ slug: 'tech-lead-dotnet' }), 'es', ORIGIN),
    );

    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0]?.textContent ?? '{}')).toMatchObject({
      '@type': 'ProfilePage',
      url: `${ORIGIN}/tech-lead-dotnet`,
    });
  });

  it('pasar de un perfil público a uno protegido quita el bloque del anterior', () => {
    applyDocumentMeta(metaFromProfile(makeCuratedProfile(), 'es', ORIGIN));
    applyDocumentMeta(
      metaFromProfile(makeCuratedProfile({ visibility: 'PROTECTED' }), 'es', ORIGIN),
    );
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('navegar entre perfiles deja una etiqueta por clave con los valores del nuevo', () => {
    document.head.innerHTML = SERVER_HEAD;
    applyDocumentMeta(
      metaFromProfile(makeCuratedProfile({ slug: 'a', title: 'Uno' }), 'es', ORIGIN),
    );
    applyDocumentMeta(
      metaFromProfile(makeCuratedProfile({ slug: 'b', title: 'Dos' }), 'es', ORIGIN),
    );

    expectOnePerKey();
    expect(content('meta[property="og:title"]')).toBe('Dos · Ada Ejemplo');
    expect(content('meta[property="og:url"]')).toBe(`${ORIGIN}/b`);
  });

  it('las etiquetas del servidor que el cliente reescribe quedan marcadas como gestionadas', () => {
    document.head.innerHTML = SERVER_HEAD;
    applyDocumentMeta(metaFromProfile(makeCuratedProfile(), 'es', ORIGIN));
    for (const key of KEYS) {
      expect(document.head.querySelector(key)?.hasAttribute('data-managed-meta'), key).toBe(true);
    }
  });

  it('con el head vacío (desarrollo, sin borde) las crea, una por clave', () => {
    applyDocumentMeta(metaFromProfile(makeCuratedProfile(), 'es', ORIGIN));
    expectOnePerKey();
  });

  it('restaurar limpia solo las etiquetas gestionadas', () => {
    document.head.innerHTML = '<meta name="viewport" content="width=device-width">';
    applyDocumentMeta(metaFromProfile(makeCuratedProfile(), 'es', ORIGIN));

    restoreDocumentMeta();

    expect(document.title).toBe(DEFAULT_META.title);
    expect(document.head.querySelector('meta[property="og:title"]')).toBeNull();
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
    // La etiqueta que venía en index.html sigue ahí.
    expect(document.head.querySelector('meta[name="viewport"]')).not.toBeNull();
  });
});
