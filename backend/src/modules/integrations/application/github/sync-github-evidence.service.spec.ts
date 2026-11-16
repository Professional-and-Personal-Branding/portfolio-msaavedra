import { CapturingLogger, FakeClock } from '../../../../../test/support/integrations-doubles';
import {
  HEALTHY_HEADERS,
  InMemoryEvidenceStore,
  InMemorySnapshotRepository,
  ScriptedGithubApi,
} from '../../../../../test/support/github-doubles';
import { SnapshotStoreService } from '../services/snapshot-store.service';
import { TOKEN_REJECTED_MESSAGE } from '../../domain/github/classify-github-response';
import {
  MAX_REPOSITORIES_PER_SYNC,
  SyncGithubEvidenceService,
} from './sync-github-evidence.service';

const T0 = new Date('2026-11-16T10:00:00.000Z');
const TOKEN = 'token-de-prueba-no-real';

function repoBody(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    full_name: `octo-org/${name}`,
    private: false,
    fork: false,
    archived: false,
    stargazers_count: 5,
    watchers_count: 5,
    language: 'Java',
    topics: ['api', 'NestJS'],
    pushed_at: '2026-10-30T12:00:00Z',
    description: `Repo ${name}`,
    html_url: `https://github.com/octo-org/${name}`,
    owner: { login: 'octo-org' },
    ...extra,
  };
}

function setup(names: string[]) {
  const api = new ScriptedGithubApi();
  const store = new InMemoryEvidenceStore();
  const snapshotRows = new InMemorySnapshotRepository();
  const clock = new FakeClock(T0);
  const snapshots = new SnapshotStoreService(snapshotRows, clock);
  const log = new CapturingLogger();
  const service = new SyncGithubEvidenceService(api, store, clock);
  names.forEach((name, index) => {
    store.targets.push({
      featuredRepositoryId: `id-${name}`,
      url: `https://github.com/octo-org/${name}`,
      order: index,
    });
    api.publish(`/repos/octo-org/${name}`, repoBody(name));
    api.publish(`/repos/octo-org/${name}/languages`, { Java: 8200, CSS: 1200 });
  });
  const run = (signal: AbortSignal = new AbortController().signal) =>
    service.execute({ secret: TOKEN, snapshots, log, signal });
  return { api, store, snapshotRows, clock, log, service, run };
}

describe('SyncGithubEvidenceService (D3, D4, D6, D7, D8)', () => {
  it('sin repositorios: termina bien sin hacer peticiones', async () => {
    const { api, run } = setup([]);
    expect(await run()).toEqual({ ok: true, value: { itemsChanged: 0 } });
    expect(api.calls).toHaveLength(0);
  });

  it('la primera corrida graba stars, lenguajes y topics de cada repositorio', async () => {
    const { api, store, run } = setup(['a', 'b', 'c']);
    expect(await run()).toEqual({ ok: true, value: { itemsChanged: 3 } });
    expect(api.pathsRequested()).toEqual([
      '/repos/octo-org/a',
      '/repos/octo-org/a/languages',
      '/repos/octo-org/b',
      '/repos/octo-org/b/languages',
      '/repos/octo-org/c',
      '/repos/octo-org/c/languages',
    ]);
    expect(store.evidence.get('id-a')).toMatchObject({
      repoKey: 'octo-org/a',
      status: 'OK',
      stars: 5,
      primaryLanguage: 'Java',
      languages: { Java: 8200, CSS: 1200 },
      topics: ['api', 'nestjs'],
      verifiedAt: T0,
      changedAt: T0,
    });
  });

  it('todas las peticiones llevan el token y nunca hay dos a la vez', async () => {
    const { api, run } = setup(['a', 'b', 'c']);
    await run();
    expect(api.calls.every((call) => call.token === TOKEN)).toBe(true);
    expect(api.maxInFlight).toBe(1);
  });

  it('la segunda corrida recibe 304 en todo: 0 cambios, datos idénticos y verifiedAt posterior', async () => {
    const { api, store, snapshotRows, clock, run } = setup(['a', 'b']);
    await run();
    const before = new Map(store.evidence);
    const hashes = new Map([...snapshotRows.rows].map(([key, row]) => [key, row.contentHash]));
    api.calls.length = 0;
    clock.advance(86_400_000);

    expect(await run()).toEqual({ ok: true, value: { itemsChanged: 0 } });

    // Condicionales y autorizadas: cada petición lleva If-None-Match y el token.
    expect(api.calls).toHaveLength(4);
    expect(api.calls.every((call) => call.etag !== null && call.token === TOKEN)).toBe(true);
    for (const [id, evidence] of store.evidence) {
      const first = before.get(id);
      expect(evidence).toEqual({ ...first, verifiedAt: new Date(T0.getTime() + 86_400_000) });
      expect(evidence.changedAt).toEqual(T0);
    }
    for (const [key, row] of snapshotRows.rows) {
      expect(row.contentHash).toBe(hashes.get(key));
      expect(row.changedAt).toEqual(T0);
      expect(row.fetchedAt).toEqual(new Date(T0.getTime() + 86_400_000));
    }
  });

  it('un 200 con otro ETag pero la misma proyección (cambió watchers) cuenta 0 cambios', async () => {
    const { api, store, clock, run } = setup(['a']);
    await run();
    api.publish('/repos/octo-org/a', repoBody('a', { watchers_count: 99, updated_at: 'hoy' }));
    clock.advance(1000);
    expect(await run()).toEqual({ ok: true, value: { itemsChanged: 0 } });
    expect(store.evidence.get('id-a')?.changedAt).toEqual(T0);
  });

  it('un cambio real (más stars) cuenta 1 y avanza changedAt', async () => {
    const { api, store, clock, run } = setup(['a']);
    await run();
    api.publish('/repos/octo-org/a', repoBody('a', { stargazers_count: 6 }));
    clock.advance(1000);
    expect(await run()).toEqual({ ok: true, value: { itemsChanged: 1 } });
    expect(store.evidence.get('id-a')?.stars).toBe(6);
    expect(store.evidence.get('id-a')?.changedAt).toEqual(new Date(T0.getTime() + 1000));
  });

  it('el snapshot guarda solo la lista blanca', async () => {
    const { snapshotRows, run } = setup(['a']);
    await run();
    const body = snapshotRows.rows.get('github:repo:octo-org/a')?.body as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('owner');
    expect(Object.keys(body)).not.toContain('watchers_count');
    expect(body.stargazers_count).toBe(5);
  });

  it('un 401 en el primero detiene el trabajo como Permanent sin grabar nada', async () => {
    const { api, store, run } = setup(['a', 'b']);
    api.script('/repos/octo-org/a', api.reply(401));
    const result = await run();
    expect(result).toEqual({
      ok: false,
      error: { kind: 'Permanent', message: TOKEN_REJECTED_MESSAGE },
    });
    expect(store.saves).toHaveLength(0);
    expect(api.calls).toHaveLength(1);
  });

  it('un 503 en el segundo deja Transient con el primero ya grabado', async () => {
    const { api, store, run } = setup(['a', 'b', 'c']);
    api.script('/repos/octo-org/b', api.reply(503));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: { kind: 'Transient' } });
    expect(store.evidence.has('id-a')).toBe(true);
    expect(store.evidence.has('id-b')).toBe(false);
    expect(api.pathsRequested()).not.toContain('/repos/octo-org/c');
  });

  it('un 404 de un repo lo marca NOT_FOUND y no frena a los demás', async () => {
    const { api, store, run } = setup(['a', 'b']);
    api.script('/repos/octo-org/a', api.reply(404));
    const result = await run();
    expect(result).toEqual({ ok: true, value: { itemsChanged: 2 } });
    expect(store.evidence.get('id-a')).toMatchObject({ status: 'NOT_FOUND', stars: null });
    expect(store.evidence.get('id-b')).toMatchObject({ status: 'OK' });
    expect(api.pathsRequested()).not.toContain('/repos/octo-org/a/languages');
  });

  it('un 403 genérico es INACCESSIBLE; un 451 también', async () => {
    const { api, store, run } = setup(['a', 'b']);
    api.script('/repos/octo-org/a', api.reply(403));
    api.script('/repos/octo-org/b', api.reply(451));
    await run();
    expect(store.evidence.get('id-a')?.status).toBe('INACCESSIBLE');
    expect(store.evidence.get('id-b')?.status).toBe('INACCESSIBLE');
  });

  it('un repo que pasa a 404 conserva los datos anteriores en el panel y cambia el estado', async () => {
    const { api, store, clock, run } = setup(['a']);
    await run();
    api.script('/repos/octo-org/a', api.reply(404));
    clock.advance(1000);
    await run();
    expect(store.evidence.get('id-a')).toMatchObject({
      status: 'NOT_FOUND',
      stars: 5,
      primaryLanguage: 'Java',
    });
  });

  it('un repo privado queda PRIVATE: no pide lenguajes ni guarda snapshots', async () => {
    const { api, store, snapshotRows, run } = setup(['a']);
    api.publish('/repos/octo-org/a', repoBody('a', { private: true }));
    expect(await run()).toEqual({ ok: true, value: { itemsChanged: 1 } });
    expect(store.evidence.get('id-a')?.status).toBe('PRIVATE');
    expect(api.pathsRequested()).toEqual(['/repos/octo-org/a']);
    expect(snapshotRows.rows.size).toBe(0);
  });

  it('un repo movido guarda movedTo con el full_name nuevo', async () => {
    const { api, store, run } = setup(['a']);
    api.publish('/repos/octo-org/a', repoBody('a', { full_name: 'nuevo-dueno/a-v2' }));
    await run();
    expect(store.evidence.get('id-a')).toMatchObject({ status: 'OK', movedTo: 'nuevo-dueno/a-v2' });
  });

  describe('límite de peticiones', () => {
    it('403 con retry-after detiene el trabajo con RetryAfter', async () => {
      const { api, run } = setup(['a', 'b']);
      api.script('/repos/octo-org/b', api.reply(403, { 'retry-after': '120' }));
      expect(await run()).toMatchObject({ ok: false, error: { kind: 'RetryAfter', seconds: 120 } });
    });

    it('403 con remaining 0 detiene el trabajo con ResetAt', async () => {
      const { api, run } = setup(['a']);
      api.script(
        '/repos/octo-org/a',
        api.reply(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1795000000' }),
      );
      expect(await run()).toMatchObject({ ok: false, error: { kind: 'ResetAt' } });
    });

    it('con 40 restantes tras el primer repo no hace ninguna petición más (reserva)', async () => {
      const { api, store, run } = setup(['a', 'b']);
      api.publish('/repos/octo-org/a', repoBody('a'), { 'x-ratelimit-remaining': '40' });
      const result = await run();
      expect(result).toMatchObject({ ok: false, error: { kind: 'ResetAt' } });
      expect(api.calls).toHaveLength(1);
      expect(store.saves).toHaveLength(0);
    });

    it('si la reserva se alcanza con la respuesta de los lenguajes, graba ese repo y se detiene', async () => {
      const { api, store, run } = setup(['a', 'b']);
      api.publish('/repos/octo-org/a/languages', { Java: 10 }, { 'x-ratelimit-remaining': '10' });
      const result = await run();
      expect(result).toMatchObject({ ok: false, error: { kind: 'ResetAt' } });
      expect(store.evidence.has('id-a')).toBe(true);
      expect(api.pathsRequested()).not.toContain('/repos/octo-org/b');
    });

    it('un 404 con la cuota en la reserva graba el estado y después se detiene', async () => {
      const { api, store, run } = setup(['a', 'b']);
      api.script('/repos/octo-org/a', api.reply(404, { 'x-ratelimit-remaining': '12' }));
      const result = await run();
      expect(result).toMatchObject({ ok: false, error: { kind: 'ResetAt' } });
      expect(store.evidence.get('id-a')?.status).toBe('NOT_FOUND');
      expect(api.pathsRequested()).toEqual(['/repos/octo-org/a']);
    });

    it('con la cuota sana (4900) no se detiene', async () => {
      const { run } = setup(['a']);
      expect((await run()).ok).toBe(true);
      expect(HEALTHY_HEADERS['x-ratelimit-remaining']).toBe('4900');
    });
  });

  describe('objetivos', () => {
    it('procesa los 50 primeros y avisa del resto', async () => {
      const names = Array.from({ length: MAX_REPOSITORIES_PER_SYNC + 1 }, (_, i) => `r${i}`);
      const { api, store, log, run } = setup(names);
      await run();
      expect(store.evidence.size).toBe(50);
      expect(api.calls).toHaveLength(100);
      expect(log.lines.some((line) => line.level === 'warn')).toBe(true);
    });

    it('descarta las URLs repetidas (sin distinguir mayúsculas) y las inválidas', async () => {
      const { api, store, run } = setup(['a']);
      store.targets.push(
        { featuredRepositoryId: 'dup', url: 'https://github.com/Octo-Org/A', order: 5 },
        { featuredRepositoryId: 'bad', url: 'https://gitlab.com/octo/a', order: 6 },
      );
      await run();
      expect(api.pathsRequested()).toEqual(['/repos/octo-org/a', '/repos/octo-org/a/languages']);
    });

    it('respeta el orden por `order`', async () => {
      const { api, store, run } = setup(['a', 'b']);
      store.targets = [
        { featuredRepositoryId: 'id-b', url: 'https://github.com/octo-org/b', order: 0 },
        { featuredRepositoryId: 'id-a', url: 'https://github.com/octo-org/a', order: 1 },
      ];
      await run();
      expect(api.pathsRequested()[0]).toBe('/repos/octo-org/b');
    });

    it('al terminar poda los snapshots de lo que ya no es un objetivo', async () => {
      const { store, run } = setup(['a', 'b']);
      await run();
      expect(store.pruned).toHaveLength(1);
      expect([...store.pruned[0]].sort()).toEqual([
        'languages:octo-org/a',
        'languages:octo-org/b',
        'repo:octo-org/a',
        'repo:octo-org/b',
      ]);
    });

    it('si el trabajo falla a mitad de camino no poda', async () => {
      const { api, store, run } = setup(['a', 'b']);
      api.script('/repos/octo-org/b', api.reply(503));
      await run();
      expect(store.pruned).toHaveLength(0);
    });

    it('una URL cambiada ignora la evidencia del repo anterior', async () => {
      const { store, run } = setup(['a']);
      await run();
      store.evidence.set('id-a', {
        ...(store.evidence.get('id-a') as NonNullable<ReturnType<typeof store.evidence.get>>),
        repoKey: 'octo-org/viejo',
        stars: 999,
      });
      await run();
      expect(store.evidence.get('id-a')).toMatchObject({ repoKey: 'octo-org/a', stars: 5 });
    });

    it('un repo borrado a mitad de corrida no cuenta como cambio', async () => {
      const { store, run } = setup(['a']);
      store.removed.add('id-a');
      expect(await run()).toEqual({ ok: true, value: { itemsChanged: 0 } });
    });
  });

  it('una señal ya abortada detiene el trabajo como Transient antes de pedir nada', async () => {
    const { api, run } = setup(['a']);
    const controller = new AbortController();
    controller.abort();
    expect(await run(controller.signal)).toMatchObject({ ok: false, error: { kind: 'Transient' } });
    expect(api.calls).toHaveLength(0);
  });

  it('un fallo de red del transporte se propaga tal cual', async () => {
    const { api, run } = setup(['a']);
    api.script('/repos/octo-org/a', () => ({
      ok: false,
      error: { kind: 'Transient', message: 'timeout de 15 s' },
    }));
    expect(await run()).toEqual({
      ok: false,
      error: { kind: 'Transient', message: 'timeout de 15 s' },
    });
  });
});
