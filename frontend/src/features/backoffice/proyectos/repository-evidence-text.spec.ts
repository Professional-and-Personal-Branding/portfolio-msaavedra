import { describe, expect, it } from 'vitest';
import { makeAdminEvidence } from '@/test/fixtures/admin';
import { makeIntegrations, makeIntegrationStatus } from '@/test/fixtures/integrations';
import { evidenceBadge, githubSyncWarning, movedNotice } from './repository-evidence-text';

describe('evidenceBadge', () => {
  it('sin evidencia o con la URL cambiada: «Sin verificar»', () => {
    expect(evidenceBadge(null)).toMatchObject({ text: 'Sin verificar', tone: 'pending' });
    expect(evidenceBadge(makeAdminEvidence({ stale: true }))).toMatchObject({
      text: 'Sin verificar',
    });
  });

  it('cada estado tiene su texto literal', () => {
    expect(evidenceBadge(makeAdminEvidence({ status: 'NOT_FOUND' })).text).toBe(
      'No encontrado en GitHub',
    );
    expect(evidenceBadge(makeAdminEvidence({ status: 'INACCESSIBLE' })).text).toBe(
      'GitHub no da acceso',
    );
    expect(evidenceBadge(makeAdminEvidence({ status: 'PRIVATE' })).text).toBe(
      'Privado: no se publica',
    );
    expect(evidenceBadge(makeAdminEvidence())).toEqual({
      text: 'Verificado el 16 nov 2026',
      tone: 'ok',
    });
  });
});

describe('movedNotice', () => {
  it('pide actualizar la URL solo si GitHub lo movió y la evidencia vale', () => {
    expect(movedNotice(makeAdminEvidence({ movedTo: 'a/b' }))).toBe(
      'GitHub lo movió a a/b: actualizá la URL',
    );
    expect(movedNotice(makeAdminEvidence())).toBeNull();
    expect(movedNotice(makeAdminEvidence({ movedTo: 'a/b', stale: true }))).toBeNull();
    expect(movedNotice(null)).toBeNull();
  });
});

describe('githubSyncWarning', () => {
  it('sin datos o sin github habilitado: nada', () => {
    expect(githubSyncWarning(undefined)).toBeNull();
    expect(githubSyncWarning(makeIntegrations([]))).toBeNull();
    expect(
      githubSyncWarning(
        makeIntegrations([
          makeIntegrationStatus({
            provider: 'fake',
            jobs: { pending: 0, running: 0, failed: 0, dead: 3 },
          }),
        ]),
      ),
    ).toBeNull();
  });

  it('con trabajos muertos usa el último error', () => {
    const warning = githubSyncWarning(
      makeIntegrations([
        makeIntegrationStatus({
          provider: 'github',
          jobs: { pending: 0, running: 0, failed: 0, dead: 1 },
          lastDeadError: 'token vencido',
        }),
      ]),
    );
    expect(warning).toBe(
      'La última sincronización con GitHub falló: token vencido. Se siguen mostrando los datos verificados por última vez.',
    );
  });

  it('atrasado y sin error cae a un texto genérico', () => {
    expect(
      githubSyncWarning(
        makeIntegrations([makeIntegrationStatus({ provider: 'github', stale: true })]),
      ),
    ).toContain('sin sincronizar hace más de 48 h');
  });
});
