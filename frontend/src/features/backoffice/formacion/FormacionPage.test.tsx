import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import {
  ADMIN_CERTIFICATIONS,
  ADMIN_EDUCATION,
  makeAdminCertification,
  makeAdminEducation,
} from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const openPage = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/formacion' });
  await screen.findByRole('heading', { name: 'Formación', level: 1 });
  const education = screen.getByRole('region', { name: 'Educación' });
  const certifications = screen.getByRole('region', { name: 'Certificaciones' });
  await within(education).findAllByRole('listitem');
  await within(certifications).findAllByRole('listitem');
  return { education, certifications };
};

describe('FormacionPage', () => {
  it('lista educación y certificaciones, incluidas las ocultas con su badge', async () => {
    server.use(...adminHandlers);

    const { education, certifications } = await openPage();

    const educationItems = within(education).getAllByRole('listitem');
    expect(educationItems).toHaveLength(ADMIN_EDUCATION.length);
    expect(within(certifications).getAllByRole('listitem')).toHaveLength(
      ADMIN_CERTIFICATIONS.length,
    );

    const hidden = educationItems.find((item) => item.textContent?.includes('Maestría'));
    expect(hidden).toHaveAttribute('data-visible', 'false');
    expect(within(hidden!).getByText('Oculto')).toBeInTheDocument();
    expect(hidden).toHaveTextContent('en curso');

    const visible = educationItems.find((item) => item.textContent?.includes('Ingeniería'));
    expect(within(visible!).queryByText('Oculto')).not.toBeInTheDocument();
    expect(within(certifications).getByText('Scrum Master')).toBeInTheDocument();
  });

  it('muestra estados vacíos cuando no hay datos', async () => {
    server.use(
      http.get(`${API}/admin/education`, () => HttpResponse.json([])),
      http.get(`${API}/admin/certifications`, () => HttpResponse.json([])),
      ...adminHandlers,
    );

    renderWithProviders(<AppRouter />, { route: '/admin/formacion' });

    expect(await screen.findByText('Todavía no hay formación cargada')).toBeInTheDocument();
    expect(await screen.findByText('Todavía no hay certificaciones')).toBeInTheDocument();
  });

  it('crea una formación con POST y el cuerpo esperado', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API}/admin/education`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminEducation({ id: 'edu-nueva' }), { status: 201 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    const { education } = await openPage();
    await user.click(within(education).getByRole('button', { name: /Nueva formación/ }));

    await user.type(screen.getByLabelText('Título (es)'), 'Licenciatura en Informática');
    await user.type(screen.getByLabelText('Institución *'), 'UBA');
    await user.type(screen.getByLabelText('Inicio *'), '2012');
    await user.click(screen.getByLabelText('En curso'));
    expect(screen.getByLabelText('Fin')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({
      degree: { es: 'Licenciatura en Informática' },
      institution: 'UBA',
      startDate: '2012',
      endDate: null,
      inProgress: true,
      order: 0,
      visible: true,
    });
    expect(await screen.findByText('Formación creada')).toBeInTheDocument();
  });

  it('ocultar una certificación envía PATCH con visible: false sin borrarla', async () => {
    let body: Record<string, unknown> | undefined;
    let patchedId: string | undefined;
    let deleted = false;
    server.use(
      http.patch(`${API}/admin/certifications/:id`, async ({ request, params }) => {
        patchedId = String(params.id);
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminCertification({ visible: false }));
      }),
      http.delete(`${API}/admin/certifications/:id`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Scrum Master' }));

    const visible = screen.getByLabelText('Visible en el sitio');
    expect(visible).toBeChecked();
    await user.click(visible);
    expect(visible).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(patchedId).toBe('cert-1');
    expect(body).toMatchObject({ visible: false, issuer: 'Scrum Alliance', year: '2021' });
    expect(await screen.findByText('Certificación actualizada')).toBeInTheDocument();
    expect(deleted).toBe(false);
  });

  it('borra una certificación solo tras confirmar', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete(`${API}/admin/certifications/:id`, ({ params }) => {
        deleted.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();

    await user.click(screen.getByRole('button', { name: 'Borrar Arquitecto Cloud' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(deleted).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Borrar Arquitecto Cloud' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Arquitecto Cloud');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(deleted).toEqual(['cert-2']));
    expect(await screen.findByText('Certificación borrada')).toBeInTheDocument();
  });

  it('la validación de cliente bloquea una fecha inválida', async () => {
    let called = false;
    server.use(
      http.patch(`${API}/admin/education/:id`, () => {
        called = true;
        return HttpResponse.json(makeAdminEducation());
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Ingeniería de Sistemas' }));

    const start = screen.getByLabelText('Inicio *');
    expect(start).toHaveValue('2010-03');
    await user.clear(start);
    await user.type(start, '2010-13');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usá el formato AAAA-MM o AAAA');
    expect(start).toHaveAttribute('aria-invalid', 'true');
    expect(called).toBe(false);
  });

  it('exige los obligatorios de una certificación y un año AAAA', async () => {
    let called = false;
    server.use(
      http.post(`${API}/admin/certifications`, () => {
        called = true;
        return HttpResponse.json(makeAdminCertification(), { status: 201 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    const { certifications } = await openPage();
    await user.click(within(certifications).getByRole('button', { name: /Nueva certificación/ }));
    await user.type(screen.getByLabelText('Año'), '21');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining([
        'El nombre en español es obligatorio',
        'El emisor es obligatorio',
        'Usá el formato AAAA',
      ]),
    );
    expect(called).toBe(false);
  });
});
