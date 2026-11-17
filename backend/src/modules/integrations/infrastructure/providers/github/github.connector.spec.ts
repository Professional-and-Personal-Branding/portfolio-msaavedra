import { CapturingLogger } from '../../../../../../test/support/integrations-doubles';
import { ok } from '../../../../../shared/domain/result';
import {
  SyncGithubEvidenceInput,
  SyncGithubEvidenceService,
} from '../../../application/github/sync-github-evidence.service';
import { SnapshotStore } from '../../../application/ports/snapshot-store.port';
import { PROVIDER_CATALOG } from '../../../domain/provider-catalog';
import { GithubConnector } from './github.connector';

describe('GithubConnector', () => {
  it('tiene el id y la variable del catálogo', () => {
    const connector = new GithubConnector({} as SyncGithubEvidenceService);
    expect(connector.id).toBe(PROVIDER_CATALOG.github.id);
    expect(connector.secretEnv).toBe(PROVIDER_CATALOG.github.secretEnv);
  });

  it('pasa el secreto, los snapshots, el logger y la señal del trabajo al servicio', async () => {
    const received: SyncGithubEvidenceInput[] = [];
    const execute = jest.fn((input: SyncGithubEvidenceInput) => {
      received.push(input);
      return Promise.resolve(ok({ itemsChanged: 2 }));
    });
    const connector = new GithubConnector({ execute } as unknown as SyncGithubEvidenceService);
    const snapshots = {} as SnapshotStore;
    const log = new CapturingLogger();
    const controller = new AbortController();

    const result = await connector.sync(
      { jobId: 'j1', provider: 'github', payload: {}, secret: 's3cr3t', snapshots, log },
      controller.signal,
    );

    expect(result).toEqual({ ok: true, value: { itemsChanged: 2 } });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(received[0]).toEqual({
      secret: 's3cr3t',
      snapshots,
      log,
      signal: controller.signal,
    });
    expect(received[0].signal).toBe(controller.signal);
  });
});
