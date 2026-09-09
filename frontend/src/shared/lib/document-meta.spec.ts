import { beforeEach, describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import {
  applyDocumentMeta,
  DEFAULT_META,
  metaFromProfile,
  personJsonLd,
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

describe('personJsonLd', () => {
  it('describe a la persona con sus enlaces', () => {
    const jsonLd = personJsonLd(makeCuratedProfile());

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ada Ejemplo',
      email: 'mailto:ada@example.com',
    });
    expect(jsonLd?.sameAs).toEqual([
      'https://github.com/ada',
      'https://linkedin.com/in/ada-ejemplo',
    ]);
  });

  it('sin perfil base no genera nada', () => {
    expect(personJsonLd(makeCuratedProfile({ profile: null }))).toBeUndefined();
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
    expect(JSON.parse(jsonLd?.textContent ?? '{}')).toMatchObject({ '@type': 'Person' });
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
