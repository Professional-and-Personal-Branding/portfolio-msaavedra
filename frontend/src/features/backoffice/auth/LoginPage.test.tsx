import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { preloadBackoffice } from '@/app/lazy-backoffice';
import { AppRouter } from '@/app/router';
import { ADMIN } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers, anonymousHandlers, unauthorized } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeAll(preloadBackoffice);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LoginPage', () => {
  it('con credenciales válidas entra al panel y no guarda el token', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        bodies.push(await request.json());
        server.use(...adminHandlers);
        return HttpResponse.json({
          accessToken: 'jwt.secreto.aqui',
          tokenType: 'Bearer',
          expiresIn: 86400,
          user: ADMIN,
        });
      }),
      ...anonymousHandlers,
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/admin/login' });

    await user.type(await screen.findByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByTestId('admin-name')).toHaveTextContent('Ada Administradora');
    expect(bodies[0]).toEqual({ email: 'admin@example.com', password: 'secreta' });

    // El JWT nunca toca el almacenamiento del navegador (CLAUDE.md).
    expect(JSON.stringify(localStorage)).not.toContain('jwt.secreto.aqui');
    expect(JSON.stringify(sessionStorage)).not.toContain('jwt.secreto.aqui');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('credenciales inválidas muestran el error y conservan el email', async () => {
    server.use(
      http.post(`${API}/auth/login`, () => unauthorized()),
      ...anonymousHandlers,
    );
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/admin/login' });

    await user.type(await screen.findByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});

describe('RequireSession', () => {
  it('sin sesión redirige al login y vuelve al destino tras autenticarse', async () => {
    server.use(...anonymousHandlers);
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/admin/experiencias' });

    expect(await screen.findByRole('heading', { name: 'Backoffice' })).toBeInTheDocument();

    server.use(
      http.post(`${API}/auth/login`, () => {
        server.use(...adminHandlers);
        return HttpResponse.json({
          accessToken: 'jwt',
          tokenType: 'Bearer',
          expiresIn: 86400,
          user: ADMIN,
        });
      }),
    );

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Experiencias' })).toBeInTheDocument();
  });

  it('con sesión válida renderiza la ruta pedida sin pasar por el login', async () => {
    server.use(...adminHandlers);

    renderWithProviders(<AppRouter />, { route: '/admin/skills' });

    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('al cerrar sesión llama al logout y vuelve al login', async () => {
    const requests: string[] = [];
    const record = ({ request }: { request: Request }) =>
      void requests.push(`${request.method} ${new URL(request.url).pathname}`);
    server.events.on('request:start', record);
    server.use(...adminHandlers);
    const user = userEvent.setup();

    renderWithProviders(<AppRouter />, { route: '/admin' });
    await screen.findByRole('heading', { name: 'Dashboard' });

    // Tras cerrar sesión, la API deja de reconocerla.
    server.use(...anonymousHandlers);
    await user.click(screen.getByRole('button', { name: /Cerrar sesión/ }));

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    await waitFor(() => expect(requests).toContain('POST /api/auth/logout'));
    server.events.removeListener('request:start', record);
  });
});
