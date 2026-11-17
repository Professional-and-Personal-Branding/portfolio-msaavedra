import { Injectable } from '@nestjs/common';
import { Result } from '../../../../../shared/domain/result';
import { ConnectorPort, SyncContext, SyncOutcome } from '../../../application/ports/connector.port';
import { SyncGithubEvidenceService } from '../../../application/github/sync-github-evidence.service';
import { ProviderFailure } from '../../../../../shared/domain/provider-failure/provider-failure';

/**
 * Conector del proveedor `github` (change `add-github-code-evidence`, D2): solo adapta
 * `ConnectorPort` al servicio de aplicación, que orquesta las peticiones y graba la evidencia.
 */
@Injectable()
export class GithubConnector implements ConnectorPort {
  readonly id = 'github';
  readonly secretEnv: string | null = 'GITHUB_SYNC_TOKEN';

  constructor(private readonly service: SyncGithubEvidenceService) {}

  sync(ctx: SyncContext, signal: AbortSignal): Promise<Result<SyncOutcome, ProviderFailure>> {
    return this.service.execute({
      secret: ctx.secret,
      snapshots: ctx.snapshots,
      log: ctx.log,
      signal,
    });
  }
}
