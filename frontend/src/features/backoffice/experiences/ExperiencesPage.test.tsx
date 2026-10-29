import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { ADMIN_EXPERIENCES, makeAdminExperience } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const openPage = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/experiencias' });
  await screen.findByRole('heading', { name: 'Experiencias' });
  return screen.findAllByRole('listitem');
};

describe('ExperiencesPage', () => {
  it('lista todas las experiencias e identifica las ocultas', async () => {
    server.use(...adminHandlers);

    const items = await openPage();

    expect(items).toHaveLength(ADMIN_EXPERIENCES.length);
    expect(screen.getByText('Acme Corp', { exact: false })).toBeInTheDocument();
    const hidden = items.find((item) => item.textContent?.includes('Initech'));
    expect(hidden).toHaveAttribute('data-visible', 'false');
    expect(within(hidden!).getByText('Oculta')).toBeInTheDocument();
    // fix-admin-contrast, D1: sin opacidad; borde punteado y fondo suave.
    expect(hidden!.className).not.toMatch(/(^|\s)opacity-/);
    expect(hidden).toHaveClass('surface-hidden');
    const visible = items.find((item) => item.textContent?.includes('Acme Corp'));
    expect(visible).toHaveClass('surface');
    expect(visible).not.toHaveClass('surface-hidden');
  });

  it('crea una experiencia enviando los textos bilingües', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API}/admin/experiences`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminExperience({ id: 'exp-nueva' }), { status: 201 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: /Nueva experiencia/ }));

    // Pegar en vez de tipear: el test verifica el payload, no el tecleo, y cada tecla es un
    // render del formulario (con ~55 teclas superaba el testTimeout con la CPU saturada).
    const fill = async (label: string, text: string) => {
      await user.click(screen.getByLabelText(label));
      await user.paste(text);
    };
    await fill('Empresa *', 'Umbrella');
    await fill('Ubicación *', 'Remoto');
    await fill('Rol (es)', 'Arquitecto');
    await user.type(screen.getByLabelText('Inicio *'), '2024-01');
    await fill('Resumen (es)', 'Diseño de plataformas');
    await fill('Tags', 'java');
    await user.click(screen.getByRole('button', { name: 'Agregar Tags' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      company: 'Umbrella',
      location: 'Remoto',
      role: { es: 'Arquitecto' },
      startDate: '2024-01',
      summary: { es: 'Diseño de plataformas' },
      tags: ['java'],
    });
    expect(await screen.findByText('Experiencia creada')).toBeInTheDocument();
  });

  it('no llama a la API si faltan campos obligatorios', async () => {
    let called = false;
    server.use(
      http.post(`${API}/admin/experiences`, () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: /Nueva experiencia/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining([
        'La empresa es obligatoria',
        'El rol en español es obligatorio',
        'La ubicación es obligatoria',
      ]),
    );
    expect(called).toBe(false);
  });

  it('marcar "Actual" deshabilita la fecha de fin y la envía como null', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${API}/admin/experiences/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminExperience());
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Globex' }));

    const endDate = screen.getByLabelText('Fin');
    expect(endDate).toBeEnabled();
    expect(endDate).toHaveValue('2022-02');

    await user.click(screen.getByLabelText('Actual'));
    expect(endDate).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ current: true, endDate: null });
  });

  describe('logros bilingües', () => {
    const capturePatch = () => {
      const state: { body?: Record<string, unknown> } = {};
      server.use(
        http.patch(`${API}/admin/experiences/:id`, async ({ request }) => {
          state.body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(makeAdminExperience());
        }),
        ...adminHandlers,
      );
      return state;
    };

    it('escribe los logros en los dos idiomas y los envía en el cuerpo', async () => {
      const state = capturePatch();
      const user = userEvent.setup();

      await openPage();
      await user.click(screen.getByRole('button', { name: 'Editar Globex' }));

      await user.click(screen.getByLabelText('Logros (es)'));
      await user.paste('Migró el monolito');
      await user.click(screen.getByRole('button', { name: 'Agregar Logros (es)' }));
      await user.click(screen.getByLabelText('Logros (en)'));
      await user.paste('Migrated the monolith');
      await user.click(screen.getByRole('button', { name: 'Agregar Logros (en)' }));
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(state.body).toBeDefined());
      expect(state.body?.highlights).toEqual({
        es: ['Redujo latencia', 'Migró el monolito'],
        en: ['Reduced latency', 'Migrated the monolith'],
      });
    });

    it('editar solo el español conserva highlights.en en el PATCH', async () => {
      const state = capturePatch();
      const user = userEvent.setup();

      await openPage();
      await user.click(screen.getByRole('button', { name: 'Editar Globex' }));
      expect(screen.getByLabelText('Logros (en) 1')).toHaveValue('Reduced latency');

      const first = screen.getByLabelText('Logros (es) 1');
      // `change` y no clear+paste: al vaciar la fila cambia su key y se pierde el foco.
      fireEvent.change(first, { target: { value: 'Redujo la latencia a la mitad' } });
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(state.body).toBeDefined());
      expect(state.body?.highlights).toEqual({
        es: ['Redujo la latencia a la mitad'],
        en: ['Reduced latency'],
      });
    });

    it('una experiencia sin logros en inglés abre el campo vacío y editable', async () => {
      const state = capturePatch();
      server.use(
        http.get(`${API}/admin/experiences`, () =>
          HttpResponse.json([
            makeAdminExperience({ highlights: { es: ['Solo español'], en: [] } }),
          ]),
        ),
      );
      const user = userEvent.setup();

      await openPage();
      await user.click(screen.getByRole('button', { name: 'Editar Acme Corp' }));

      expect(screen.queryByLabelText('Logros (en) 1')).not.toBeInTheDocument();
      const field = screen.getByLabelText('Logros (en)');
      expect(field).toHaveValue('');
      expect(field).toBeEnabled();

      await user.click(field);
      await user.paste('English only now');
      await user.click(screen.getByRole('button', { name: 'Agregar Logros (en)' }));
      await user.click(screen.getByRole('button', { name: 'Guardar' }));
      await waitFor(() => expect(state.body).toBeDefined());
      expect(state.body?.highlights).toEqual({ es: ['Solo español'], en: ['English only now'] });
    });
  });

  it('borra solo tras confirmar', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete(`${API}/admin/experiences/:id`, ({ params }) => {
        deleted.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();

    await user.click(screen.getByRole('button', { name: 'Borrar Acme Corp' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(deleted).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Borrar Acme Corp' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Backend Senior');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(deleted).toEqual(['exp-1']));
  });

  it('un error del servidor se muestra y el formulario no se cierra', async () => {
    server.use(
      http.post(`${API}/admin/experiences`, () =>
        HttpResponse.json(
          { statusCode: 400, message: ['startDate must be YYYY-MM'], error: 'Bad Request' },
          { status: 400 },
        ),
      ),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: /Nueva experiencia/ }));
    await user.type(screen.getByLabelText('Empresa *'), 'Umbrella');
    await user.type(screen.getByLabelText('Ubicación *'), 'Remoto');
    await user.type(screen.getByLabelText('Rol (es)'), 'Arquitecto');
    await user.type(screen.getByLabelText('Inicio *'), '2024-01');
    await user.type(screen.getByLabelText('Resumen (es)'), 'Resumen');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('startDate must be YYYY-MM')).toBeInTheDocument();
    expect(screen.getByLabelText('Empresa *')).toHaveValue('Umbrella');
  });
});

describe('ExperiencesPage — aviso al descartar', () => {
  const PROMPT = 'Tenés cambios sin guardar';

  it('Escape con cambios abre el aviso y conserva lo editado; Seguir editando lo cierra', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Globex' }));

    await user.type(screen.getByLabelText('Empresa *'), ' SA');
    await user.keyboard('{Escape}');

    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByLabelText('Empresa *')).toHaveValue('Globex SA');
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Empresa *')).toHaveValue('Globex SA');
  });

  it('Descartar cierra sin guardar y al reabrir muestra lo guardado', async () => {
    let patched = false;
    server.use(
      http.patch(`${API}/admin/experiences/:id`, () => {
        patched = true;
        return HttpResponse.json(makeAdminExperience());
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Globex' }));
    await user.type(screen.getByLabelText('Empresa *'), ' SA');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patched).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Editar Globex' }));
    expect(screen.getByLabelText('Empresa *')).toHaveValue('Globex');
  });

  it('un alta con cambios también avisa; sin tocar nada cierra directo', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: /Nueva experiencia/ }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nueva experiencia/ }));
    await user.type(screen.getByLabelText('Empresa *'), 'Umbrella');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });

  it('un espacio al borde no ensucia', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Globex' }));

    await user.type(screen.getByLabelText('Empresa *'), ' ');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });
});
