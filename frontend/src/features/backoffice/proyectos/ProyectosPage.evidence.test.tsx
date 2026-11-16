import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminEvidence, makeAdminRepository } from '@/test/fixtures/admin';
import { makeIntegrations, makeIntegrationStatus } from '@/test/fixtures/integrations';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

// add-github-code-evidence (D12): estado de verificación por repositorio y aviso del bloque.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const repo = (id: string, name: string, evidence: ReturnType<typeof makeAdminEvidence> | null) =>
  makeAdminRepository({
    id,
    name,
    url: `https://github.com/ejemplo/${name}`,
    language: null,
    evidence,
  });

async function openBlock(
  repositories: ReturnType<typeof makeAdminRepository>[],
  integrations: Parameters<typeof makeIntegrations>[0] | 'error' = [],
) {
  server.use(
    http.get(`${API}/admin/featured-repositories`, () => HttpResponse.json(repositories)),
    http.get(`${API}/admin/integrations`, () =>
      integrations === 'error'
        ? HttpResponse.json({ message: 'boom' }, { status: 500 })
        : HttpResponse.json(makeIntegrations(integrations)),
    ),
    ...adminHandlers,
  );
  renderWithProviders(<AppRouter />, { route: '/admin/proyectos' });
  const block = await screen.findByRole('region', { name: 'Repositorios destacados' });
  await within(block).findByText(repositories[0]!.name);
  return block;
}

const rowOf = (block: HTMLElement, name: string): HTMLElement =>
  within(block).getByText(name).closest('li') as HTMLElement;

describe('Repositorios del panel — estado de verificación', () => {
  it('cada estado tiene su insignia de texto', async () => {
    const block = await openBlock([
      repo('r1', 'verificado', makeAdminEvidence()),
      repo('r2', 'sin-fila', null),
      repo('r3', 'url-cambiada', makeAdminEvidence({ stale: true, repoKey: 'ejemplo/viejo' })),
      repo('r4', 'borrado', makeAdminEvidence({ status: 'NOT_FOUND' })),
      repo('r5', 'sin-acceso', makeAdminEvidence({ status: 'INACCESSIBLE' })),
      repo('r6', 'privado', makeAdminEvidence({ status: 'PRIVATE' })),
      repo('r7', 'movido', makeAdminEvidence({ movedTo: 'ejemplo/nuevo-nombre' })),
    ]);

    expect(within(rowOf(block, 'verificado')).getByText('Verificado el 16 nov 2026')).toBeVisible();
    expect(within(rowOf(block, 'sin-fila')).getByText('Sin verificar')).toBeVisible();
    expect(within(rowOf(block, 'sin-fila')).getByText(/próxima sincronización/)).toBeVisible();
    expect(within(rowOf(block, 'url-cambiada')).getByText('Sin verificar')).toBeVisible();
    expect(within(rowOf(block, 'borrado')).getByText('No encontrado en GitHub')).toBeVisible();
    expect(within(rowOf(block, 'sin-acceso')).getByText('GitHub no da acceso')).toBeVisible();
    expect(within(rowOf(block, 'privado')).getByText('Privado: no se publica')).toBeVisible();
    const moved = rowOf(block, 'movido');
    expect(within(moved).getByText('Verificado el 16 nov 2026')).toBeVisible();
    expect(
      within(moved).getByText('GitHub lo movió a ejemplo/nuevo-nombre: actualizá la URL'),
    ).toBeVisible();
  });

  it('el diálogo muestra la descripción de GitHub de solo lectura y el lenguaje de GitHub como placeholder', async () => {
    const block = await openBlock([repo('r1', 'verificado', makeAdminEvidence())]);
    const user = userEvent.setup();
    await user.click(within(block).getByRole('button', { name: 'Editar repositorio verificado' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('API de reservas (descripción en GitHub).'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Descripción en GitHub:')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Lenguaje')).toHaveAttribute(
      'placeholder',
      'De GitHub: Java',
    );
  });

  it('con la URL cambiada el diálogo no muestra datos del repositorio anterior', async () => {
    const block = await openBlock([
      repo('r1', 'cambiado', makeAdminEvidence({ stale: true, repoKey: 'ejemplo/viejo' })),
    ]);
    const user = userEvent.setup();
    await user.click(within(block).getByRole('button', { name: 'Editar repositorio cambiado' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/Descripción en GitHub/)).toBeNull();
    expect(within(dialog).getByLabelText('Lenguaje')).toHaveAttribute('placeholder', 'TypeScript');
  });
});

describe('Repositorios del panel — aviso de la sincronización con GitHub', () => {
  const repositories = [repo('r1', 'verificado', makeAdminEvidence())];

  it('con el último trabajo de github en DEAD avisa con el error y el enlace a Integraciones', async () => {
    await openBlock(repositories, [
      makeIntegrationStatus({
        provider: 'github',
        jobs: { pending: 0, running: 0, failed: 0, dead: 1 },
        lastDeadError:
          'GitHub rechazó el token (401): renovalo en Integraciones o en GITHUB_SYNC_TOKEN',
        lastRun: {
          outcome: 'DEAD',
          startedAt: '2026-11-16T10:00:00.000Z',
          finishedAt: '2026-11-16T10:00:01.000Z',
          errorClass: 'Permanent',
          errorMessage: 'GitHub rechazó el token (401)',
        },
      }),
    ]);
    const notice = await screen.findByRole('region', {
      name: 'Aviso de la sincronización con GitHub',
    });
    expect(notice).toHaveTextContent(
      'La última sincronización con GitHub falló: GitHub rechazó el token (401): renovalo en Integraciones o en GITHUB_SYNC_TOKEN. Se siguen mostrando los datos verificados por última vez.',
    );
    expect(within(notice).getByRole('link', { name: 'Ver integraciones' })).toHaveAttribute(
      'href',
      '/admin/integraciones',
    );
  });

  it('un proveedor atrasado también avisa', async () => {
    await openBlock(repositories, [makeIntegrationStatus({ provider: 'github', stale: true })]);
    expect(
      await screen.findByRole('region', { name: 'Aviso de la sincronización con GitHub' }),
    ).toHaveTextContent('La última sincronización con GitHub falló');
  });

  it('con github sano no muestra ningún aviso', async () => {
    await openBlock(repositories, [makeIntegrationStatus({ provider: 'github' })]);
    expect(
      screen.queryByRole('region', { name: 'Aviso de la sincronización con GitHub' }),
    ).toBeNull();
  });

  it('sin github habilitado (otro proveedor con error) no muestra ningún aviso', async () => {
    await openBlock(repositories, [
      makeIntegrationStatus({
        provider: 'fake',
        jobs: { pending: 0, running: 0, failed: 0, dead: 2 },
      }),
    ]);
    expect(
      screen.queryByRole('region', { name: 'Aviso de la sincronización con GitHub' }),
    ).toBeNull();
  });

  it('si la consulta de integraciones falla, no avisa y la lista sigue funcionando', async () => {
    const block = await openBlock(repositories, 'error');
    expect(
      screen.queryByRole('region', { name: 'Aviso de la sincronización con GitHub' }),
    ).toBeNull();
    expect(within(block).getByText('Verificado el 16 nov 2026')).toBeVisible();
  });
});
