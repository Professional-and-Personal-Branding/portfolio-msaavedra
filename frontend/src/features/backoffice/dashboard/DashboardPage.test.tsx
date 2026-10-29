import { screen, waitFor, within } from '@testing-library/react';
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

  it('las barras diarias son proporcionales al máximo y tienen un contenedor de alto definido', async () => {
    server.use(...adminHandlers);

    renderWithProviders(<AppRouter />, { route: '/admin' });

    // byDay del fixture: 1, 5 y 2 visitas → máximo 5.
    const max = await screen.findByRole('img', { name: '7 sept: 5 visitas' });
    const mid = screen.getByRole('img', { name: '8 sept: 2 visitas' });
    const min = screen.getByRole('img', { name: '6 sept: 1 visitas' });
    expect(max.style.height).toBe('100%');
    expect(mid.style.height).toBe('40%');
    expect(min.style.height).toBe('20%');

    // El % solo resuelve si el contenedor tiene alto: pista con flex-1 dentro de un <li> h-full.
    const track = max.parentElement as HTMLElement;
    expect(track).toHaveAttribute('data-testid', 'day-bar-track');
    expect(track).toHaveClass('flex-1');
    expect(track.parentElement).toHaveClass('h-full');
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
    // Ni una tabla por tipo con los tres en cero.
    expect(screen.queryByRole('region', { name: 'Por tipo' })).not.toBeInTheDocument();
  });

  // classify-profile-views, D8.
  describe('tabla por tipo', () => {
    it('lista Personas, Tus visitas y Bots, en ese orden y con la línea explicativa', async () => {
      server.use(...adminHandlers);

      renderWithProviders(<AppRouter />, { route: '/admin' });

      const byKind = await screen.findByRole('region', { name: 'Por tipo' });
      const rows = within(byKind)
        .getAllByRole('listitem')
        .map((item) => item.textContent);
      expect(rows).toEqual(['Personas12', 'Tus visitas3', 'Bots5']);
      expect(
        within(byKind).getByText(/Solo las visitas de personas suman en el total/),
      ).toBeInTheDocument();
    });

    it('solo visitas propias o de bots: estado vacío y, debajo, la tabla por tipo', async () => {
      server.use(
        http.get(`${API}/admin/analytics/views`, () =>
          HttpResponse.json({
            ...EMPTY_ANALYTICS,
            byKind: [
              { kind: 'HUMAN', views: 0 },
              { kind: 'OWNER', views: 3 },
              { kind: 'BOT', views: 2 },
            ],
          }),
        ),
        ...adminHandlers,
      );

      renderWithProviders(<AppRouter />, { route: '/admin' });

      expect(await screen.findByText('Todavía no hay visitas')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Por perfil' })).not.toBeInTheDocument();
      const byKind = await screen.findByRole('region', { name: 'Por tipo' });
      expect(
        within(byKind)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Personas0', 'Tus visitas3', 'Bots2']);
    });

    it('el rango se aplica: la petición con el rango nuevo recalcula la tabla por tipo', async () => {
      const requests: string[] = [];
      server.use(
        http.get(`${API}/admin/analytics/views`, ({ request }) => {
          requests.push(request.url);
          const sevenDays = requests.length > 1;
          return HttpResponse.json({
            ...ANALYTICS,
            byKind: [
              { kind: 'HUMAN', views: sevenDays ? 4 : 12 },
              { kind: 'OWNER', views: sevenDays ? 1 : 3 },
              { kind: 'BOT', views: sevenDays ? 0 : 5 },
            ],
          });
        }),
        ...adminHandlers,
      );
      const user = userEvent.setup();

      renderWithProviders(<AppRouter />, { route: '/admin' });
      await screen.findByRole('region', { name: 'Por tipo' });

      await user.click(screen.getByRole('combobox', { name: 'Rango de fechas' }));
      await user.click(await screen.findByRole('option', { name: 'Últimos 7 días' }));

      await waitFor(() => {
        const byKind = screen.getByRole('region', { name: 'Por tipo' });
        expect(
          within(byKind)
            .getAllByRole('listitem')
            .map((item) => item.textContent),
        ).toEqual(['Personas4', 'Tus visitas1', 'Bots0']);
      });
      expect(requests.length).toBeGreaterThan(1);
    });
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

// add-share-links: tablas Por enlace y Por portal (D9), con «Sin enlace» y «Sin portal» como resto.
describe('DashboardPage — enlaces de seguimiento y portales', () => {
  const attributed = (over: Partial<typeof ANALYTICS> = {}) =>
    http.get(`${API}/admin/analytics/views`, () => HttpResponse.json({ ...ANALYTICS, ...over }));

  const rowsOf = (region: HTMLElement) =>
    within(region)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent);

  it('Por enlace: Acme 4, Globex 2 (revocado) y «Sin enlace» 4, en ese orden', async () => {
    server.use(
      attributed({
        total: 10,
        byShareLink: [
          {
            shareLinkId: 'a',
            code: 'k7m2q9xw4t',
            label: 'Acme',
            slug: 'acme-backend',
            portal: 'linkedin',
            revoked: false,
            views: 4,
          },
          {
            shareLinkId: 'g',
            code: 'n3p5r7s9v1',
            label: 'Globex',
            slug: 'all',
            portal: null,
            revoked: true,
            views: 2,
          },
        ],
      }),
      ...adminHandlers,
    );
    renderWithProviders(<AppRouter />, { route: '/admin' });

    const region = await screen.findByRole('region', { name: 'Por enlace' });
    expect(rowsOf(region)).toEqual([
      'Acmeacme-backendlinkedin4',
      'Globexrevocadoall—2',
      'Sin enlace4',
    ]);
    expect(within(region).getByText('revocado')).toBeInTheDocument();
  });

  it('Por enlace sin enlaces: estado vacío que manda a la pestaña Publicación', async () => {
    server.use(attributed({ byShareLink: [] }), ...adminHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin' });

    const region = await screen.findByRole('region', { name: 'Por enlace' });
    expect(region).toHaveTextContent('Publicación');
    expect(within(region).queryByRole('table')).toBeNull();
  });

  it('Por portal: linkedin 5, indeed 3 y «Sin portal» 2', async () => {
    server.use(
      attributed({
        total: 10,
        bySource: [
          { source: 'linkedin', views: 5 },
          { source: 'indeed', views: 3 },
        ],
      }),
      ...adminHandlers,
    );
    renderWithProviders(<AppRouter />, { route: '/admin' });

    const region = await screen.findByRole('region', { name: 'Por portal' });
    expect(rowsOf(region)).toEqual(['linkedin5', 'indeed3', 'Sin portal2']);
    expect(region).toHaveTextContent('no depende del referrer');
  });

  it('Por portal sin portales: estado vacío y no una tabla con ceros', async () => {
    server.use(attributed({ bySource: [] }), ...adminHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin' });

    const region = await screen.findByRole('region', { name: 'Por portal' });
    expect(within(region).queryByRole('table')).toBeNull();
    expect(region).toHaveTextContent('Todavía ninguna visita trae un portal');
  });

  it('Por origen aclara que casi siempre da «directo» y manda a las tablas nuevas', async () => {
    server.use(...adminHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin' });

    const region = await screen.findByRole('region', { name: 'Por origen' });
    expect(region).toHaveTextContent('casi siempre da «directo»');
  });

  it('cambiar el rango recalcula las tablas de enlaces y portales', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/analytics/views`, () => {
        calls += 1;
        return HttpResponse.json({
          ...ANALYTICS,
          total: 10,
          bySource: [{ source: calls === 1 ? 'linkedin' : 'indeed', views: 7 }],
        });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin' });
    const first = await screen.findByRole('region', { name: 'Por portal' });
    expect(rowsOf(first)).toEqual(['linkedin7', 'Sin portal3']);

    await user.click(screen.getByRole('combobox', { name: 'Rango de fechas' }));
    await user.click(await screen.findByRole('option', { name: 'Últimos 7 días' }));

    await waitFor(() =>
      expect(rowsOf(screen.getByRole('region', { name: 'Por portal' }))).toEqual([
        'indeed7',
        'Sin portal3',
      ]),
    );
  });
});
