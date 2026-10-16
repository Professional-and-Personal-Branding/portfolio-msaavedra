import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';
import type * as ApiClient from '@/shared/lib/api-client';
import { earlyProfileKey } from './early-profile';

// En producción la API es del mismo origen (`VITE_API_URL` vacío): la única condición para que la app
// tome la respuesta temprana. En tests el cliente apunta a `http://api.test`, así que se simula solo
// esa constante; el cliente HTTP sigue siendo el real y MSW cuenta las peticiones que llegan a la red.
vi.mock('@/shared/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  API_BASE_URL: '',
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  window.__portfolioEarlyProfile = undefined;
});
afterAll(() => server.close());

/** Cuenta las peticiones del perfil que sí llegan a la red (las que no reutilizan la temprana). */
function serveProfile(slug = 'demo') {
  const requests: string[] = [];
  server.use(
    http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
      requests.push(request.url);
      return HttpResponse.json(makeCuratedProfile({ slug }));
    }),
  );
  return requests;
}

function setEarly(slug: string, response: Response, locale: 'es' | 'en' = 'es', token = null) {
  window.__portfolioEarlyProfile = {
    key: earlyProfileKey(slug, locale, token),
    response: Promise.resolve(response),
  };
}

// D5 de `improve-mobile-performance`: una petición, una visita.
describe('petición temprana del perfil — entrega a la app', () => {
  it('con la clave igual, la vista muestra el perfil sin pedirlo otra vez', async () => {
    const requests = serveProfile();
    setEarly('demo', Response.json(makeCuratedProfile({ slug: 'demo', title: 'Temprano' })));

    renderWithProviders(<AppRouter />, { route: '/demo' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
    expect(requests).toEqual([]);
    expect(document.title).toBe('Temprano · Ada Ejemplo');
    // Se toma una sola vez.
    expect(window.__portfolioEarlyProfile).toBeUndefined();
  });

  it('con otra clave, hace su propia petición y descarta la temprana', async () => {
    const requests = serveProfile();
    setEarly('otro', Response.json(makeCuratedProfile({ slug: 'otro', title: 'Equivocado' })));

    renderWithProviders(<AppRouter />, { route: '/demo' });

    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    expect(requests).toHaveLength(1);
    expect(document.title).not.toContain('Equivocado');
    expect(window.__portfolioEarlyProfile).toBeUndefined();
  });

  it('con otro idioma en la URL, la clave no coincide y la app pide la suya', async () => {
    const requests = serveProfile();
    setEarly('demo', Response.json(makeCuratedProfile({ slug: 'demo' })), 'es');

    renderWithProviders(<AppRouter />, { route: '/demo?lang=en' });

    await screen.findByRole('heading', { name: 'Professional Experience' });
    expect(requests).toEqual([`${API}/curated-profiles/demo?locale=en`]);
  });

  it('401 de la respuesta temprana lleva al formulario de token', async () => {
    const requests = serveProfile();
    setEarly(
      'privado',
      Response.json({ statusCode: 401, message: 'Token requerido' }, { status: 401 }),
    );

    renderWithProviders(<AppRouter />, { route: '/privado' });

    expect(await screen.findByRole('heading', { name: 'Perfil protegido' })).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('404 de la respuesta temprana muestra «perfil no encontrado»', async () => {
    const requests = serveProfile();
    setEarly('nada', Response.json({ statusCode: 404, message: 'Not Found' }, { status: 404 }));

    renderWithProviders(<AppRouter />, { route: '/nada' });

    expect(
      await screen.findByRole('heading', { name: 'Perfil no encontrado' }),
    ).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('un reintento tras un 500 temprano hace una petición nueva', async () => {
    const requests = serveProfile();
    setEarly('demo', Response.json({ statusCode: 500, message: 'boom' }, { status: 500 }));
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/demo' });

    const alert = await screen.findByRole('alert');
    expect(requests).toEqual([]);
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(requests).toHaveLength(1));
  });
});
