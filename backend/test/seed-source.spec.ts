import * as fs from 'fs';
import * as path from 'path';
import { SECTION_IDS } from '../src/modules/curated-profile/domain/services/resolve-sections';
import {
  buildSyntheticViews,
  CreatedIds,
  expectedCounts,
  parseSeedSource,
  refDisplayName,
  resolveRefs,
  SeedSource,
} from '../scripts/lib/seed-source';

/**
 * Formato de la fuente del seed (change `add-learning-guide-and-example-data`, D3, D5, D7):
 * validación completa y referencias, sin base de datos.
 */
const cvDataPath = path.resolve(__dirname, '../../docs/cv-data.json');
type Mutable = Record<string, unknown>;
const cvData = (): Mutable => JSON.parse(fs.readFileSync(cvDataPath, 'utf-8')) as Mutable;
const templates = (d: Mutable): Mutable[] => d['profileTemplates'] as Mutable[];

/** Devuelve las rutas con error de una fuente derivada de cv-data.json. */
function errorPaths(mutate: (d: Mutable) => void): string[] {
  const d = cvData();
  mutate(d);
  const r = parseSeedSource(d);
  return r.ok ? [] : r.error.map((e) => e.path);
}

describe('parseSeedSource', () => {
  it('acepta docs/cv-data.json tal cual', () => {
    expect(parseSeedSource(cvData()).ok).toBe(true);
  });

  it('rechaza una raíz que no es un objeto', () => {
    expect(parseSeedSource([])).toEqual({
      ok: false,
      error: [{ path: '(raíz)', message: 'debe ser un objeto' }],
    });
  });

  it('nombra el campo obligatorio que falta', () => {
    expect(errorPaths((d) => delete (d['profile'] as Mutable)['email'])).toContain('profile.email');
  });

  it('rechaza un texto bilingüe sin español', () => {
    expect(
      errorPaths((d) => {
        templates(d)[0]['title'] = { en: 'Only English' };
      }),
    ).toContain('profileTemplates[0].title.es');
  });

  it('acepta un texto bilingüe sin inglés (es lo que detecta el aviso de faltantes)', () => {
    const d = cvData();
    templates(d)[0]['description'] = { es: 'Solo español' };
    expect(parseSeedSource(d).ok).toBe(true);
  });

  it('rechaza un id de sección fuera del catálogo y uno repetido', () => {
    const paths = errorPaths((d) => {
      templates(d)[2]['sectionsOrder'] = ['hero', 'inventada', 'hero'];
    });
    expect(paths).toContain('profileTemplates[2].sectionsOrder[1]');
    expect(paths).toContain('profileTemplates[2].sectionsOrder[2]');
  });

  it('rechaza sectionsHidden fuera del catálogo', () => {
    expect(
      errorPaths((d) => {
        templates(d)[0]['sectionsHidden'] = ['nada'];
      }),
    ).toContain('profileTemplates[0].sectionsHidden[0]');
  });

  describe('credencial de las certificaciones (add-certification-verification, D9)', () => {
    const cert = (d: Mutable): Mutable => (d['certifications'] as Mutable[])[0];

    it('acepta la credencial completa, los campos en null y la ausencia de los tres', () => {
      const d = cvData();
      Object.assign(cert(d), {
        year: '2021',
        verificationUrl: 'https://example.org/c/1',
        credentialId: 'EJ-1',
        expiresAt: '2029-06',
      });
      expect(parseSeedSource(d).ok).toBe(true);
      Object.assign(cert(d), { verificationUrl: null, credentialId: null, expiresAt: null });
      expect(parseSeedSource(d).ok).toBe(true);
    });

    it.each([
      ['http://example.org/c/1', 'verificationUrl'],
      ['javascript:alert(1)', 'verificationUrl'],
      ['/c/1', 'verificationUrl'],
    ])('rechaza la URL %p nombrando el campo', (value, field) => {
      expect(errorPaths((d) => Object.assign(cert(d), { [field]: value }))).toEqual([
        `certifications[0].${field}`,
      ]);
    });

    it('rechaza un ID de 101 caracteres, un vencimiento mal formado y uno anterior al año', () => {
      expect(errorPaths((d) => Object.assign(cert(d), { credentialId: 'x'.repeat(101) }))).toEqual([
        'certifications[0].credentialId',
      ]);
      expect(errorPaths((d) => Object.assign(cert(d), { expiresAt: '06/2029' }))).toEqual([
        'certifications[0].expiresAt',
      ]);
      expect(
        errorPaths((d) => Object.assign(cert(d), { year: '2023', expiresAt: '2022-12' })),
      ).toEqual(['certifications[0].expiresAt']);
    });

    it('rechaza un valor que no es texto', () => {
      expect(errorPaths((d) => Object.assign(cert(d), { credentialId: 42 }))).toEqual([
        'certifications[0].credentialId',
      ]);
    });
  });

  it('rechaza slugs que no son kebab-case y slugs repetidos', () => {
    const paths = errorPaths((d) => {
      templates(d)[0]['slug'] = 'Con Espacios';
      templates(d)[2]['slug'] = templates(d)[1]['slug'];
    });
    expect(paths).toContain('profileTemplates[0].slug');
    expect(paths).toContain('profileTemplates[2].slug');
  });

  it('reserva el slug all', () => {
    expect(
      errorPaths((d) => {
        templates(d)[0]['slug'] = 'all';
      }),
    ).toContain('profileTemplates[0].slug');
  });

  it('rechaza alias inválidos, que repiten un slug o que repiten otro alias', () => {
    const d = cvData();
    templates(d)[0]['slugAliases'] = ['alias-ok', 'No Valido', templates(d)[1]['slug']];
    templates(d)[2]['slugAliases'] = ['alias-ok'];
    const r = parseSeedSource(d);
    expect(r.ok).toBe(false);
    const paths = r.ok ? [] : r.error.map((e) => e.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'profileTemplates[0].slugAliases[1]',
        'profileTemplates[0].slugAliases[2]',
        'profileTemplates[2].slugAliases[0]',
      ]),
    );
    expect(paths).not.toContain('profileTemplates[0].slugAliases[0]');
  });

  it('exige accessToken en un perfil PROTECTED', () => {
    expect(
      errorPaths((d) => {
        templates(d)[3]['visibility'] = 'PROTECTED';
      }),
    ).toContain('profileTemplates[3].accessToken');
  });

  it('acepta un PROTECTED con accessToken', () => {
    const d = cvData();
    templates(d)[3]['visibility'] = 'PROTECTED';
    templates(d)[3]['accessToken'] = 'token-de-prueba';
    expect(parseSeedSource(d).ok).toBe(true);
  });

  it('rechaza visibility, layout y theme desconocidos', () => {
    const paths = errorPaths((d) => {
      templates(d)[0]['visibility'] = 'SECRET';
      templates(d)[0]['layout'] = 'grid';
      templates(d)[0]['theme'] = 'neon';
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        'profileTemplates[0].visibility',
        'profileTemplates[0].layout',
        'profileTemplates[0].theme',
      ]),
    );
  });

  it('rechaza ids de experiencia repetidos', () => {
    const paths = errorPaths((d) => {
      const exps = d['experiences'] as Mutable[];
      exps[1]['id'] = exps[0]['id'];
    });
    expect(paths).toContain('experiences[1].id');
  });

  it('rechaza exampleViews sobre un perfil inexistente o con conteos inválidos', () => {
    const paths = errorPaths((d) => {
      d['exampleViews'] = [{ slug: 'nada', count: 0, daysBack: 1, locales: [], referrers: [] }];
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        'exampleViews[0].slug',
        'exampleViews[0].count',
        'exampleViews[0].locales',
        'exampleViews[0].referrers',
      ]),
    );
  });

  it('acepta skills como objeto { name, tags } y tags por categoría', () => {
    const d = cvData();
    const cats = d['skillCategories'] as Mutable[];
    cats[0]['tags'] = ['a'];
    cats[0]['skills'] = ['Plana', { name: 'Con tags', tags: ['b'] }];
    expect(parseSeedSource(d).ok).toBe(true);
  });
});

const repo = (changes: Mutable = {}): Mutable => ({
  name: 'reservas-api',
  url: 'https://github.com/octo-org/reservas-api',
  language: 'Java',
  description: { es: 'API', en: 'API' },
  tags: ['java'],
  technologies: ['Spring Boot'],
  visible: true,
  ...changes,
});
const withRepos =
  (...repos: Mutable[]) =>
  (d: Mutable): void => {
    (d['profile'] as Mutable)['featuredRepositories'] = repos;
  };

describe('repositorios destacados (add-featured-repositories, D2 y D14)', () => {
  it('una URL de gitlab se rechaza nombrando el campo', () => {
    const r = parseSeedSource(
      (() => {
        const d = cvData();
        withRepos(repo({ url: 'https://gitlab.com/a/b' }))(d);
        return d;
      })(),
    );
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.error.map((e) => e.path)).toEqual(['profile.featuredRepositories[0].url']);
  });

  it.each([
    'https://github.com/a/b/',
    'https://github.com/a/b.git',
    'http://github.com/a/b',
    'https://github.com/a',
  ])('rechaza %s', (url) => {
    expect(errorPaths(withRepos(repo({ url })))).toEqual(['profile.featuredRepositories[0].url']);
  });

  it('rechaza dos repositorios con el mismo owner/repo sin distinguir mayúsculas', () => {
    expect(
      errorPaths(
        withRepos(repo(), repo({ name: 'otro', url: 'https://github.com/OCTO-org/Reservas-API' })),
      ),
    ).toEqual(['profile.featuredRepositories[1].url']);
  });

  it('rechaza un id repetido y valida los límites del nombre', () => {
    expect(
      errorPaths(
        withRepos(
          repo({ id: 'a' }),
          repo({ id: 'a', name: 'n'.repeat(101), url: 'https://github.com/octo-org/otro' }),
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        'profile.featuredRepositories[1].id',
        'profile.featuredRepositories[1].name',
      ]),
    );
  });

  it('acepta un archivo con stars y sin id', () => {
    const d = cvData();
    withRepos(repo({ stars: 12 }))(d);
    expect(parseSeedSource(d).ok).toBe(true);
  });

  it('acepta stars que no es un número: la clave se ignora (polish-pre-deploy-cleanup, D3)', () => {
    const d = cvData();
    withRepos(repo({ stars: 'muchas' }))(d);
    expect(parseSeedSource(d).ok).toBe(true);
  });

  it('repository:<id> se resuelve con el id del archivo y rechaza uno inexistente', () => {
    const ok = cvData();
    withRepos(repo({ id: 'reservas' }))(ok);
    templates(ok)[0]['includeRefs'] = ['repository:reservas'];
    expect(parseSeedSource(ok).ok).toBe(true);

    const missing = cvData();
    withRepos(repo({ id: 'reservas' }))(missing);
    templates(missing)[0]['includeRefs'] = ['repository:no-existe'];
    const r = parseSeedSource(missing);
    expect(r).toEqual({
      ok: false,
      error: [
        {
          path: 'profileTemplates[0].includeRefs[0]',
          message: 'no existe repository:no-existe',
        },
      ],
    });
  });

  it('expectedCounts cuenta todos los repositorios, también los ocultos', () => {
    const d = cvData();
    withRepos(repo({ id: 'a' }), repo({ url: 'https://github.com/octo-org/b', visible: false }))(d);
    const parsed = parseSeedSource(d);
    if (!parsed.ok) throw new Error('debe ser válido');
    expect(expectedCounts(parsed.value, 5).FeaturedRepository).toBe(2);
  });

  it('refDisplayName usa el nombre del repositorio', () => {
    const d = cvData();
    withRepos(repo({ id: 'a' }))(d);
    const parsed = parseSeedSource(d);
    if (!parsed.ok) throw new Error('debe ser válido');
    expect(refDisplayName('repository:a', parsed.value)).toBe('repository:reservas-api');
    expect(refDisplayName('repository:zz', parsed.value)).toBeNull();
  });
});

describe('referencias de overrides (D7)', () => {
  const sourceWith = (refs: Partial<Record<'includeRefs' | 'excludeRefs', string[]>>): Mutable => {
    const d = cvData();
    Object.assign(templates(d)[0], refs);
    return d;
  };
  const firstExpId = (): string => (cvData()['experiences'] as Mutable[])[0]['id'] as string;
  const firstProjectId = (): string => (cvData()['projects'] as Mutable[])[0]['id'] as string;
  const firstSkill = (): string =>
    ((cvData()['skillCategories'] as Mutable[])[0]['skills'] as string[])[0];

  it('acepta experience:, project: y skill: que existen', () => {
    const d = sourceWith({
      includeRefs: [`experience:${firstExpId()}`, `project:${firstProjectId()}`],
      excludeRefs: [`skill:${firstSkill()}`],
    });
    expect(parseSeedSource(d).ok).toBe(true);
  });

  it('rechaza una referencia inexistente nombrando la plantilla y la referencia', () => {
    const r = parseSeedSource(sourceWith({ includeRefs: ['project:no-existe'] }));
    expect(r).toEqual({
      ok: false,
      error: [
        { path: 'profileTemplates[0].includeRefs[0]', message: 'no existe project:no-existe' },
      ],
    });
  });

  it('rechaza un prefijo desconocido', () => {
    expect(parseSeedSource(sourceWith({ excludeRefs: ['education:uno'] })).ok).toBe(false);
  });

  it('rechaza una skill ambigua (repetida en dos categorías)', () => {
    const d = sourceWith({ includeRefs: ['skill:Repetida'] });
    const cats = d['skillCategories'] as Mutable[];
    cats[0]['skills'] = ['Repetida'];
    cats[1]['skills'] = [{ name: 'Repetida' }];
    const r = parseSeedSource(d);
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.error[0].message).toContain('ambigua');
  });

  it('acepta una referencia a un ítem con visible: false', () => {
    const d = sourceWith({ includeRefs: [`experience:${firstExpId()}`] });
    (d['experiences'] as Mutable[])[0]['visible'] = false;
    expect(parseSeedSource(d).ok).toBe(true);
  });

  it('resolveRefs traduce cada referencia al id generado', () => {
    const created: CreatedIds = {
      experience: new Map([['atlas', 'cuid-exp']]),
      project: new Map([['web', 'cuid-pro']]),
      repository: new Map([['api', 'cuid-repo']]),
      skill: new Map([['Java', 'cuid-skill']]),
    };
    expect(
      resolveRefs(['experience:atlas', 'project:web', 'repository:api', 'skill:Java'], created),
    ).toEqual(['cuid-exp', 'cuid-pro', 'cuid-repo', 'cuid-skill']);
    expect(() => resolveRefs(['experience:otra'], created)).toThrow('Referencia sin resolver');
  });

  it('refDisplayName usa la empresa, el proyecto o la skill', () => {
    const parsed = parseSeedSource(cvData());
    if (!parsed.ok) throw new Error('cv-data.json debe ser válido');
    const source: SeedSource = parsed.value;
    expect(refDisplayName(`experience:${firstExpId()}`, source)).toBe(
      `experience:${source.experiences[0].company}`,
    );
    expect(refDisplayName('skill:Java', source)).toBe('skill:Java');
  });
});

describe('expectedCounts', () => {
  it('cv-data.json no tiene alias ni visitas', () => {
    const parsed = parseSeedSource(cvData());
    if (!parsed.ok) throw new Error('cv-data.json debe ser válido');
    const counts = expectedCounts(parsed.value, 5);
    expect(counts['CuratedProfileSlugAlias']).toBe(0);
    expect(counts['ProfileView']).toBe(0);
    expect(counts['CuratedProfile']).toBe(14);
  });
});

describe('buildSyntheticViews (D8)', () => {
  const now = new Date('2026-10-27T15:30:00.000Z');
  const views = buildSyntheticViews(
    {
      slug: 'x',
      count: 7,
      daysBack: 3,
      locales: ['es', 'en'],
      referrers: [null, 'https://a.example.com'],
    },
    now,
  );

  it('genera count visitas con la marca del seed y sin IP', () => {
    expect(views).toHaveLength(7);
    expect(views.every((v) => v.userAgent === 'example-seed' && v.ipHash === null)).toBe(true);
  });

  it('reparte los días con i % daysBack, a las 12:00 UTC', () => {
    expect(views.map((v) => v.viewedAt.toISOString().slice(0, 10))).toEqual([
      '2026-10-27',
      '2026-10-26',
      '2026-10-25',
      '2026-10-27',
      '2026-10-26',
      '2026-10-25',
      '2026-10-27',
    ]);
    expect(views[0].viewedAt.toISOString()).toBe('2026-10-27T12:00:00.000Z');
  });

  it('alterna idiomas y orígenes por índice', () => {
    expect(views.map((v) => v.locale)).toEqual(['es', 'en', 'es', 'en', 'es', 'en', 'es']);
    expect(views.map((v) => v.referrer)).toEqual([
      null,
      'https://a.example.com',
      null,
      'https://a.example.com',
      null,
      'https://a.example.com',
      null,
    ]);
  });

  it('no deja visitas en el futuro si todavía no son las 12:00 UTC', () => {
    const early = new Date('2026-10-27T08:00:00.000Z');
    const v = buildSyntheticViews(
      { slug: 'x', count: 1, daysBack: 1, locales: ['es'], referrers: [null] },
      early,
    );
    expect(v[0].viewedAt.getTime()).toBeLessThanOrEqual(early.getTime());
  });
});

it('el catálogo de secciones es de 10 ids', () => {
  expect(SECTION_IDS).toHaveLength(10);
});
