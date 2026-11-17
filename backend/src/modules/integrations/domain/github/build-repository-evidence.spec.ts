import { RepositoryEvidence } from '../../../featured-repository/domain/value-objects/repository-evidence';
import {
  buildOkEvidence,
  buildProblemEvidence,
  evidenceChanged,
} from './build-repository-evidence';
import { projectGithubLanguages, projectGithubRepository } from './project-github-repository';

const KEY = 'portafolio-ejemplo-ficticio/reservas-api';
const T1 = new Date('2026-11-15T10:00:00Z');
const T2 = new Date('2026-11-16T10:00:00Z');

const repository = projectGithubRepository({
  full_name: 'Portafolio-Ejemplo-Ficticio/Reservas-API',
  stargazers_count: 12,
  language: 'Java',
  topics: ['api'],
  pushed_at: '2026-10-30T12:00:00Z',
  description: 'API de reservas',
});
const languages = projectGithubLanguages({ Java: 8200, CSS: 1200 });

describe('buildOkEvidence', () => {
  it('sin evidencia previa: contenido nuevo con verifiedAt y changedAt iguales a ahora', () => {
    const evidence = buildOkEvidence({
      repoKey: KEY,
      repository,
      languages,
      existing: null,
      now: T1,
    });
    expect(evidence).toMatchObject({
      repoKey: KEY,
      status: 'OK',
      stars: 12,
      primaryLanguage: 'Java',
      languages: { Java: 8200, CSS: 1200 },
      topics: ['api'],
      archived: false,
      isFork: false,
      movedTo: null,
      githubDescription: 'API de reservas',
    });
    expect(evidence.pushedAt?.toISOString()).toBe('2026-10-30T12:00:00.000Z');
    expect(evidence.verifiedAt).toEqual(T1);
    expect(evidence.changedAt).toEqual(T1);
  });

  it('el mismo contenido solo mueve verifiedAt: changedAt y los datos quedan idénticos', () => {
    const first = buildOkEvidence({ repoKey: KEY, repository, languages, existing: null, now: T1 });
    const second = buildOkEvidence({
      repoKey: KEY,
      repository,
      languages,
      existing: first,
      now: T2,
    });
    expect(second.verifiedAt).toEqual(T2);
    expect(second.changedAt).toEqual(T1);
    expect({ ...second, verifiedAt: T1 }).toEqual(first);
    expect(evidenceChanged(first, second)).toBe(false);
  });

  it('un cambio de stars avanza changedAt', () => {
    const first = buildOkEvidence({ repoKey: KEY, repository, languages, existing: null, now: T1 });
    const more = projectGithubRepository({ ...repository, stargazers_count: 13 });
    const second = buildOkEvidence({
      repoKey: KEY,
      repository: more,
      languages,
      existing: first,
      now: T2,
    });
    expect(second.changedAt).toEqual(T2);
    expect(evidenceChanged(first, second)).toBe(true);
  });

  it('un full_name distinto del pedido queda en movedTo (D5)', () => {
    const moved = projectGithubRepository({ ...repository, full_name: 'otro-dueno/reservas-v2' });
    const evidence = buildOkEvidence({
      repoKey: KEY,
      repository: moved,
      languages,
      existing: null,
      now: T1,
    });
    expect(evidence.movedTo).toBe('otro-dueno/reservas-v2');
  });

  it('con tipos inesperados guarda stars nulas sin fallar', () => {
    const odd = projectGithubRepository({ full_name: KEY, stargazers_count: 'doce' });
    const evidence = buildOkEvidence({
      repoKey: KEY,
      repository: odd,
      languages: {},
      existing: null,
      now: T1,
    });
    expect(evidence.stars).toBeNull();
    expect(evidence.status).toBe('OK');
  });
});

describe('buildProblemEvidence', () => {
  const ok: RepositoryEvidence = buildOkEvidence({
    repoKey: KEY,
    repository,
    languages,
    existing: null,
    now: T1,
  });

  it('sin evidencia previa los datos quedan vacíos', () => {
    const evidence = buildProblemEvidence({
      repoKey: KEY,
      status: 'NOT_FOUND',
      existing: null,
      now: T1,
    });
    expect(evidence).toMatchObject({
      status: 'NOT_FOUND',
      stars: null,
      topics: [],
      languages: null,
    });
  });

  it('conserva los datos anteriores y cambia status y verifiedAt', () => {
    const evidence = buildProblemEvidence({
      repoKey: KEY,
      status: 'PRIVATE',
      existing: ok,
      now: T2,
    });
    expect(evidence).toMatchObject({ status: 'PRIVATE', stars: 12, primaryLanguage: 'Java' });
    expect(evidence.verifiedAt).toEqual(T2);
    expect(evidence.changedAt).toEqual(T2);
  });

  it('el mismo problema otra vez solo mueve verifiedAt', () => {
    const first = buildProblemEvidence({
      repoKey: KEY,
      status: 'NOT_FOUND',
      existing: ok,
      now: T1,
    });
    const second = buildProblemEvidence({
      repoKey: KEY,
      status: 'NOT_FOUND',
      existing: first,
      now: T2,
    });
    expect(second.changedAt).toEqual(T1);
    expect(second.verifiedAt).toEqual(T2);
  });
});
