/* eslint-disable @typescript-eslint/require-await -- dobles asíncronos sin I/O real */
import { FakeClock } from '../../../../../test/support/integrations-doubles';
import { SnapshotRecord, SnapshotRepository } from '../../domain/repositories/snapshot.repository';
import { canonicalJson, SnapshotStoreService } from './snapshot-store.service';

const T0 = new Date('2026-11-12T12:00:00.000Z');

function make() {
  const rows = new Map<string, SnapshotRecord>();
  const writes: string[] = [];
  const repo: SnapshotRepository = {
    find: async (provider, key) => rows.get(`${provider}:${key}`) ?? null,
    replace: async (record, at) => {
      writes.push('replace');
      rows.set(`${record.provider}:${record.resourceKey}`, {
        ...record,
        fetchedAt: at,
        changedAt: at,
      });
    },
    touch: async (provider, key, at, etag) => {
      writes.push('touch');
      const row = rows.get(`${provider}:${key}`);
      if (row)
        rows.set(`${provider}:${key}`, {
          ...row,
          fetchedAt: at,
          etag: etag === undefined ? row.etag : etag,
        });
    },
  };
  const clock = new FakeClock(T0);
  return { store: new SnapshotStoreService(repo, clock), rows, writes, clock };
}

describe('SnapshotStoreService', () => {
  it('canonicalJson ordena las claves: el mismo contenido da el mismo texto', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(
      canonicalJson({ a: [{ c: 2, d: 1 }], b: 1 }),
    );
  });

  it('el primer record guarda con changed: true', async () => {
    const { store, rows } = make();
    const result = await store.record('fake', 'items', { etag: 'W/"1"', body: { n: 1 } });
    expect(result).toEqual({ ok: true, value: { changed: true } });
    expect(rows.get('fake:items')?.etag).toBe('W/"1"');
  });

  it('el mismo contenido solo mueve fetchedAt y etag, con changed: false', async () => {
    const { store, rows, clock, writes } = make();
    await store.record('fake', 'items', { etag: 'a', body: { n: 1, m: 2 } });
    clock.advance(1000);
    const result = await store.record('fake', 'items', { etag: 'b', body: { m: 2, n: 1 } });
    expect(result).toEqual({ ok: true, value: { changed: false } });
    expect(writes).toEqual(['replace', 'touch']);
    expect(rows.get('fake:items')?.etag).toBe('b');
    expect(rows.get('fake:items')?.changedAt).toEqual(T0);
    expect(rows.get('fake:items')?.fetchedAt).toEqual(new Date(T0.getTime() + 1000));
  });

  it('un cuerpo distinto reemplaza y marca changed: true', async () => {
    const { store } = make();
    await store.record('fake', 'items', { body: { n: 1 } });
    const result = await store.record('fake', 'items', { body: { n: 2 } });
    expect(result).toEqual({ ok: true, value: { changed: true } });
  });

  it('un 304 (recordNotModified) mueve solo fetchedAt', async () => {
    const { store, rows, writes } = make();
    await store.record('fake', 'items', { etag: 'a', body: { n: 1 } });
    await store.recordNotModified('fake', 'items', new Date(T0.getTime() + 5000));
    expect(writes).toEqual(['replace', 'touch']);
    expect(rows.get('fake:items')?.etag).toBe('a');
    expect(rows.get('fake:items')?.fetchedAt).toEqual(new Date(T0.getTime() + 5000));
  });

  it('un cuerpo de más de 1 MiB es Permanent y no escribe', async () => {
    const { store, writes } = make();
    const result = await store.record('fake', 'big', {
      body: { text: 'x'.repeat(1024 * 1024 + 1) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ kind: 'Permanent' });
    expect(writes).toEqual([]);
  });

  it('get devuelve etag, cuerpo y fetchedAt para mandar If-None-Match', async () => {
    const { store } = make();
    expect(await store.get('fake', 'items')).toBeNull();
    await store.record('fake', 'items', { etag: 'e', body: { n: 1 } });
    expect(await store.get('fake', 'items')).toEqual({ etag: 'e', body: { n: 1 }, fetchedAt: T0 });
  });
});
