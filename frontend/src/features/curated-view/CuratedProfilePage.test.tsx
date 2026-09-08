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
    expect(screen.getByRole('heading', { name: 'Experiencia Profesional' })).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Habilidades Técnicas' })).toBeInTheDocument();
    // projects y presence no están en `sections` pero tienen datos → al final
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
