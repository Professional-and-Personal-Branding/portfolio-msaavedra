import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { ANALYTICS, EMPTY_ANALYTICS, makeAdminCuratedProfile } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DashboardPage — perfiles archivados', () => {
  // add-curated-profile-lifecycle, D8: archivar conserva las visitas y el perfil
  // sigue en la tabla, marcado; su link público ya no resuelve.
  it('un perfil archivado con visitas sigue en la tabla, marcado y sin link público', async () => {
    server.use(
      http.get(`${API}/admin/curated-profiles`, () =>
        HttpResponse.json([makeAdminCuratedProfile({ archivedAt: '2026-10-01T00:00:00.000Z' })]),
      ),
      ...adminHandlers,
    );
    renderWithProviders(<AppRouter />, { route: '/admin' });

    const byProfile = await screen.findByRole('region', { name: 'Por perfil' });
    const fila = (await within(byProfile).findByText('acme-backend')).closest('li') as HTMLElement;
    // La marca llega con la lista de perfiles, que puede resolver después de la analítica.
    expect(await within(fila).findByText('archivado')).toBeInTheDocument();
    expect(within(fila).queryByRole('link', { name: 'ver' })).toBeNull();
    expect(within(fila).getByText('3')).toBeInTheDocument();
  });
});

describe('DashboardPage', () => {
  it('muestra totales, perfiles ordenados por visitas, idiomas y la serie diaria', async () => {
    server.use(...adminHandlers);

    renderWithProviders(<AppRouter />, { route: '/admin' });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    const totals = await screen.findByRole('region', { name: 'Totales' });
    expect(within(totals).getByText(String(ANALYTICS.total))).toBeInTheDocument();

    const byProfile = screen.getByRole('region', { name: 'Por perfil' });
    const rows = within(byProfile)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    // `all` tiene 9 visitas y va antes que `acme-backend`, que tiene 3
    expect(rows[0]).toMatch(/^all/);
    expect(rows[1]).toMatch(/^acme-backend/);
    // el perfil que existe en el listado enlaza a su ficha
    expect(within(byProfile).getByRole('link', { name: 'acme-backend' })).toHaveAttribute(
      'href',
      '/admin/perfiles/cp-1',
    );

    const byLocale = screen.getByRole('region', { name: 'Por idioma' });
    expect(within(byLocale).getByText('es')).toBeInTheDocument();
    expect(within(byLocale).getByText('8')).toBeInTheDocument();

    // Cada barra expone su fecha y su cantidad como texto accesible.
    expect(screen.getByRole('img', { name: '7 sept: 5 visitas' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /visitas$/ })).toHaveLength(3);
  });

  it('cambiar el rango pide de nuevo la API con from y to', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/admin/analytics/views`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(ANALYTICS);
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/admin' });
    await screen.findByRole('region', { name: 'Totales' });
    expect(urls[0]).toMatch(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);

    await user.click(screen.getByRole('combobox', { name: 'Rango de fechas' }));
    await user.click(await screen.findByRole('option', { name: 'Últimos 7 días' }));

    await screen.findByRole('region', { name: 'Totales' });
    expect(urls.length).toBeGreaterThan(1);
    const [, second] = urls;
    const from = new URL(second!).searchParams.get('from');
    const to = new URL(second!).searchParams.get('to');
    const days = (Date.parse(`${to!}T00:00:00Z`) - Date.parse(`${from!}T00:00:00Z`)) / 86_400_000;
    expect(days).toBe(6); // rango cerrado de 7 días
  });

  it('sin visitas muestra un estado vacío', async () => {
    server.use(
      http.get(`${API}/admin/analytics/views`, () => HttpResponse.json(EMPTY_ANALYTICS)),
      ...adminHandlers,
    );

    renderWithProviders(<AppRouter />, { route: '/admin' });

    expect(await screen.findByText('Todavía no hay visitas')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Por perfil' })).not.toBeInTheDocument();
    // Tampoco una tabla de orígenes con ceros.
    expect(screen.queryByRole('region', { name: 'Por origen' })).not.toBeInTheDocument();
  });

  it('la tabla por origen lista los orígenes de mayor a menor', async () => {
    server.use(
      http.get(`${API}/admin/analytics/views`, () =>
        HttpResponse.json({
          ...ANALYTICS,
          byReferrer: [
            { referrer: 'linkedin.com', views: 5 },
            { referrer: 'directo', views: 7 },
          ],
        }),
      ),
      ...adminHandlers,
    );

    renderWithProviders(<AppRouter />, { route: '/admin' });

    const byReferrer = await screen.findByRole('region', { name: 'Por origen' });
    const rows = within(byReferrer)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(rows).toEqual(['directo7', 'linkedin.com5']);
  });

  it('un error de la API ofrece reintentar', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/analytics/views`, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json(ANALYTICS);
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/admin' });

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('region', { name: 'Totales' })).toBeInTheDocument();
  });
});
