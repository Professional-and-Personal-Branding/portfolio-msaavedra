import { RepositoryEvidence } from '../value-objects/repository-evidence';
import {
  effectiveLanguage,
  isEvidenceValid,
  presentRepositoryEvidence,
} from './present-repository-evidence';

const URL = 'https://github.com/Portafolio-Ejemplo-Ficticio/Reservas-API';
const KEY = 'portafolio-ejemplo-ficticio/reservas-api';

function evidence(overrides: Partial<RepositoryEvidence> = {}): RepositoryEvidence {
  return {
    repoKey: KEY,
    status: 'OK',
    stars: 12,
    primaryLanguage: 'Java',
    languages: { Java: 8200, CSS: 1200, HTML: 600 },
    topics: ['nestjs', 'prisma'],
    pushedAt: new Date('2026-10-30T12:00:00Z'),
    archived: false,
    isFork: false,
    movedTo: null,
    githubDescription: 'API de reservas',
    verifiedAt: new Date('2026-11-16T10:00:00Z'),
    changedAt: new Date('2026-11-15T10:00:00Z'),
    ...overrides,
  };
}

const repo = (technologies: string[] = ['NestJS'], url = URL) => ({ url, technologies });

describe('presentRepositoryEvidence', () => {
  it('sin evidencia → null', () => {
    expect(presentRepositoryEvidence(repo(), null)).toBeNull();
    expect(presentRepositoryEvidence(repo(), undefined)).toBeNull();
  });

  it.each(['NOT_FOUND', 'INACCESSIBLE', 'PRIVATE'] as const)('estado %s → null', (status) => {
    expect(presentRepositoryEvidence(repo(), evidence({ status }))).toBeNull();
  });

  it('un repoKey viejo (la URL cambió) → null', () => {
    expect(presentRepositoryEvidence(repo(), evidence({ repoKey: 'otro/repo-viejo' }))).toBeNull();
  });

  it('la clave de la URL se compara en minúsculas', () => {
    expect(isEvidenceValid(URL, evidence())).toBe(true);
  });

  it('devuelve stars, fechas ISO y archivado; nunca la descripción de GitHub ni el estado', () => {
    const presented = presentRepositoryEvidence(repo(), evidence({ archived: true }));
    expect(presented).toEqual({
      stars: 12,
      languages: [
        { name: 'Java', percent: 82 },
        { name: 'CSS', percent: 12 },
        { name: 'HTML', percent: 6 },
      ],
      topics: ['prisma'],
      pushedAt: '2026-10-30T12:00:00.000Z',
      archived: true,
      verifiedAt: '2026-11-16T10:00:00.000Z',
    });
    expect(JSON.stringify(presented)).not.toContain('API de reservas');
  });

  it('stars nulas salen como 0 y sin último push queda null', () => {
    const presented = presentRepositoryEvidence(repo(), evidence({ stars: null, pushedAt: null }));
    expect(presented?.stars).toBe(0);
    expect(presented?.pushedAt).toBeNull();
  });

  describe('lenguajes', () => {
    it('hasta 3, por bytes desc, con porcentaje entero', () => {
      const presented = presentRepositoryEvidence(
        repo(),
        evidence({ languages: { A: 10, B: 40, C: 30, D: 20 } }),
      );
      expect(presented?.languages).toEqual([
        { name: 'B', percent: 40 },
        { name: 'C', percent: 30 },
        { name: 'D', percent: 20 },
      ]);
    });

    it('redondea al entero más cercano', () => {
      const presented = presentRepositoryEvidence(repo(), evidence({ languages: { A: 2, B: 1 } }));
      expect(presented?.languages).toEqual([
        { name: 'A', percent: 67 },
        { name: 'B', percent: 33 },
      ]);
    });

    it('descarta lo que redondea a 0 %', () => {
      const presented = presentRepositoryEvidence(
        repo(),
        evidence({ languages: { Java: 100_000, Roto: 1 } }),
      );
      expect(presented?.languages).toEqual([{ name: 'Java', percent: 100 }]);
    });

    it('sin lenguajes, con bytes en cero o sin mapa → lista vacía', () => {
      expect(presentRepositoryEvidence(repo(), evidence({ languages: null }))?.languages).toEqual(
        [],
      );
      expect(presentRepositoryEvidence(repo(), evidence({ languages: {} }))?.languages).toEqual([]);
      expect(
        presentRepositoryEvidence(repo(), evidence({ languages: { Java: 0 } }))?.languages,
      ).toEqual([]);
    });

    it('el empate de bytes se desempata por nombre', () => {
      const presented = presentRepositoryEvidence(repo(), evidence({ languages: { B: 5, A: 5 } }));
      expect(presented?.languages.map((l) => l.name)).toEqual(['A', 'B']);
    });
  });

  describe('topics', () => {
    it('no repiten tecnologías, sin distinguir mayúsculas', () => {
      const presented = presentRepositoryEvidence(
        repo(['NestJS']),
        evidence({ topics: ['nestjs', 'prisma'] }),
      );
      expect(presented?.topics).toEqual(['prisma']);
    });

    it('tampoco por separadores: «spring-boot» repite «Spring Boot»', () => {
      const presented = presentRepositoryEvidence(
        repo(['Spring Boot']),
        evidence({ topics: ['spring-boot', 'api'] }),
      );
      expect(presented?.topics).toEqual(['api']);
    });

    it('hasta 5', () => {
      const topics = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      expect(presentRepositoryEvidence(repo([]), evidence({ topics }))?.topics).toEqual([
        'a',
        'b',
        'c',
        'd',
        'e',
      ]);
    });
  });
});

describe('effectiveLanguage (D9)', () => {
  it('el lenguaje manual manda sobre el de GitHub', () => {
    expect(
      effectiveLanguage(
        { url: URL, language: 'TypeScript' },
        evidence({ primaryLanguage: 'JavaScript' }),
      ),
    ).toBe('TypeScript');
  });

  it('sin lenguaje manual usa el principal de GitHub', () => {
    expect(effectiveLanguage({ url: URL, language: null }, evidence())).toBe('Java');
  });

  it('un lenguaje manual vacío cuenta como ausente', () => {
    expect(effectiveLanguage({ url: URL, language: '  ' }, evidence())).toBe('Java');
  });

  it.each(['NOT_FOUND', 'INACCESSIBLE', 'PRIVATE'] as const)(
    'con evidencia %s no aporta lenguaje',
    (status) => {
      expect(effectiveLanguage({ url: URL, language: null }, evidence({ status }))).toBeNull();
    },
  );

  it('con un repoKey viejo no aporta lenguaje', () => {
    expect(
      effectiveLanguage({ url: URL, language: null }, evidence({ repoKey: 'viejo/repo' })),
    ).toBeNull();
  });

  it('sin evidencia y sin manual → null', () => {
    expect(effectiveLanguage({ url: URL, language: null }, null)).toBeNull();
  });
});
