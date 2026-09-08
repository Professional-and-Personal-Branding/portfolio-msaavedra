import { screen, waitFor, within } from '@testing-library/react';
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

    await user.type(screen.getByLabelText('Empresa *'), 'Umbrella');
    await user.type(screen.getByLabelText('Ubicación *'), 'Remoto');
    await user.type(screen.getByLabelText('Rol (es)'), 'Arquitecto');
    await user.type(screen.getByLabelText('Inicio *'), '2024-01');
    await user.type(screen.getByLabelText('Resumen (es)'), 'Diseño de plataformas');
    await user.type(screen.getByLabelText('Tags'), 'java');
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
