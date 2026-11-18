/* eslint-disable @typescript-eslint/require-await -- dobles asíncronos sin I/O real */
/**
 * Dobles en memoria para probar la sincronización de GitHub (change `add-github-code-evidence`)
 * sin red, sin base y sin tokens: una «API» con ETag y 304, un almacén de evidencia y un
 * repositorio de snapshots.
 */
import {
  GithubApi,
  GithubRequest,
  GithubResponse,
} from '../../src/modules/integrations/application/github/github-api.port';
import {
  CodeEvidenceStore,
  EvidenceTarget,
} from '../../src/modules/integrations/application/github/code-evidence-store.port';
import { ok, Result } from '../../src/shared/domain/result';
import { ProviderFailure } from '../../src/shared/domain/provider-failure/provider-failure';
import { RepositoryEvidence } from '../../src/modules/featured-repository/domain/value-objects/repository-evidence';
import {
  SnapshotRecord,
  SnapshotRepository,
} from '../../src/modules/integrations/domain/repositories/snapshot.repository';

export type ScriptedAnswer = Result<GithubResponse, ProviderFailure>;

interface Resource {
  body: unknown;
  version: number;
  headers: Record<string, string>;
}

/** Cabeceras de cuota sanas: 4900 peticiones restantes. */
export const HEALTHY_HEADERS: Readonly<Record<string, string>> = {
  'x-ratelimit-remaining': '4900',
  'x-ratelimit-reset': '1795000000',
};

/**
 * «GitHub» en memoria. `publish(path, body)` crea o cambia un recurso (sube su versión y por lo
 * tanto su ETag); `get` responde 200 con ETag o 304 si `If-None-Match` coincide. `script` fuerza
 * una respuesta puntual. Mide las peticiones simultáneas.
 */
export class ScriptedGithubApi implements GithubApi {
  readonly calls: Array<{ path: string; etag: string | null; token: string }> = [];
  maxInFlight = 0;
  private inFlight = 0;
  private readonly resources = new Map<string, Resource>();
  private readonly scripted = new Map<string, () => ScriptedAnswer>();

  publish(path: string, body: unknown, headers: Record<string, string> = {}): void {
    const current = this.resources.get(path);
    this.resources.set(path, {
      body,
      version: (current?.version ?? 0) + 1,
      headers: { ...HEALTHY_HEADERS, ...headers },
    });
  }

  /** Respuesta forzada para una ruta (gana sobre `publish`). */
  script(path: string, answer: () => ScriptedAnswer): void {
    this.scripted.set(path, answer);
  }

  reply(
    status: number,
    headers: Record<string, string> = {},
    body?: unknown,
  ): () => ScriptedAnswer {
    return () => ok({ status, headers: { ...HEALTHY_HEADERS, ...headers }, body });
  }

  pathsRequested(): string[] {
    return this.calls.map((call) => call.path);
  }

  async get(path: string, request: GithubRequest): Promise<ScriptedAnswer> {
    this.calls.push({ path, etag: request.etag ?? null, token: request.token });
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      // Cede el turno: si alguien pidiera en paralelo, `maxInFlight` lo vería.
      await new Promise<void>((resolve) => setImmediate(resolve));
      const forced = this.scripted.get(path);
      if (forced) return forced();
      const resource = this.resources.get(path);
      if (!resource) return ok({ status: 404, headers: { ...HEALTHY_HEADERS }, body: {} });
      const etag = `"v${resource.version}"`;
      if (request.etag === etag) {
        return ok({ status: 304, headers: { ...resource.headers, etag }, body: undefined });
      }
      return ok({ status: 200, headers: { ...resource.headers, etag }, body: resource.body });
    } finally {
      this.inFlight -= 1;
    }
  }
}

/** Almacén de evidencia en memoria; `removed` simula un repositorio borrado a mitad de corrida. */
export class InMemoryEvidenceStore implements CodeEvidenceStore {
  targets: EvidenceTarget[] = [];
  readonly evidence = new Map<string, RepositoryEvidence>();
  readonly saves: Array<{ id: string; evidence: RepositoryEvidence }> = [];
  readonly pruned: Array<readonly string[]> = [];
  readonly removed = new Set<string>();

  async listTargets(): Promise<EvidenceTarget[]> {
    return this.targets.map((target) => ({ ...target }));
  }
  async find(id: string): Promise<RepositoryEvidence | null> {
    return this.evidence.get(id) ?? null;
  }
  async save(id: string, evidence: RepositoryEvidence): Promise<boolean> {
    if (this.removed.has(id)) return false;
    this.saves.push({ id, evidence });
    this.evidence.set(id, evidence);
    return true;
  }
  async pruneSnapshots(keep: readonly string[]): Promise<void> {
    this.pruned.push(keep);
  }
}

export class InMemorySnapshotRepository implements SnapshotRepository {
  readonly rows = new Map<string, SnapshotRecord>();
  async find(provider: string, resourceKey: string): Promise<SnapshotRecord | null> {
    return this.rows.get(`${provider}:${resourceKey}`) ?? null;
  }
  async replace(record: Omit<SnapshotRecord, 'fetchedAt' | 'changedAt'>, at: Date): Promise<void> {
    this.rows.set(`${record.provider}:${record.resourceKey}`, {
      ...record,
      fetchedAt: at,
      changedAt: at,
    });
  }
  async touch(
    provider: string,
    resourceKey: string,
    at: Date,
    etag?: string | null,
  ): Promise<void> {
    const row = this.rows.get(`${provider}:${resourceKey}`);
    if (row) {
      this.rows.set(`${provider}:${resourceKey}`, {
        ...row,
        fetchedAt: at,
        etag: etag === undefined ? row.etag : etag,
      });
    }
  }
}
