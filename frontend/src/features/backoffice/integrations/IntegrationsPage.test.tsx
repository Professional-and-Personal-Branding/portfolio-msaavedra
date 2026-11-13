import { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import type { IntegrationStatus, IntegrationsOverview } from '../shared/admin-types';
import { adminKeys } from '../shared/use-admin-api';
import { makeIntegrations, makeIntegrationStatus } from '@/test/fixtures/integrations';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { INTEGRATIONS_REFRESH_MS, hasActiveJobs } from './use-integrations-api';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SECRET = 'credencial-de-prueba-xyz-123';

/** Estado del servidor simulado: lo que el panel lee después de cada escritura. */
interface Backend {
  overview: IntegrationsOverview;
  syncCalls: number;
  patchBodies: unknown[];
  putBodies: unknown[];
  deleteCalls: number;
}

function installBackend(initial: IntegrationsOverview): Backend {
  const backend: Backend = {
    overview: initial,
    syncCalls: 0,
    patchBodies: [],
    putBodies: [],
    deleteCalls: 0,
  };
  const update = (patch: (status: IntegrationStatus) => IntegrationStatus) => {
    backend.overview = { ...backend.overview, providers: backend.overview.providers.map(patch) };
  };
  // Primero los handlers de este test (ganan), después los del panel (sesión, etc.).
  server.use(
    http.get(`${API}/admin/integrations`, () => HttpResponse.json(backend.overview)),
    http.post(`${API}/admin/integrations/:provider/sync`, () => {
      backend.syncCalls += 1;
      const first = backend.syncCalls === 1;
      update((p) => ({ ...p, jobs: { ...p.jobs, pending: 1 } }));
      return HttpResponse.json(
        {
          jobId: 'job-1',
          status: 'PENDING',
          runAt: '2026-11-12T12:00:00.000Z',
          alreadyQueued: !first,
        },
        { status: 202 },
      );
    }),
    http.patch(`${API}/admin/integrations/:provider`, async ({ request }) => {
      const body = (await request.json()) as { enabled: boolean };
      backend.patchBodies.push(body);
      update((p) => ({ ...p, enabled: body.enabled }));
      return HttpResponse.json(backend.overview.providers[0]);
    }),
    http.put(`${API}/admin/integrations/:provider/credential`, async ({ request }) => {
      backend.putBodies.push(await request.json());
      update((p) => ({
        ...p,
        credential: { source: 'db', keyId: 'k1', updatedAt: '2026-11-12T12:00:00.000Z' },
      }));
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete(`${API}/admin/integrations/:provider/credential`, () => {
      backend.deleteCalls += 1;
      update((p) => ({ ...p, credential: { source: null, keyId: null, updatedAt: null } }));
      return new HttpResponse(null, { status: 204 });
    }),
    ...adminHandlers,
  );
  return backend;
}

function renderIntegrations(): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
  const router = createMemoryRouter([{ path: '*', element: <AppRouter /> }], {
    initialEntries: ['/admin/integraciones'],
  });
  render(
    <AppProviders queryClient={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { client };
}

const card = async () => screen.findByRole('region', { name: 'fake' });

describe('IntegrationsPage', () => {
  it('sin proveedores muestra el mensaje de la spec', async () => {
    installBackend(makeIntegrations([]));
    renderIntegrations();
    expect(await screen.findByText('No hay integraciones habilitadas.')).toBeInTheDocument();
    expect(
      screen.getByText('Se activan con la variable INTEGRATIONS_ENABLED del servidor.'),
    ).toBeInTheDocument();
  });

  it('con el scheduler apagado avisa que lo encolado queda en espera', async () => {
    installBackend(makeIntegrations([makeIntegrationStatus()], false));
    renderIntegrations();
    expect(
      await screen.findByText(
        'El scheduler está apagado en este servidor: lo que encoles queda en espera.',
      ),
    ).toBeInTheDocument();
  });

  it('con el scheduler encendido no muestra ese aviso', async () => {
    installBackend(makeIntegrations());
    renderIntegrations();
    await card();
    expect(screen.queryByText(/El scheduler está apagado/)).toBeNull();
  });

  it('muestra el estado, la última corrida, la cola y el origen de la credencial', async () => {
    installBackend(
      makeIntegrations([
        makeIntegrationStatus({
          jobs: { pending: 1, running: 0, failed: 2, dead: 1 },
          lastDeadError: 'falta la credencial',
        }),
      ]),
    );
    renderIntegrations();
    const region = await card();
    expect(within(region).getByText('Activo')).toBeInTheDocument();
    expect(within(region).getByText(/Exitosa/)).toBeInTheDocument();
    expect(
      within(region).getByText(/1 pendientes · 0 en curso · 2 con error · 1 fallidos/),
    ).toBeInTheDocument();
    expect(within(region).getByText('falta la credencial')).toBeInTheDocument();
    expect(within(region).getByText('Guardada en la base (clave k1)')).toBeInTheDocument();
  });

  it('Atrasado: stale muestra «Sin sincronizar hace más de 48 h»', async () => {
    installBackend(makeIntegrations([makeIntegrationStatus({ stale: true })]));
    renderIntegrations();
    const region = await card();
    expect(within(region).getByText('Sin sincronizar hace más de 48 h')).toBeInTheDocument();
  });

  it('una pausa vigente se dice por texto, con su fecha y motivo', async () => {
    installBackend(
      makeIntegrations([
        makeIntegrationStatus({
          pausedUntil: '2026-11-13T10:00:00.000Z',
          pauseReason: 'RetryAfter',
        }),
      ]),
    );
    renderIntegrations();
    const region = await card();
    expect(within(region).getByText(/^En pausa hasta /)).toBeInTheDocument();
    expect(within(region).getByText('el proveedor pidió esperar')).toBeInTheDocument();
  });

  it('Sincronizar ahora encola y avisa; el segundo clic avisa que ya había una', async () => {
    const backend = installBackend(makeIntegrations());
    const user = userEvent.setup();
    renderIntegrations();
    const region = await card();

    await user.click(within(region).getByRole('button', { name: 'Sincronizar ahora' }));
    expect(
      await within(region).findByText('Encolado: corre en el próximo minuto.'),
    ).toBeInTheDocument();
    // La cola refleja 1 pendiente después de invalidar el estado.
    expect(await within(region).findByText(/1 pendientes/)).toBeInTheDocument();

    await user.click(within(region).getByRole('button', { name: 'Sincronizar ahora' }));
    expect(
      await within(region).findByText('Ya había una sincronización en cola.'),
    ).toBeInTheDocument();
    expect(backend.syncCalls).toBe(2);
  });

  it('Pausar y Reanudar cambian enabled por PATCH', async () => {
    const backend = installBackend(makeIntegrations());
    const user = userEvent.setup();
    renderIntegrations();
    const region = await card();

    await user.click(within(region).getByRole('button', { name: 'Pausar' }));
    expect(await within(region).findByText('Pausado')).toBeInTheDocument();
    expect(backend.patchBodies).toEqual([{ enabled: false }]);
    // Pausado no se puede sincronizar.
    expect(within(region).getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled();

    await user.click(within(region).getByRole('button', { name: 'Reanudar' }));
    expect(await within(region).findByText('Activo')).toBeInTheDocument();
    expect(backend.patchBodies).toEqual([{ enabled: false }, { enabled: true }]);
  });

  describe('credencial', () => {
    it('guardar: el campo queda vacío, la tarjeta dice «guardada en la base» y el valor no está en el DOM', async () => {
      const backend = installBackend(
        makeIntegrations([
          makeIntegrationStatus({ credential: { source: null, keyId: null, updatedAt: null } }),
        ]),
      );
      const user = userEvent.setup();
      renderIntegrations();
      const region = await card();
      expect(within(region).getByText('Falta la credencial')).toBeInTheDocument();

      const field = within(region).getByLabelText('Credencial');
      expect(field).toHaveAttribute('type', 'password');
      await user.type(field, SECRET);
      await user.click(within(region).getByRole('button', { name: 'Guardar' }));

      expect(await within(region).findByText('Credencial guardada.')).toBeInTheDocument();
      expect(backend.putBodies).toEqual([{ secret: SECRET }]);
      expect(await within(region).findByText('Guardada en la base (clave k1)')).toBeInTheDocument();
      expect(within(region).getByLabelText('Credencial')).toHaveValue('');
      expect(document.body.innerHTML).not.toContain(SECRET);
    });

    it('con la credencial ya guardada el campo no se rellena con el valor', async () => {
      installBackend(makeIntegrations());
      renderIntegrations();
      const region = await card();
      expect(within(region).getByLabelText('Credencial')).toHaveValue('');
      expect(document.body.innerHTML).not.toContain(SECRET);
    });

    it('vacío: «Ingresá la credencial.» y no se llama a la API', async () => {
      const backend = installBackend(makeIntegrations());
      const user = userEvent.setup();
      renderIntegrations();
      const region = await card();

      await user.click(within(region).getByRole('button', { name: 'Guardar' }));

      expect(await within(region).findByText('Ingresá la credencial.')).toBeInTheDocument();
      expect(backend.putBodies).toEqual([]);
    });

    it('más de 4096 caracteres: mensaje y sin llamada', async () => {
      const backend = installBackend(makeIntegrations());
      const user = userEvent.setup();
      renderIntegrations();
      const region = await card();
      const field = within(region).getByLabelText('Credencial');
      // `type` de 4097 caracteres es lento: se pega.
      await user.click(field);
      await user.paste('x'.repeat(4097));
      await user.click(within(region).getByRole('button', { name: 'Guardar' }));

      expect(
        await within(region).findByText('La credencial no puede superar 4096 caracteres.'),
      ).toBeInTheDocument();
      expect(backend.putBodies).toEqual([]);
    });

    it('con el secreto en una variable de entorno no se renderiza el campo ni Guardar', async () => {
      installBackend(
        makeIntegrations([
          makeIntegrationStatus({ credential: { source: 'env', keyId: null, updatedAt: null } }),
        ]),
      );
      renderIntegrations();
      const region = await card();
      expect(within(region).getByText('Variable de entorno del servidor')).toBeInTheDocument();
      expect(within(region).queryByLabelText('Credencial')).toBeNull();
      expect(within(region).queryByRole('button', { name: 'Guardar' })).toBeNull();
    });

    it('Borrar pide confirmación y recién entonces llama a DELETE', async () => {
      const backend = installBackend(makeIntegrations());
      const user = userEvent.setup();
      renderIntegrations();
      const region = await card();

      await user.click(within(region).getByRole('button', { name: 'Borrar' }));
      const dialog = await screen.findByRole('alertdialog');
      expect(backend.deleteCalls).toBe(0);
      await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));

      expect(await within(region).findByText('Credencial borrada.')).toBeInTheDocument();
      expect(backend.deleteCalls).toBe(1);
      expect(await within(region).findByText('Falta la credencial')).toBeInTheDocument();
    });

    it('un 422 del PUT se explica sin mostrar el secreto', async () => {
      installBackend(
        makeIntegrations([
          makeIntegrationStatus({ credential: { source: null, keyId: null, updatedAt: null } }),
        ]),
      );
      server.use(
        http.put(`${API}/admin/integrations/:provider/credential`, () =>
          HttpResponse.json(
            { statusCode: 422, message: 'x', error: 'Unprocessable Entity' },
            { status: 422 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderIntegrations();
      const region = await card();
      await user.type(within(region).getByLabelText('Credencial'), SECRET);
      await user.click(within(region).getByRole('button', { name: 'Guardar' }));
      expect(
        await within(region).findByText(
          'La credencial de este proveedor viene de una variable de entorno.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('un error al cargar ofrece reintentar', async () => {
    server.use(
      http.get(`${API}/admin/integrations`, () =>
        HttpResponse.json({ statusCode: 500, message: 'Error interno' }, { status: 500 }),
      ),
      ...adminHandlers,
    );
    renderIntegrations();
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('enlaza de vuelta a Cuenta', async () => {
    installBackend(makeIntegrations());
    renderIntegrations();
    await card();
    expect(screen.getByRole('link', { name: 'Volver a Cuenta' })).toHaveAttribute(
      'href',
      '/admin/cuenta',
    );
  });

  describe('refresco', () => {
    it('hasActiveJobs es true solo con trabajos pendientes o en curso', () => {
      const withJobs = (jobs: IntegrationStatus['jobs']) =>
        makeIntegrations([makeIntegrationStatus({ jobs })]);
      expect(hasActiveJobs(undefined)).toBe(false);
      expect(hasActiveJobs(makeIntegrations([]))).toBe(false);
      expect(hasActiveJobs(withJobs({ pending: 0, running: 0, failed: 3, dead: 2 }))).toBe(false);
      expect(hasActiveJobs(withJobs({ pending: 1, running: 0, failed: 0, dead: 0 }))).toBe(true);
      expect(hasActiveJobs(withJobs({ pending: 0, running: 1, failed: 0, dead: 0 }))).toBe(true);
    });

    it('el intervalo es de 15 s con trabajos activos y se apaga sin ellos', async () => {
      installBackend(
        makeIntegrations([
          makeIntegrationStatus({ jobs: { pending: 1, running: 0, failed: 0, dead: 0 } }),
        ]),
      );
      const { client } = renderIntegrations();
      await card();
      const query = client.getQueryCache().find({ queryKey: adminKeys.integrations });
      if (!query) throw new Error('la consulta de integraciones no existe');
      const refetchInterval = query.observers[0]?.options.refetchInterval;
      if (typeof refetchInterval !== 'function')
        throw new Error('refetchInterval debería ser una función');
      expect(refetchInterval(query as never)).toBe(INTEGRATIONS_REFRESH_MS);
      expect(INTEGRATIONS_REFRESH_MS).toBe(15_000);

      // Sin trabajos pendientes ni en curso, el mismo observador deja de refrescar.
      client.setQueryData(adminKeys.integrations, makeIntegrations());
      await waitFor(() => {
        expect(refetchInterval(query as never)).toBe(false);
      });
    });
  });
});
