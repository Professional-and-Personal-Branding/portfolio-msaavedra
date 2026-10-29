import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// add-curated-profile-lifecycle: un link enviado no enumera a los demás, y un
// slug anterior pasa al canónico.
describe('CuratedProfilePage — menú y slug canónico', () => {
  const profilesList = () =>
    http.get(`${API}/curated-profiles`, () =>
      HttpResponse.json([
        { slug: 'all', title: 'Perfil completo', roleType: '', techFocus: null },
        { slug: 'otro-perfil', title: 'Otro', roleType: 'Backend', techFocus: 'Java' },
      ]),
    );

  it('en /:slug no hay menú de perfiles ni enlaces a otro slug', async () => {
    server.use(
      profilesList(),
      http.get(`${API}/curated-profiles/:slug`, () =>
        HttpResponse.json(makeCuratedProfile({ slug: 'demo' })),
      ),
    );
    renderWithProviders(<AppRouter />, { route: '/demo' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });

    expect(screen.queryByRole('button', { name: 'Perfiles' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).toBeNull();
    const otrosSlugs = screen
      .queryAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => /^\/[a-z0-9-]+(\?|$)/.test(href) && !href.startsWith('/demo'));
    expect(otrosSlugs).toEqual([]);
  });

  it('en la home sí está el menú de perfiles', async () => {
    server.use(
      profilesList(),
      http.get(`${API}/curated-profiles/:slug`, () =>
        HttpResponse.json(makeCuratedProfile({ slug: 'all' })),
      ),
    );
    renderWithProviders(<AppRouter />, { route: '/' });
    expect(await screen.findByRole('button', { name: 'Perfiles' })).toBeInTheDocument();
  });

  it('resuelto por un slug anterior, la vista pasa al slug canónico', async () => {
    const pedidos: string[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ params }) => {
        pedidos.push(String(params.slug));
        return HttpResponse.json(makeCuratedProfile({ slug: 'acme-lead', title: 'Acme' }));
      }),
    );
    renderWithProviders(<AppRouter />, { route: '/acme-tech-lead?lang=es' });

    await waitFor(() => expect(pedidos).toContain('acme-lead'));
    expect(pedidos[0]).toBe('acme-tech-lead');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
  });
});

describe('CuratedProfilePage', () => {
  it('renderiza el perfil curado con sus secciones y pide la API con ?locale=', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(makeCuratedProfile({ slug: 'demo', title: 'Perfil demo' }));
      }),
    );

    renderWithProviders(<AppRouter />, { route: '/demo' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
    // El hero llega primero; el resto de las secciones se revelan en una transición (D1).
    expect(
      await screen.findByRole('heading', { name: 'Experiencia Profesional' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Habilidades Técnicas' })).toBeInTheDocument();
    // projects y presence llegan en `sections` (el backend ya aplicó el relleno)
    expect(screen.getByRole('heading', { name: 'Proyectos Destacados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Presencia Pública' })).toBeInTheDocument();
    expect(urls[0]).toBe(`${API}/curated-profiles/demo?locale=es`);
    expect(document.title).toBe('Perfil demo · Ada Ejemplo');
  });

  it('?lang=en pide locale=en y traduce la interfaz', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(makeCuratedProfile({ slug: 'demo' }));
      }),
    );

    renderWithProviders(<AppRouter />, { route: '/demo?lang=en' });

    expect(
      await screen.findByRole('heading', { name: 'Professional Experience' }),
    ).toBeInTheDocument();
    expect(urls[0]).toBe(`${API}/curated-profiles/demo?locale=en`);
  });

  it('401 → formulario de token → reintenta con X-Access-Token y refleja ?token=', async () => {
    const headers: (string | null)[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        const token = request.headers.get('x-access-token');
        headers.push(token);
        if (token === 'secreto') {
          return HttpResponse.json(
            makeCuratedProfile({ slug: 'privado', visibility: 'PROTECTED' }),
          );
        }
        return HttpResponse.json(
          { statusCode: 401, message: 'Token requerido', error: 'Unauthorized' },
          { status: 401 },
        );
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/privado' });

    const form = await screen.findByRole('heading', { name: 'Perfil protegido' });
    expect(form).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Token de acceso'), 'incorrecto');
    await user.click(screen.getByRole('button', { name: 'Acceder' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Token incorrecto');

    await user.clear(screen.getByLabelText('Token de acceso'));
    await user.type(screen.getByLabelText('Token de acceso'), 'secreto');
    await user.click(screen.getByRole('button', { name: 'Acceder' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
    expect(headers).toEqual([null, 'incorrecto', 'secreto']);
  });

  it('?token= en la URL se usa automáticamente', async () => {
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) =>
        request.headers.get('x-access-token') === 'abc'
          ? HttpResponse.json(makeCuratedProfile({ slug: 'privado' }))
          : HttpResponse.json(
              { statusCode: 401, message: 'no', error: 'Unauthorized' },
              { status: 401 },
            ),
      ),
    );

    renderWithProviders(<AppRouter />, { route: '/privado?token=abc' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Perfil protegido' })).not.toBeInTheDocument();
  });

  it('404 muestra la página de perfil no encontrado con enlace a la home', async () => {
    renderWithProviders(<AppRouter />, { route: '/no-existe' });

    expect(
      await screen.findByRole('heading', { name: 'Perfil no encontrado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir al perfil completo/ })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('error de red → estado de error → reintentar vuelve a pedir', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/curated-profiles/:slug`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.error()
          : HttpResponse.json(makeCuratedProfile({ slug: 'demo' }));
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/demo' });

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'No pudimos cargar el perfil' }),
    ).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls).toBe(2));
  });

  it('la home renderiza el perfil `all`', async () => {
    renderWithProviders(<AppRouter />, { route: '/' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Perfil completo · Ada Ejemplo');
  });
});

// change `add-share-links`: `via` y `src` viajan a la API, no a la navegación interna ni al SEO.
describe('CuratedProfilePage — atribución del link (via y src)', () => {
  it('pide la API con locale, via y src en ese orden y sin tocar canonical ni og:url', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(makeCuratedProfile({ slug: 'demo', title: 'Perfil demo' }));
      }),
    );

    renderWithProviders(<AppRouter />, {
      route: '/demo?src=indeed&via=k7m2q9xw4t&lang=en',
    });

    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    expect(urls).toEqual([`${API}/curated-profiles/demo?locale=en&via=k7m2q9xw4t&src=indeed`]);
    await waitFor(() => expect(document.title).toBe('Perfil demo · Ada Ejemplo'));
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    expect(canonical?.href).toBe(`${window.location.origin}/demo`);
    expect(ogUrl?.content).toBe(`${window.location.origin}/demo`);
  });

  it('sin via ni src la query queda como siempre (solo locale)', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(makeCuratedProfile({ slug: 'demo' }));
      }),
    );

    renderWithProviders(<AppRouter />, { route: '/demo?via=&src=' });

    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    expect(urls).toEqual([`${API}/curated-profiles/demo?locale=es`]);
  });

  it('el via va tal cual está en la URL: el cliente no lo valida', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(makeCuratedProfile({ slug: 'demo' }));
      }),
    );

    renderWithProviders(<AppRouter />, { route: '/demo?via=no-existe&src=Mi%20Portal' });

    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    const url = new URL(urls[0] ?? '');
    expect(url.searchParams.get('via')).toBe('no-existe');
    expect(url.searchParams.get('src')).toBe('Mi Portal');
  });

  it('PROTECTED: el token escrito a mano conserva el via y la visita del reintento se atribuye', async () => {
    const seen: { token: string | null; via: string | null }[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        const token = request.headers.get('x-access-token');
        seen.push({ token, via: new URL(request.url).searchParams.get('via') });
        return token === 'secreto'
          ? HttpResponse.json(makeCuratedProfile({ slug: 'privado', visibility: 'PROTECTED' }))
          : HttpResponse.json(
              { statusCode: 401, message: 'Token requerido', error: 'Unauthorized' },
              { status: 401 },
            );
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/privado?via=k7m2q9xw4t' });

    await screen.findByRole('heading', { name: 'Perfil protegido' });
    await user.type(screen.getByLabelText('Token de acceso'), 'secreto');
    await user.click(screen.getByRole('button', { name: 'Acceder' }));

    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    expect(seen).toEqual([
      { token: null, via: 'k7m2q9xw4t' },
      { token: 'secreto', via: 'k7m2q9xw4t' },
    ]);
  });

  it('cambiar el idioma conserva el via en la nueva petición', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(makeCuratedProfile({ slug: 'demo' }));
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/demo?via=k7m2q9xw4t' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });

    await user.click(screen.getByRole('button', { name: 'en' }));

    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[1]).toBe(`${API}/curated-profiles/demo?locale=en&via=k7m2q9xw4t`);
  });
});
