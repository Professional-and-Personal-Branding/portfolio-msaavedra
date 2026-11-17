import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  githubRepositoryKey,
  parseGithubRepositoryUrl,
} from '../../../featured-repository/domain/services/parse-github-repository-url';
import { RepositoryEvidence } from '../../../featured-repository/domain/value-objects/repository-evidence';
import {
  buildOkEvidence,
  buildProblemEvidence,
  evidenceChanged,
  RepositoryProblem,
} from '../../domain/github/build-repository-evidence';
import {
  classifyGithubResponse,
  GithubVerdict,
  quotaReserveFailure,
} from '../../domain/github/classify-github-response';
import {
  GithubRepositoryProjection,
  projectGithubLanguages,
  projectGithubRepository,
} from '../../domain/github/project-github-repository';
import { ProviderFailure, transient } from '../../../../shared/domain/provider-failure/provider-failure';
import { RunLogger } from '../ports/run-logger.port';
import { SnapshotStore, StoredSnapshot } from '../ports/snapshot-store.port';
import { SyncOutcome } from '../ports/connector.port';
import { CODE_EVIDENCE_STORE, CodeEvidenceStore, EvidenceTarget } from './code-evidence-store.port';
import { GITHUB_API, GithubApi, GithubResponse } from './github-api.port';

export const GITHUB_PROVIDER = 'github';
/** Tope de repositorios por trabajo (D3): 50 × 2 peticiones = 100 como máximo por día. */
export const MAX_REPOSITORIES_PER_SYNC = 50;

export interface SyncGithubEvidenceInput {
  readonly secret: string;
  readonly snapshots: SnapshotStore;
  readonly log: RunLogger;
  readonly signal: AbortSignal;
}

interface ParsedTarget {
  readonly target: EvidenceTarget;
  readonly owner: string;
  readonly repo: string;
  readonly key: string;
}

interface RepoOutcome {
  readonly changed: boolean;
  /** Reserva de cuota alcanzada con la última respuesta: se detiene el trabajo DESPUÉS de grabar. */
  readonly stop: ProviderFailure | null;
}

interface Answer {
  readonly response: GithubResponse;
  readonly verdict: GithubVerdict;
}

const repoResource = (key: string): string => `repo:${key}`;
const languagesResource = (key: string): string => `languages:${key}`;

/**
 * Sincroniza la evidencia de código de los repositorios destacados contra GitHub (change
 * `add-github-code-evidence`, D3 a D8). EN SERIE, siempre autorizado y condicional; graba cada
 * repositorio antes de pasar al siguiente, así un fallo a mitad de camino conserva lo hecho. No
 * conoce Nest-HTTP ni Prisma: habla con el puerto `GithubApi` y con `CodeEvidenceStore`.
 */
@Injectable()
export class SyncGithubEvidenceService {
  constructor(
    @Inject(GITHUB_API) private readonly api: GithubApi,
    @Inject(CODE_EVIDENCE_STORE) private readonly store: CodeEvidenceStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: SyncGithubEvidenceInput): Promise<Result<SyncOutcome, ProviderFailure>> {
    const all = this.parseTargets(await this.store.listTargets());
    const targets = all.slice(0, MAX_REPOSITORIES_PER_SYNC);
    if (all.length > targets.length) {
      input.log.warn(
        'Hay más repositorios que el tope por sincronización: se procesan los primeros',
        {
          total: all.length,
          processed: targets.length,
        },
      );
    }

    let itemsChanged = 0;
    for (const target of targets) {
      if (input.signal.aborted) return fail(transient('sincronización abortada'));
      const outcome = await this.syncRepository(target, input);
      if (!outcome.ok) return fail(outcome.error);
      if (outcome.value.changed) itemsChanged += 1;
      if (outcome.value.stop) return fail(outcome.value.stop);
    }

    // Solo si terminaron todos: una corrida cortada no borra snapshots que la próxima necesita.
    await this.store.pruneSnapshots(
      all.flatMap((parsed) => [repoResource(parsed.key), languagesResource(parsed.key)]),
    );
    input.log.info('Evidencia de GitHub sincronizada', {
      repositories: targets.length,
      itemsChanged,
    });
    return ok({ itemsChanged });
  }

  /** Ordena por `order` e `id`, descarta URLs que no parsean y claves repetidas. */
  private parseTargets(targets: readonly EvidenceTarget[]): ParsedTarget[] {
    const seen = new Set<string>();
    const parsed: ParsedTarget[] = [];
    // Primero los visibles y después los ocultos (cada grupo por `order` e `id`): los ocultos no
    // desplazan a los visibles dentro del tope (revisión de seguridad B2, enmienda de D3).
    const sorted = [...targets].sort(
      (a, b) =>
        Number(b.visible) - Number(a.visible) ||
        a.order - b.order ||
        a.featuredRepositoryId.localeCompare(b.featuredRepositoryId),
    );
    for (const target of sorted) {
      const url = parseGithubRepositoryUrl(target.url);
      if (!url.ok) continue;
      const key = githubRepositoryKey(url.value.owner, url.value.repo);
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push({ target, owner: url.value.owner, repo: url.value.repo, key });
    }
    return parsed;
  }

  private async request(
    path: string,
    snapshot: StoredSnapshot | null,
    input: SyncGithubEvidenceInput,
  ): Promise<Result<Answer, ProviderFailure>> {
    const result = await this.api.get(path, {
      etag: snapshot?.etag ?? null,
      token: input.secret,
      signal: input.signal,
    });
    if (!result.ok) return fail(result.error);
    const response = result.value;
    const remaining = response.headers['x-ratelimit-remaining'];
    if (remaining !== undefined) input.log.debug('Cuota de GitHub', { remaining, path });
    return ok({ response, verdict: classifyGithubResponse(response, this.clock.now()) });
  }

  private async syncRepository(
    parsed: ParsedTarget,
    input: SyncGithubEvidenceInput,
  ): Promise<Result<RepoOutcome, ProviderFailure>> {
    const { target, owner, repo, key } = parsed;
    const stored = await this.store.find(target.featuredRepositoryId);
    // Evidencia de OTRO repositorio (la URL cambió): no se arrastra nada de ella.
    const existing = stored && stored.repoKey === key ? stored : null;

    const repoSnapshot = await input.snapshots.get(GITHUB_PROVIDER, repoResource(key));
    const first = await this.request(`/repos/${owner}/${repo}`, repoSnapshot, input);
    if (!first.ok) return fail(first.error);
    const { response: repoResponse, verdict: repoVerdict } = first.value;
    if (repoVerdict.kind === 'job') return fail(repoVerdict.failure);
    if (repoVerdict.kind === 'repo') {
      return this.saveProblem(target, key, repoVerdict.status, existing, repoResponse);
    }

    let repository: GithubRepositoryProjection;
    if (repoVerdict.kind === 'notModified') {
      if (!repoSnapshot) return fail(transient('GitHub respondió 304 sin un snapshot previo'));
      repository = projectGithubRepository(repoSnapshot.body);
    } else {
      repository = projectGithubRepository(repoResponse.body);
    }
    // Un repositorio privado no se publica ni se guarda su cuerpo: solo queda el estado.
    if (repository.private === true) {
      return this.saveProblem(target, key, 'PRIVATE', existing, repoResponse);
    }
    const reserve = quotaReserveFailure(repoResponse.headers);
    if (reserve) return fail(reserve);

    const languagesSnapshot = await input.snapshots.get(GITHUB_PROVIDER, languagesResource(key));
    const second = await this.request(
      `/repos/${owner}/${repo}/languages`,
      languagesSnapshot,
      input,
    );
    if (!second.ok) return fail(second.error);
    const { response: languagesResponse, verdict: languagesVerdict } = second.value;
    if (languagesVerdict.kind === 'job') return fail(languagesVerdict.failure);
    if (languagesVerdict.kind === 'repo') {
      return this.saveProblem(target, key, languagesVerdict.status, existing, languagesResponse);
    }
    if (languagesVerdict.kind === 'notModified' && !languagesSnapshot) {
      return fail(transient('GitHub respondió 304 sin un snapshot previo'));
    }
    const languages = projectGithubLanguages(
      languagesVerdict.kind === 'notModified' ? languagesSnapshot?.body : languagesResponse.body,
    );

    const recorded = await this.recordSnapshots(key, input.snapshots, {
      repoResponse,
      repoVerdict,
      repository,
      languagesResponse,
      languagesVerdict,
      languages,
    });
    if (!recorded.ok) return fail(recorded.error);

    const now = this.clock.now();
    const evidence = buildOkEvidence({ repoKey: key, repository, languages, existing, now });
    return this.save(target, existing, evidence, quotaReserveFailure(languagesResponse.headers));
  }

  /** Guarda los dos snapshots: el cuerpo (reducido) con un 200 y solo `fetchedAt` con un 304. */
  private async recordSnapshots(
    key: string,
    snapshots: SnapshotStore,
    data: {
      repoResponse: GithubResponse;
      repoVerdict: GithubVerdict;
      repository: GithubRepositoryProjection;
      languagesResponse: GithubResponse;
      languagesVerdict: GithubVerdict;
      languages: Readonly<Record<string, number>>;
    },
  ): Promise<Result<true, ProviderFailure>> {
    const now = this.clock.now();
    if (data.repoVerdict.kind === 'notModified') {
      await snapshots.recordNotModified(GITHUB_PROVIDER, repoResource(key), now);
    } else {
      const saved = await snapshots.record(GITHUB_PROVIDER, repoResource(key), {
        etag: data.repoResponse.headers.etag ?? null,
        body: data.repository,
      });
      if (!saved.ok) return fail(saved.error);
    }
    if (data.languagesVerdict.kind === 'notModified') {
      await snapshots.recordNotModified(GITHUB_PROVIDER, languagesResource(key), now);
    } else {
      const saved = await snapshots.record(GITHUB_PROVIDER, languagesResource(key), {
        etag: data.languagesResponse.headers.etag ?? null,
        body: data.languages,
      });
      if (!saved.ok) return fail(saved.error);
    }
    return ok(true);
  }

  private async saveProblem(
    target: EvidenceTarget,
    key: string,
    status: RepositoryProblem,
    existing: RepositoryEvidence | null,
    response: GithubResponse,
  ): Promise<Result<RepoOutcome, ProviderFailure>> {
    const evidence = buildProblemEvidence({
      repoKey: key,
      status,
      existing,
      now: this.clock.now(),
    });
    return this.save(target, existing, evidence, quotaReserveFailure(response.headers));
  }

  private async save(
    target: EvidenceTarget,
    existing: RepositoryEvidence | null,
    evidence: RepositoryEvidence,
    stop: ProviderFailure | null,
  ): Promise<Result<RepoOutcome, ProviderFailure>> {
    const saved = await this.store.save(target.featuredRepositoryId, evidence);
    // El repositorio se borró mientras corría: no hay nada que contar.
    return ok({ changed: saved && evidenceChanged(existing, evidence), stop });
  }
}
