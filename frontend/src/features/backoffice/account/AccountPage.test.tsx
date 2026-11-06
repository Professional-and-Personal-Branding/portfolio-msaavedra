import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { ADMIN } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers, unauthorized } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Contraseñas ficticias de prueba (nunca reales).
const CURRENT = 'la-actual-de-prueba';
const NEXT = 'una-nueva-bien-larga';

const LOGIN_RESPONSE = {
  accessToken: 'jwt.nuevo.de.prueba',
  tokenType: 'Bearer',
  expiresIn: 86400,
  user: ADMIN,
};

interface Captured {
  bodies: unknown[];
}

function passwordHandler(
  captured: Captured,
  respond: () => Response | Promise<Response> = () => HttpResponse.json(LOGIN_RESPONSE),
) {
  return http.post(`${API}/auth/password`, async ({ request }) => {
    captured.bodies.push(await request.json());
    return respond();
  });
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  {
    current = CURRENT,
    next = NEXT,
    repeat = next,
  }: { current?: string; next?: string; repeat?: string },
) {
  await user.type(screen.getByLabelText('Contraseña actual'), current);
  await user.type(screen.getByLabelText('Nueva contraseña'), next);
  await user.type(screen.getByLabelText('Repetí la nueva contraseña'), repeat);
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

async function openAccount() {
  server.use(...adminHandlers);
  renderWithProviders(<AppRouter />, { route: '/admin/cuenta' });
  await screen.findByRole('heading', { level: 1, name: 'Cuenta' });
}

describe('AccountPage', () => {
  it('desde la barra se llega a /admin/cuenta y se ven el nombre y el email', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin' });
    await screen.findByRole('heading', { name: 'Dashboard' });

    const header = screen.getByRole('button', { name: 'Abrir menú' }).closest('header')!;
    const link = within(header).getByRole('link', { name: 'Cuenta' });
    expect(link).toHaveAttribute('href', '/admin/cuenta');
    await user.click(link);

    expect(await screen.findByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.getByTestId('account-name')).toHaveTextContent(ADMIN.name);
    expect(screen.getByTestId('account-email')).toHaveTextContent(ADMIN.email);
  });

  it('los campos tienen el autocomplete correcto y son de tipo contraseña', async () => {
    await openAccount();
    const current = screen.getByLabelText('Contraseña actual');
    const next = screen.getByLabelText('Nueva contraseña');
    const repeat = screen.getByLabelText('Repetí la nueva contraseña');

    expect(current).toHaveAttribute('autocomplete', 'current-password');
    expect(next).toHaveAttribute('autocomplete', 'new-password');
    expect(repeat).toHaveAttribute('autocomplete', 'new-password');
    for (const field of [current, next, repeat]) expect(field).toHaveAttribute('type', 'password');
  });

  it('éxito: avisa, vacía los campos, sigue en Cuenta y no guarda nada en el almacenamiento', async () => {
    const captured: Captured = { bodies: [] };
    const user = userEvent.setup();
    await openAccount();
    server.use(passwordHandler(captured));

    await fill(user, {});
    await submit(user);

    expect(
      await screen.findByText(
        'Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.',
      ),
    ).toBeInTheDocument();
    expect(captured.bodies).toEqual([{ currentPassword: CURRENT, newPassword: NEXT }]);
    await waitFor(() => expect(screen.getByLabelText('Contraseña actual')).toHaveValue(''));
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('');
    expect(screen.getByLabelText('Repetí la nueva contraseña')).toHaveValue('');
    expect(screen.getByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument();

    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    for (const secret of [CURRENT, NEXT, LOGIN_RESPONSE.accessToken]) {
      expect(stored).not.toContain(secret);
    }
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('contraseña actual incorrecta (401 y /me sigue en 200): muestra el aviso y no navega', async () => {
    const captured: Captured = { bodies: [] };
    const user = userEvent.setup();
    await openAccount();
    server.use(passwordHandler(captured, () => unauthorized()));

    await fill(user, {});
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña actual no es correcta',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('sesión revocada (401 y /me también 401): vuelve al login', async () => {
    let revoked = false;
    // Los handlers propios van antes: gana el primero que coincide.
    server.use(
      http.get(`${API}/auth/me`, () => (revoked ? unauthorized() : HttpResponse.json(ADMIN))),
      http.post(`${API}/auth/password`, () => {
        revoked = true;
        return unauthorized();
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    // Con el cliente real de la app: el 401 de la mutación invalida la sesión.
    const router = createMemoryRouter([{ path: '*', element: <AppRouter /> }], {
      initialEntries: ['/admin/cuenta'],
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Cuenta' });

    await fill(user, {});
    await submit(user);

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('429: muestra el aviso de demasiados intentos', async () => {
    const user = userEvent.setup();
    await openAccount();
    server.use(
      passwordHandler({ bodies: [] }, () =>
        HttpResponse.json({ statusCode: 429, message: 'Demasiados' }, { status: 429 }),
      ),
    );

    await fill(user, {});
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Probá de nuevo en unos minutos.',
    );
  });

  it('400: muestra que la API rechazó la contraseña nueva', async () => {
    const user = userEvent.setup();
    await openAccount();
    server.use(
      passwordHandler({ bodies: [] }, () =>
        HttpResponse.json({ statusCode: 400, message: 'mal' }, { status: 400 }),
      ),
    );

    await fill(user, {});
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La API rechazó la contraseña nueva. Revisá las reglas.',
    );
  });

  it('otro error: usa el mensaje de red del login', async () => {
    const user = userEvent.setup();
    await openAccount();
    server.use(passwordHandler({ bodies: [] }, () => HttpResponse.error()));

    await fill(user, {});
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos contactar al servidor. Intentá de nuevo.',
    );
  });

  it('la repetición distinta muestra el error y no llama a la API', async () => {
    const captured: Captured = { bodies: [] };
    const user = userEvent.setup();
    await openAccount();
    server.use(passwordHandler(captured));

    await fill(user, { repeat: 'otra-contraseña-distinta' });
    await submit(user);

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(captured.bodies).toEqual([]);
  });

  it('una nueva de 11 caracteres muestra «Usá al menos 12 caracteres» al salir del campo', async () => {
    const captured: Captured = { bodies: [] };
    const user = userEvent.setup();
    await openAccount();
    server.use(passwordHandler(captured));

    await user.type(screen.getByLabelText('Contraseña actual'), CURRENT);
    await user.type(screen.getByLabelText('Nueva contraseña'), 'a'.repeat(11));
    await user.tab();

    expect(await screen.findByText('Usá al menos 12 caracteres')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Repetí la nueva contraseña'), 'a'.repeat(11));
    await submit(user);
    expect(captured.bodies).toEqual([]);
  });

  it('una nueva igual a la actual no llama a la API', async () => {
    const captured: Captured = { bodies: [] };
    const user = userEvent.setup();
    await openAccount();
    server.use(passwordHandler(captured));

    await fill(user, { current: NEXT, next: NEXT });
    await submit(user);

    expect(
      await screen.findByText('La nueva contraseña tiene que ser distinta de la actual'),
    ).toBeInTheDocument();
    expect(captured.bodies).toEqual([]);
  });

  it('sin la contraseña actual pide escribirla', async () => {
    const user = userEvent.setup();
    await openAccount();

    await user.type(screen.getByLabelText('Nueva contraseña'), NEXT);
    await user.type(screen.getByLabelText('Repetí la nueva contraseña'), NEXT);
    await submit(user);

    expect(await screen.findByText('Escribí tu contraseña actual')).toBeInTheDocument();
  });
});
