import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { AI_DISABLED_USAGE, makeAiRun, makeAiUsage } from '@/test/fixtures/ai';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';
import type { AiUsage } from '../shared/admin-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function installAi(usage: AiUsage) {
  const calls = { usage: 0, smoke: 0 };
  let current = usage;
  server.use(
    http.get(`${API}/admin/ai/usage`, () => {
      calls.usage += 1;
      return HttpResponse.json(current);
    }),
    http.post(`${API}/admin/ai/smoke`, () => {
      calls.smoke += 1;
      const run = makeAiRun({ id: `run-${calls.smoke}` });
      current = {
        ...current,
        spentUsd: current.spentUsd + 0.000045,
        recentRuns: [run, ...current.recentRuns],
      };
      return HttpResponse.json(run, { status: 201 });
    }),
    ...adminHandlers,
  );
  return calls;
}

const renderPage = () => renderWithProviders(<AppRouter />, { route: '/admin/integraciones' });
const block = async () => screen.findByRole('region', { name: 'Inteligencia artificial' });

describe('Bloque «Inteligencia artificial» de Integraciones', () => {
  it('IA apagada: dice por qué y no muestra Probar conexión', async () => {
    installAi(AI_DISABLED_USAGE);
    renderPage();
    const region = await block();
    expect(
      await within(region).findByText(/La IA está apagada\. Se enciende con la variable/),
    ).toBeInTheDocument();
    expect(within(region).getByText('AI_ENABLED')).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: 'Probar conexión' })).toBeNull();
  });

  it('gasto del mes: «Gastado 1,23 de 10,00 USD en noviembre de 2026 (12 %)»', async () => {
    installAi(makeAiUsage({ spentUsd: 1.23, remainingUsd: 8.77, percentUsed: 12 }));
    renderPage();
    const region = await block();
    expect(
      await within(region).findByText('Gastado 1,23 de 10,00 USD en noviembre de 2026 (12 %)'),
    ).toBeInTheDocument();
    expect(within(region).getByText('Activa')).toBeInTheDocument();
    expect(within(region).getByText(/17 de noviembre de 2026/)).toBeInTheDocument();
  });

  it('cerca del tope: muestra «Cerca del tope del mes»', async () => {
    installAi(makeAiUsage({ state: 'NEAR_LIMIT', spentUsd: 8.1, percentUsed: 81 }));
    renderPage();
    expect(await within(await block()).findByText('Cerca del tope del mes')).toBeInTheDocument();
  });

  it('muestra lo reservado en curso solo cuando hay algo reservado', async () => {
    installAi(makeAiUsage({ reservedUsd: 0.5 }));
    renderPage();
    const region = await block();
    expect(await within(region).findByText('Reservado en curso')).toBeInTheDocument();
    expect(within(region).getByText('0,50 USD')).toBeInTheDocument();
  });

  it('sin reservado no muestra esa línea', async () => {
    installAi(makeAiUsage());
    renderPage();
    const region = await block();
    await within(region).findByText('Activa');
    expect(within(region).queryByText('Reservado en curso')).toBeNull();
  });

  it('tope alcanzado: «Se alcanzó el tope de IA del mes» y Probar conexión deshabilitado', async () => {
    installAi(makeAiUsage({ state: 'EXHAUSTED', spentUsd: 10, percentUsed: 100 }));
    renderPage();
    const region = await block();
    expect(await within(region).findByText('Se alcanzó el tope de IA del mes')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Probar conexión' })).toBeDisabled();
  });

  it('corte del proveedor: dice hasta cuándo y deja Probar conexión habilitado', async () => {
    installAi(
      makeAiUsage({
        state: 'PROVIDER_BLOCKED',
        providerBlockedUntil: '2026-12-01T12:00:00.000Z',
      }),
    );
    renderPage();
    const region = await block();
    expect(
      await within(region).findByText(/Anthropic cortó por el spend limit hasta 01\/12\/2026/),
    ).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Probar conexión' })).toBeEnabled();
  });

  it('sin corridas dice que todavía no hay; con corridas arma la tabla con sus columnas', async () => {
    installAi(makeAiUsage({ recentRuns: [] }));
    renderPage();
    const region = await block();
    expect(await within(region).findByText(/Todavía no hay corridas de IA/)).toBeInTheDocument();
  });

  it('la tabla de corridas muestra tarea, versión, modelo, estado, tokens, costo, duración y caché', async () => {
    installAi(
      makeAiUsage({
        recentRuns: [
          makeAiRun(),
          makeAiRun({
            id: 'run-2',
            status: 'CACHED',
            fromCache: true,
            costMicroUsd: 0,
            inputTokens: null,
            outputTokens: null,
            durationMs: 0,
          }),
        ],
      }),
    );
    renderPage();
    const region = await block();
    const table = await within(region).findByRole('table');
    // En pantallas angostas la tabla se desplaza: la región tiene que tener foco (axe).
    expect(
      within(region).getByRole('region', { name: 'Corridas recientes de IA' }),
    ).toHaveAttribute('tabindex', '0');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    const first = within(rows[1] as HTMLElement);
    expect(first.getByText('ai.smoke')).toBeInTheDocument();
    expect(first.getByText('v1')).toBeInTheDocument();
    expect(first.getByText('claude-haiku-5-5')).toBeInTheDocument();
    expect(first.getByText('Exitosa')).toBeInTheDocument();
    expect(first.getByText('200 / 50')).toBeInTheDocument();
    expect(first.getByText('0,000045 USD')).toBeInTheDocument();
    expect(first.getByText('820 ms')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('Sí')).toBeInTheDocument();
  });

  it('Probar conexión con el proveedor de prueba: confirma «no llama a Anthropic» y suma una corrida', async () => {
    const user = userEvent.setup();
    const calls = installAi(makeAiUsage({ provider: 'fake' }));
    renderPage();
    const region = await block();
    await user.click(await within(region).findByRole('button', { name: 'Probar conexión' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText('Proveedor de prueba: no llama a Anthropic.'),
    ).toBeInTheDocument();
    expect(calls.smoke).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Probar' }));
    expect(await within(region).findByText('Conexión verificada.')).toBeInTheDocument();
    expect(calls.smoke).toBe(1);
    const table = await within(region).findByRole('table');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2));
    expect(within(table).getByText('ai.smoke')).toBeInTheDocument();
  });

  it('Probar conexión con Anthropic avisa que la llamada es real', async () => {
    const user = userEvent.setup();
    installAi(makeAiUsage({ provider: 'anthropic' }));
    renderPage();
    const region = await block();
    await user.click(await within(region).findByRole('button', { name: 'Probar conexión' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText('Hace una llamada real a Anthropic (unos 0,0001 USD).'),
    ).toBeInTheDocument();
  });

  it('cancelar la confirmación no hace ninguna llamada', async () => {
    const user = userEvent.setup();
    const calls = installAi(makeAiUsage());
    renderPage();
    const region = await block();
    await user.click(await within(region).findByRole('button', { name: 'Probar conexión' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(calls.smoke).toBe(0);
  });

  it('una prueba que falla (corrida FAILED) muestra el motivo', async () => {
    const user = userEvent.setup();
    installAi(makeAiUsage());
    server.use(
      http.post(`${API}/admin/ai/smoke`, () =>
        HttpResponse.json(
          makeAiRun({ status: 'FAILED', failureKind: 'Transient', failureMessage: 'HTTP 529' }),
          { status: 201 },
        ),
      ),
    );
    renderPage();
    const region = await block();
    await user.click(await within(region).findByRole('button', { name: 'Probar conexión' }));
    await user.click(await screen.findByRole('button', { name: 'Probar' }));
    expect(
      await within(region).findByText(/La prueba no salió bien: HTTP 529/),
    ).toBeInTheDocument();
  });

  it('un 422 del tope muestra el mensaje de la API', async () => {
    const user = userEvent.setup();
    installAi(makeAiUsage());
    server.use(
      http.post(`${API}/admin/ai/smoke`, () =>
        HttpResponse.json(
          { statusCode: 422, message: 'Se alcanzó el tope de IA del mes', error: 'Unprocessable' },
          { status: 422 },
        ),
      ),
    );
    renderPage();
    const region = await block();
    await user.click(await within(region).findByRole('button', { name: 'Probar conexión' }));
    await user.click(await screen.findByRole('button', { name: 'Probar' }));
    expect(
      (await within(region).findAllByText('Se alcanzó el tope de IA del mes')).length,
    ).toBeGreaterThan(0);
  });

  it('la barra del panel no tiene un ítem de IA', async () => {
    installAi(makeAiUsage());
    renderPage();
    await block();
    const nav = screen.getAllByRole('navigation')[0] as HTMLElement;
    expect(within(nav).queryByRole('link', { name: /inteligencia|IA\b/i })).toBeNull();
  });

  it('si la consulta falla, el bloque muestra el error con reintento y la página sigue', async () => {
    server.use(
      http.get(`${API}/admin/ai/usage`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
      ...adminHandlers,
    );
    renderPage();
    const region = await block();
    expect(await within(region).findByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Integraciones' })).toBeInTheDocument();
  });
});

describe('Aviso de IA en el Dashboard', () => {
  const renderDashboard = () => renderWithProviders(<AppRouter />, { route: '/admin' });
  const notice = () => screen.queryByRole('region', { name: 'Aviso de IA' });

  it.each(['EXHAUSTED', 'PROVIDER_BLOCKED'] as const)(
    'con %s muestra el aviso con el enlace',
    async (state) => {
      installAi(makeAiUsage({ state }));
      renderDashboard();
      const region = await screen.findByRole('region', { name: 'Aviso de IA' });
      expect(within(region).getByText('La IA alcanzó el tope del mes')).toBeInTheDocument();
      expect(within(region).getByRole('link')).toHaveAttribute('href', '/admin/integraciones');
    },
  );

  it.each(['OK', 'NEAR_LIMIT', 'DISABLED'] as const)('con %s no lo muestra', async (state) => {
    installAi(makeAiUsage({ state }));
    renderDashboard();
    await screen.findByRole('heading', { name: 'Dashboard' });
    await screen.findByRole('region', { name: 'Totales' });
    expect(notice()).toBeNull();
  });

  it('si la consulta falla, no lo muestra y el Dashboard sigue', async () => {
    server.use(
      http.get(`${API}/admin/ai/usage`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
      ...adminHandlers,
    );
    renderDashboard();
    await screen.findByRole('region', { name: 'Totales' });
    expect(notice()).toBeNull();
  });
});
