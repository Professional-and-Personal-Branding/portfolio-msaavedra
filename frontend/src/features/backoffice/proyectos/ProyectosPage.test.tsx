import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminProject, makeAdminRepository, makeAdminSocialLink } from '@/test/fixtures/admin';
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

    expect(
      screen.getByRole('heading', { level: 1, name: 'Proyectos, repositorios y enlaces' }),
    ).toBeInTheDocument();

    const hiddenProject = within(projects).getByText('Bot de Pagos').closest('li');
    expect(hiddenProject).not.toBeNull();
    expect(within(hiddenProject as HTMLElement).getByText('Oculto')).toBeInTheDocument();
    expect((hiddenProject as HTMLElement).className).not.toMatch(/(^|\s)opacity-/);
    expect(hiddenProject).toHaveClass('surface-hidden');
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
    expect(youtube.className).not.toMatch(/(^|\s)opacity-/);
    expect(youtube).toHaveClass('surface-hidden');
    expect(github).toHaveClass('surface');
    expect(github).not.toHaveClass('surface-hidden');
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

// Change add-featured-repositories (D2, D12): bloque «Repositorios destacados».
describe('ProyectosPage — repositorios destacados', () => {
  const openRepositories = async () => {
    renderWithProviders(<AppRouter />, { route: '/admin/proyectos' });
    const region = await screen.findByRole('region', { name: 'Repositorios destacados' });
    await within(region).findByText('reservas-api');
    return region;
  };

  it('va entre Proyectos y Enlaces y marca los ocultos', async () => {
    server.use(...adminHandlers);
    const region = await openRepositories();

    const names = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(names.indexOf('Proyectos destacados')).toBeLessThan(
      names.indexOf('Repositorios destacados'),
    );
    expect(names.indexOf('Repositorios destacados')).toBeLessThan(
      names.indexOf('Enlaces sociales'),
    );

    const hidden = within(region).getByText('experimento-oculto').closest('li') as HTMLElement;
    expect(within(hidden).getByText('Oculto')).toBeInTheDocument();
    expect(hidden).toHaveClass('surface-hidden');
    const visible = within(region).getByText('reservas-api').closest('li') as HTMLElement;
    expect(within(visible).queryByText('Oculto')).not.toBeInTheDocument();
    expect(
      within(visible).getByRole('link', { name: 'https://github.com/ejemplo/reservas-api' }),
    ).toHaveAttribute('href', 'https://github.com/ejemplo/reservas-api');
  });

  it('una URL que no es de GitHub no se envía y muestra el mensaje literal', async () => {
    let called = false;
    server.use(
      http.post(`${API}/admin/featured-repositories`, () => {
        called = true;
        return HttpResponse.json(makeAdminRepository(), { status: 201 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    const region = await openRepositories();

    await user.click(within(region).getByRole('button', { name: 'Nuevo repositorio' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/URL de GitHub/), 'https://gitlab.com/a/b');
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(
      await within(dialog).findByText(
        'La URL tiene que ser https://github.com/<usuario>/<repositorio>',
      ),
    ).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('propone el nombre desde la URL al salir del campo, y es editable', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    const region = await openRepositories();

    await user.click(within(region).getByRole('button', { name: 'Nuevo repositorio' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/^Nombre/);
    expect(name).toHaveValue('');
    await user.type(
      within(dialog).getByLabelText(/URL de GitHub/),
      'https://github.com/octo-org/api-reservas',
    );
    await user.tab();
    expect(name).toHaveValue('api-reservas');

    await user.clear(name);
    await user.type(name, 'Mi nombre');
    await user.click(within(dialog).getByLabelText(/URL de GitHub/));
    await user.tab();
    expect(name).toHaveValue('Mi nombre');
  });

  it('crea un repositorio con el cuerpo esperado, sin stars', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API}/admin/featured-repositories`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminRepository({ id: 'repo-3' }), { status: 201 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    const region = await openRepositories();

    await user.click(within(region).getByRole('button', { name: 'Nuevo repositorio' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText(/URL de GitHub/),
      'https://github.com/octo-org/api-reservas',
    );
    await user.tab();
    await user.type(within(dialog).getByLabelText('Descripción (es)'), 'API de reservas');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      name: 'api-reservas',
      url: 'https://github.com/octo-org/api-reservas',
      language: null,
      description: { es: 'API de reservas' },
      visible: true,
    });
    expect(body).not.toHaveProperty('stars');
    expect(await screen.findByText('Repositorio creado')).toBeInTheDocument();
  });

  it('un 409 muestra «Ese repositorio ya está cargado» en el campo URL, sin aviso', async () => {
    server.use(
      http.post(`${API}/admin/featured-repositories`, () =>
        HttpResponse.json(
          { statusCode: 409, message: 'Repositorio destacado: Ese repositorio ya está cargado' },
          { status: 409 },
        ),
      ),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    const region = await openRepositories();

    await user.click(within(region).getByRole('button', { name: 'Nuevo repositorio' }));
    const dialog = await screen.findByRole('dialog');
    const url = within(dialog).getByLabelText(/URL de GitHub/);
    await user.type(url, 'https://github.com/ejemplo/reservas-api');
    await user.tab();
    await user.type(within(dialog).getByLabelText('Descripción (es)'), 'API de reservas');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByText('Ese repositorio ya está cargado')).toBeInTheDocument();
    expect(screen.queryByText(/Repositorio destacado:/)).not.toBeInTheDocument();

    // Al editar la URL el error del servidor deja de aplicar.
    await user.type(url, '-2');
    expect(within(dialog).queryByText('Ese repositorio ya está cargado')).not.toBeInTheDocument();
  });

  it('editar solo el nombre envía un PATCH', async () => {
    let id: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${API}/admin/featured-repositories/:id`, async ({ request, params }) => {
        id = String(params.id);
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminRepository({ name: 'otro' }));
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    const region = await openRepositories();

    await user.click(
      within(region).getByRole('button', { name: 'Editar repositorio reservas-api' }),
    );
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/^Nombre/);
    await user.clear(name);
    await user.type(name, 'otro');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(id).toBe('repo-1');
    expect(body).toMatchObject({ name: 'otro', url: 'https://github.com/ejemplo/reservas-api' });
    expect(await screen.findByText('Repositorio actualizado')).toBeInTheDocument();
  });

  it('borrar pide confirmación y envía el DELETE', async () => {
    let deleted: string | undefined;
    server.use(
      http.delete(`${API}/admin/featured-repositories/:id`, ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    const region = await openRepositories();

    await user.click(
      within(region).getByRole('button', { name: 'Borrar repositorio reservas-api' }),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(deleted).toBeUndefined();
    await user.click(within(confirm).getByRole('button', { name: /Borrar|Confirmar|Sí/ }));

    await waitFor(() => expect(deleted).toBe('repo-1'));
    expect(await screen.findByText('Repositorio borrado')).toBeInTheDocument();
  });

  it('cancelar con cambios sin guardar pide confirmación', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    const region = await openRepositories();

    await user.click(
      within(region).getByRole('button', { name: 'Editar repositorio reservas-api' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Nombre/), ' nuevo');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByText(/cambios sin guardar/i)).toBeInTheDocument();
  });

  it('?editar=<id> abre el diálogo del repositorio', async () => {
    server.use(...adminHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin/proyectos?editar=repo-2' });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Editar experimento-oculto')).toBeInTheDocument();
  });
});
