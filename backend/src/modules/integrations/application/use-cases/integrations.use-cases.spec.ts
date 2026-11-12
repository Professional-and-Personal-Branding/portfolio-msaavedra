/* eslint-disable @typescript-eslint/require-await -- dobles asíncronos sin I/O real */
import { ValidationError } from '../../../../shared/domain/errors';
import {
  CapturingLoggerFactory,
  FakeClock,
  FakeCredentialResolver,
  InMemoryJobRepository,
  InMemorySettingRepository,
  InMemorySyncRunRepository,
  makeJob,
} from '../../../../../test/support/integrations-doubles';
import {
  CredentialFromEnvError,
  ProviderDisabledError,
  UnknownProviderError,
} from '../../domain/errors/integration.errors';
import { CredentialRepository } from '../../domain/repositories/credential.repository';
import { SecretCipher } from '../ports/secret-cipher.port';
import { IntegrationStatusReader } from '../services/integration-status.reader';
import { DeleteCredentialUseCase } from './delete-credential.use-case';
import { EnqueueSyncUseCase } from './enqueue-sync.use-case';
import { ListIntegrationsUseCase } from './list-integrations.use-case';
import { PlanDueSyncsUseCase } from './plan-due-syncs.use-case';
import { SaveCredentialUseCase } from './save-credential.use-case';
import { SetIntegrationEnabledUseCase } from './set-integration-enabled.use-case';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const HOUR = 3_600_000;
const SETTINGS = {
  enabledProviders: ['fake'],
  schedulerEnabled: false,
  jobTimeoutMs: 120_000,
  runMaxMs: 300_000,
};

function base() {
  const clock = new FakeClock(NOW);
  const jobs = new InMemoryJobRepository(clock);
  const settings = new InMemorySettingRepository(clock);
  const syncRuns = new InMemorySyncRunRepository();
  const credentials = new FakeCredentialResolver();
  const loggers = new CapturingLoggerFactory();
  return { clock, jobs, settings, syncRuns, credentials, loggers };
}

describe('EnqueueSyncUseCase', () => {
  it('encola con la clave manual del minuto y devuelve alreadyQueued: false', async () => {
    const { clock, jobs, settings } = base();
    const useCase = new EnqueueSyncUseCase(jobs, settings, SETTINGS, clock);
    const result = await useCase.execute({ provider: 'fake' });
    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({ status: 'PENDING', alreadyQueued: false });
    const [job] = [...jobs.jobs.values()];
    expect(job.props.idempotencyKey).toBe('sync:fake:manual:2026-11-12T12:00');
  });

  it('con un trabajo activo lo devuelve con alreadyQueued: true sin insertar', async () => {
    const { clock, jobs, settings } = base();
    jobs.add(makeJob({ id: 'activo', status: 'FAILED' }));
    const useCase = new EnqueueSyncUseCase(jobs, settings, SETTINGS, clock);
    const result = await useCase.execute({ provider: 'fake' });
    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({ jobId: 'activo', alreadyQueued: true });
    expect(jobs.enqueueCalls).toBe(0);
  });

  it('con el proveedor pausado a mano da RuleViolation sin escribir', async () => {
    const { clock, jobs, settings } = base();
    await settings.saveEnabled((await settings.getOrCreate('fake', NOW)).withEnabled(false, NOW));
    const useCase = new EnqueueSyncUseCase(jobs, settings, SETTINGS, clock);
    const result = await useCase.execute({ provider: 'fake' });
    expect(!result.ok && result.error).toBeInstanceOf(ProviderDisabledError);
    expect(jobs.enqueueCalls).toBe(0);
  });

  it('un proveedor fuera de INTEGRATIONS_ENABLED es desconocido', async () => {
    const { clock, jobs, settings } = base();
    const useCase = new EnqueueSyncUseCase(jobs, settings, SETTINGS, clock);
    const result = await useCase.execute({ provider: 'github' });
    expect(!result.ok && result.error).toBeInstanceOf(UnknownProviderError);
  });
});

describe('PlanDueSyncsUseCase', () => {
  it('usa la clave diaria UTC y es idempotente', async () => {
    const { clock, jobs, settings, loggers } = base();
    const useCase = new PlanDueSyncsUseCase(jobs, settings, SETTINGS, loggers, clock);
    const first = await useCase.execute();
    const second = await useCase.execute();
    expect(first.enqueued).toEqual(['fake']);
    expect(second.enqueued).toEqual([]);
    expect([...jobs.jobs.values()].map((j) => j.props.idempotencyKey)).toEqual([
      'sync:fake:daily:2026-11-12',
    ]);
  });

  it('saltea los proveedores pausados a mano', async () => {
    const { clock, jobs, settings, loggers } = base();
    await settings.saveEnabled((await settings.getOrCreate('fake', NOW)).withEnabled(false, NOW));
    const useCase = new PlanDueSyncsUseCase(jobs, settings, SETTINGS, loggers, clock);
    await useCase.execute();
    expect(jobs.jobs.size).toBe(0);
  });

  it('llama a la purga con 30 y 90 días', async () => {
    const { clock, jobs, settings, loggers } = base();
    await new PlanDueSyncsUseCase(jobs, settings, SETTINGS, loggers, clock).execute();
    expect(jobs.purgeCalls).toEqual([{ done: 30, dead: 90 }]);
  });

  it('emite un warn por proveedor atrasado, sin secretos', async () => {
    const { clock, jobs, settings, loggers } = base();
    const stale = await settings.getOrCreate('fake', new Date(NOW.getTime() - 60 * HOUR));
    await settings.saveHealth(stale);
    const useCase = new PlanDueSyncsUseCase(jobs, settings, SETTINGS, loggers, clock);
    const out = await useCase.execute();
    expect(out.stale).toEqual(['fake']);
    const warns = loggers.logger.lines.filter((l) => l.level === 'warn');
    expect(warns).toHaveLength(1);
    expect(warns[0].data).toMatchObject({ provider: 'fake', lastSuccessAt: null });
  });
});

describe('SaveCredentialUseCase / DeleteCredentialUseCase', () => {
  function make() {
    const { credentials, loggers } = base();
    const upserts: Array<{ provider: string; ciphertext: string; keyId: string }> = [];
    const deleted: string[] = [];
    const repo = {
      upsert: async (provider: string, ciphertext: string, keyId: string) => {
        upserts.push({ provider, ciphertext, keyId });
      },
      delete: async (provider: string) => {
        deleted.push(provider);
      },
    } as unknown as CredentialRepository;
    const encrypt = jest.fn((plain: string, aad: string) => `cifrado(${aad})`);
    const cipher = { activeKeyId: 'k1', encrypt } as unknown as SecretCipher;
    credentials.description = { source: null, keyId: null, updatedAt: null };
    return { credentials, loggers, repo, cipher, encrypt, upserts, deleted };
  }

  it('cifra con el dato asociado del proveedor y guarda con la clave activa', async () => {
    const m = make();
    const useCase = new SaveCredentialUseCase(m.repo, m.credentials, m.cipher, SETTINGS, m.loggers);
    const result = await useCase.execute({ provider: 'fake', secret: 'mi-token' });
    expect(result.ok).toBe(true);
    expect(m.encrypt).toHaveBeenCalledWith('mi-token', 'integration-credential:fake');
    expect(m.upserts).toEqual([
      { provider: 'fake', ciphertext: 'cifrado(integration-credential:fake)', keyId: 'k1' },
    ]);
    expect(JSON.stringify(m.loggers.logger.lines)).not.toContain('mi-token');
  });

  it('con el secreto en una variable de entorno responde RuleViolation y no guarda', async () => {
    const m = make();
    m.credentials.description = { source: 'env', keyId: null, updatedAt: null };
    const useCase = new SaveCredentialUseCase(m.repo, m.credentials, m.cipher, SETTINGS, m.loggers);
    const result = await useCase.execute({ provider: 'fake', secret: 'x' });
    expect(!result.ok && result.error).toBeInstanceOf(CredentialFromEnvError);
    expect(m.upserts).toHaveLength(0);
  });

  it.each(['', ' con-borde ', 'x'.repeat(4097)])(
    'rechaza el secreto inválido %#',
    async (secret) => {
      const m = make();
      const useCase = new SaveCredentialUseCase(
        m.repo,
        m.credentials,
        m.cipher,
        SETTINGS,
        m.loggers,
      );
      const result = await useCase.execute({ provider: 'fake', secret });
      expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    },
  );

  it('acepta exactamente 4096 caracteres', async () => {
    const m = make();
    const useCase = new SaveCredentialUseCase(m.repo, m.credentials, m.cipher, SETTINGS, m.loggers);
    expect((await useCase.execute({ provider: 'fake', secret: 'x'.repeat(4096) })).ok).toBe(true);
  });

  it('borrar es idempotente y valida el proveedor', async () => {
    const m = make();
    const useCase = new DeleteCredentialUseCase(m.repo, SETTINGS, m.loggers);
    expect((await useCase.execute({ provider: 'fake' })).ok).toBe(true);
    expect(m.deleted).toEqual(['fake']);
    const unknown = await useCase.execute({ provider: 'github' });
    expect(!unknown.ok && unknown.error).toBeInstanceOf(UnknownProviderError);
  });
});

describe('ListIntegrationsUseCase / SetIntegrationEnabledUseCase', () => {
  function make() {
    const b = base();
    const reader = new IntegrationStatusReader(
      b.settings,
      b.jobs,
      b.syncRuns,
      b.credentials,
      b.clock,
    );
    return { ...b, reader };
  }

  it('calcula stale y arma los conteos de la cola', async () => {
    const m = make();
    await m.settings.saveHealth(
      (await m.settings.getOrCreate('fake', new Date(NOW.getTime() - 100 * HOUR))).recordSuccess(
        new Date(NOW.getTime() - 49 * HOUR),
      ),
    );
    m.jobs.add(makeJob({ id: 'p', idempotencyKey: 'p' }));
    m.jobs.add(makeJob({ id: 'd', idempotencyKey: 'd', status: 'DEAD', lastError: 'roto' }));
    const out = await new ListIntegrationsUseCase(m.reader, SETTINGS).execute();
    expect(out.schedulerEnabled).toBe(false);
    expect(out.providers).toHaveLength(1);
    expect(out.providers[0]).toMatchObject({
      provider: 'fake',
      stale: true,
      jobs: { pending: 1, running: 0, failed: 0, dead: 1 },
      lastDeadError: 'roto',
      credential: { source: 'env' },
    });
  });

  it('sin proveedores habilitados devuelve la lista vacía', async () => {
    const m = make();
    const out = await new ListIntegrationsUseCase(m.reader, {
      ...SETTINGS,
      enabledProviders: [],
    }).execute();
    expect(out.providers).toEqual([]);
  });

  it('pausar y reanudar cambian enabled', async () => {
    const m = make();
    const useCase = new SetIntegrationEnabledUseCase(m.settings, m.reader, SETTINGS, m.clock);
    const paused = await useCase.execute({ provider: 'fake', enabled: false });
    expect(paused.ok && paused.value.enabled).toBe(false);
    const resumed = await useCase.execute({ provider: 'fake', enabled: true });
    expect(resumed.ok && resumed.value.enabled).toBe(true);
    const unknown = await useCase.execute({ provider: 'github', enabled: true });
    expect(!unknown.ok && unknown.error).toBeInstanceOf(UnknownProviderError);
  });
});
