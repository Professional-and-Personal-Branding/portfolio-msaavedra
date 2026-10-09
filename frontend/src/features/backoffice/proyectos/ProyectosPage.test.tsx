import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminProject, makeAdminSocialLink } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const openPage = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/proyectos' });
  const projects = await screen.findByRole('region', { name: 'Proyectos destacados' });
  await within(projects).findByText('Portafolio Administrable');
  const links = screen.getByRole('region', { name: 'Enlaces sociales' });
  await within(links).findByText('GitHub');
  return { projects, links };
};

describe('ProyectosPage', () => {
  it('lista proyectos y enlaces, incluidos los ocultos', async () => {
    server.use(...adminHandlers);
    const { projects, links } = await openPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument();

    const hiddenProject = within(projects).getByText('Bot de Pagos').closest('li');
    expect(hiddenProject).not.toBeNull();
    expect(within(hiddenProject as HTMLElement).getByText('Oculto')).toBeInTheDocument();
    expect(
      within(hiddenProject as HTMLElement).getByRole('link', {
        name: 'https://github.com/acme/pagos',
      }),
    ).toHaveAttribute('href', 'https://github.com/acme/pagos');
    expect(within(projects).getByText('Sin enlace')).toBeInTheDocument();

    const github = within(links).getByText('GitHub').closest('li') as HTMLElement;
    expect(within(github).getByText('Destacado')).toBeInTheDocument();
    expect(within(github).queryByText('Oculto')).not.toBeInTheDocument();
    const youtube = within(links).getByText('YouTube').closest('li') as HTMLElement;
    expect(within(youtube).getByText('Oculto')).toBeInTheDocument();
  });

  it('completar la URL de un proyecto envía un PATCH con la url', async () => {
    let body: Record<string, unknown> | undefined;
    let id: string | undefined;
    server.use(
      http.patch(`${API}/admin/projects/:id`, async ({ request, params }) => {
        id = String(params.id);
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminProject({ url: 'https://github.com/ada/portafolio' }));
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Portafolio Administrable' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('URL'), 'https://github.com/ada/portafolio');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(id).toBe('proj-1');
    expect(body).toMatchObject({
      url: 'https://github.com/ada/portafolio',
      name: 'Portafolio Administrable',
    });
    expect(await screen.findByText('Proyecto actualizado')).toBeInTheDocument();
  });

  it('una URL de proyecto sin http(s) no se envía', async () => {
    let called = false;
    server.use(
      http.patch(`${API}/admin/projects/:id`, () => {
        called = true;
        return HttpResponse.json(makeAdminProject());
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Portafolio Administrable' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('URL'), 'github.com/ada');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByText(/URL absoluta/)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('crea un enlace social con el cuerpo esperado', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API}/admin/social-links`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminSocialLink({ id: 'sl-3', platform: 'linkedin' }), {
          status: 201,
        });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Nuevo enlace' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Plataforma *'), 'linkedin');
    await user.type(within(dialog).getByLabelText('Usuario *'), 'ada-dev');
    await user.type(within(dialog).getByLabelText('URL *'), 'https://linkedin.com/in/ada-dev');
    await user.type(within(dialog).getByLabelText('Etiqueta (es)'), 'LinkedIn');
    await user.click(within(dialog).getByLabelText('Destacado'));
    await user.click(within(dialog).getByLabelText('Estadísticas (JSON)'));
    await user.paste('{"connections": 500}');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({
      platform: 'linkedin',
      handle: 'ada-dev',
      url: 'https://linkedin.com/in/ada-dev',
      label: { es: 'LinkedIn' },
      description: null,
      stats: { connections: 500 },
      featured: true,
      order: 0,
      visible: true,
    });
    expect(await screen.findByText('Enlace creado')).toBeInTheDocument();
  });

  it.each(['[1,2]', '{'])(
    'stats inválido (%s) bloquea el envío con un error en línea',
    async (raw) => {
      let called = false;
      server.use(
        http.patch(`${API}/admin/social-links/:id`, () => {
          called = true;
          return HttpResponse.json(makeAdminSocialLink());
        }),
        ...adminHandlers,
      );
      const user = userEvent.setup();

      await openPage();
      await user.click(screen.getByRole('button', { name: 'Editar enlace GitHub' }));

      const dialog = await screen.findByRole('dialog');
      const stats = within(dialog).getByLabelText('Estadísticas (JSON)');
      await user.clear(stats);
      await user.click(stats);
      await user.paste(raw);
      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      expect(await within(dialog).findByText(/deben ser un objeto JSON/)).toBeInTheDocument();
      expect(stats).toHaveAttribute('aria-invalid', 'true');
      expect(called).toBe(false);
    },
  );

  it('borrar un enlace social pide confirmación y envía DELETE', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete(`${API}/admin/social-links/:id`, ({ params }) => {
        deleted.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Borrar enlace YouTube' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('YouTube');
    expect(deleted).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(deleted).toEqual(['sl-2']));
    expect(await screen.findByText('Enlace borrado')).toBeInTheDocument();
  });
});

describe('ProyectosPage — aviso al descartar', () => {
  const PROMPT = 'Tenés cambios sin guardar';

  it('proyecto: espacios al borde no ensucian; un cambio real avisa', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Portafolio Administrable' }));

    await user.type(screen.getByLabelText('Nombre *'), ' ');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar Portafolio Administrable' }));
    await user.type(screen.getByLabelText('Nombre *'), ' 2');
    await user.keyboard('{Escape}');
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });

  it('enlace social: un guardado fallido (400) deja el formulario con cambios', async () => {
    server.use(
      http.patch(`${API}/admin/social-links/:id`, () =>
        HttpResponse.json({ message: 'inválido' }, { status: 400 }),
      ),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar enlace GitHub' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Usuario *'), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeEnabled(),
    );
    await user.keyboard('{Escape}');
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });

  it('enlace social: un JSON inválido en stats cuenta como cambio', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Nuevo enlace' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Estadísticas (JSON)'));
    await user.paste('{');
    await user.keyboard('{Escape}');
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });
});
