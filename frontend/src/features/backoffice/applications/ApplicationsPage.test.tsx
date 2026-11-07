import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminCuratedProfile } from '@/test/fixtures/admin';
import { makeApplication } from '@/test/fixtures/applications';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';
import { localToday } from './application-status';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const ACTIVE = 'DRAFT,APPLIED,INTERVIEWING,OFFER';

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

/** Abre la pantalla y registra el `status` de cada petición de lista. */
async function openPage(
  data = [makeApplication()],
  route = '/admin/postulaciones',
  extra: Parameters<typeof server.use> = [],
) {
  const statuses: (string | null)[] = [];
  server.use(
    http.get(`${API}/admin/applications`, ({ request }) => {
      statuses.push(new URL(request.url).searchParams.get('status'));
      return HttpResponse.json(data);
    }),
    ...extra,
    ...adminHandlers,
  );
  renderWithProviders(
    <>
      <AppRouter />
      <Probe />
    </>,
    { route },
  );
  await screen.findByRole('heading', { name: 'Postulaciones' });
  return { statuses };
}

async function openNewDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Nueva postulación/ }));
  return screen.findByRole('dialog', { name: 'Nueva postulación' });
}

const paste = async (
  user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  text: string,
) => {
  await user.click(field);
  await user.paste(text);
};

describe('ApplicationsPage — lista y filtro (D11)', () => {
  it('por defecto filtra Activas, sin mostrar las cerradas', async () => {
    const { statuses } = await openPage();
    await screen.findByText('Globex');
    expect(statuses[0]).toBe(ACTIVE);
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('activas');
  });

  it('elegir un estado lo pone en la URL y pide solo ese estado; recargar lo conserva', async () => {
    const user = userEvent.setup();
    const { statuses } = await openPage();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'interviewing');

    await waitFor(() => expect(statuses).toContain('INTERVIEWING'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/postulaciones?estado=interviewing',
    );
  });

  it('abrir la URL con ?estado=interviewing deja el filtro elegido y pide ese estado', async () => {
    const { statuses } = await openPage(
      [makeApplication({ status: 'INTERVIEWING' })],
      '/admin/postulaciones?estado=interviewing',
    );
    await screen.findByText('Globex');
    expect(statuses[0]).toBe('INTERVIEWING');
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('interviewing');
  });

  it('Todas no manda el parámetro status; un valor desconocido vuelve a Activas', async () => {
    const todas = await openPage([makeApplication()], '/admin/postulaciones?estado=todas');
    await screen.findByText('Globex');
    expect(todas.statuses[0]).toBeNull();
  });

  it('un ?estado desconocido se trata como Activas', async () => {
    const { statuses } = await openPage([makeApplication()], '/admin/postulaciones?estado=hired');
    await screen.findByText('Globex');
    expect(statuses[0]).toBe(ACTIVE);
  });

  it('muestra «Abierto el 12/11/2026» y «Sin abrir», con las aperturas en el title', async () => {
    const link = {
      id: 'sl-1',
      label: 'Globex — RR. HH.',
      code: 'abcdefghjk',
      revoked: false,
      opens: 2,
      firstOpenedAt: '2026-11-12T15:00:00.000Z',
      lastOpenedAt: '2026-11-14T15:00:00.000Z',
    };
    await openPage([
      makeApplication({
        id: 'a1',
        company: 'Globex',
        shareLink: link,
        profileSlug: 'ejemplo-backend',
      }),
      makeApplication({
        id: 'a2',
        company: 'Initech',
        shareLink: { ...link, id: 'sl-2', opens: 0, firstOpenedAt: null, lastOpenedAt: null },
      }),
      makeApplication({ id: 'a3', company: 'Hooli' }),
    ]);

    const globex = (await screen.findByText('Globex')).closest('tr') as HTMLElement;
    expect(within(globex).getByText('Abierto el 12/11/2026')).toBeInTheDocument();
    expect(within(globex).getByText('Abierto el 12/11/2026').closest('[title]')).toHaveAttribute(
      'title',
      '2 aperturas',
    );
    expect(within(globex).getByText('ejemplo-backend')).toBeInTheDocument();
    const initech = screen.getByText('Initech').closest('tr') as HTMLElement;
    expect(within(initech).getByText('Sin abrir')).toBeInTheDocument();
    const hooli = screen.getByText('Hooli').closest('tr') as HTMLElement;
    expect(within(hooli).queryByText('Sin abrir')).toBeNull();
  });

  it('el estado vacío depende del filtro: Activas dice «No hay postulaciones con este estado»', async () => {
    await openPage([]);
    expect(await screen.findByText('No hay postulaciones con este estado')).toBeInTheDocument();
  });

  it('con Todas y sin datos dice «Todavía no registraste postulaciones»', async () => {
    await openPage([], '/admin/postulaciones?estado=todas');
    expect(await screen.findByText('Todavía no registraste postulaciones')).toBeInTheDocument();
  });

  it('un error de la lista muestra el panel con Reintentar', async () => {
    server.use(
      http.get(`${API}/admin/applications`, () =>
        HttpResponse.json({ statusCode: 500, message: 'Error interno' }, { status: 500 }),
      ),
      ...adminHandlers,
    );
    renderWithProviders(<AppRouter />, { route: '/admin/postulaciones' });
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los datos');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('no escribe en localStorage ni sessionStorage', async () => {
    const snapshot = () =>
      JSON.stringify([Object.entries(localStorage).sort(), Object.entries(sessionStorage).sort()]);
    const before = snapshot();
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'todas');
    await openNewDialog(user);
    expect(snapshot()).toBe(before);
  });
});

describe('ApplicationDialog (D11)', () => {
  it('guardar sin empresa y con una URL sin esquema muestra los mensajes y no llama a la API', async () => {
    let posts = 0;
    const user = userEvent.setup();
    await openPage([], '/admin/postulaciones', [
      http.post(`${API}/admin/applications`, () => {
        posts += 1;
        return HttpResponse.json(makeApplication(), { status: 201 });
      }),
    ]);
    const dialog = await openNewDialog(user);
    await paste(user, within(dialog).getByLabelText('URL de la vacante'), 'globex.example');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByText('Escribí la empresa')).toBeInTheDocument();
    expect(within(dialog).getByText('Escribí el puesto')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Usá una URL que empiece con http:// o https://'),
    ).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it('crea una postulación y avisa «Postulación creada»', async () => {
    let body: Record<string, unknown> | undefined;
    const user = userEvent.setup();
    await openPage([], '/admin/postulaciones', [
      http.post(`${API}/admin/applications`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeApplication({ id: 'nueva' }), { status: 201 });
      }),
    ]);
    const dialog = await openNewDialog(user);
    await paste(user, within(dialog).getByLabelText('Empresa *'), 'Globex');
    await paste(user, within(dialog).getByLabelText('Puesto *'), 'Backend Senior');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Postulación creada')).toBeInTheDocument();
    expect(body).toMatchObject({
      company: 'Globex',
      role: 'Backend Senior',
      status: 'DRAFT',
      jobUrl: null,
      curatedProfileId: null,
      shareLinkId: null,
    });
    expect(body).not.toHaveProperty('appliedAt');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('con Por postular la fecha está oculta y al elegir Postulada se completa con hoy', async () => {
    const user = userEvent.setup();
    await openPage([]);
    const dialog = await openNewDialog(user);
    expect(within(dialog).queryByLabelText('Fecha de postulación')).toBeNull();

    await user.selectOptions(within(dialog).getByLabelText('Estado'), 'APPLIED');

    const date = within(dialog).getByLabelText('Fecha de postulación');
    expect(date).toHaveValue(localToday());
  });

  it('al editar una INTERVIEWING el selector ofrece solo el actual y nextStatuses', async () => {
    const user = userEvent.setup();
    await openPage([makeApplication({ status: 'INTERVIEWING' })]);
    await user.click(await screen.findByRole('button', { name: 'Editar Globex' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar postulación' });

    const options = within(within(dialog).getByLabelText('Estado'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['En entrevistas', 'Oferta', 'Rechazada', 'Retirada']);
  });

  it('el select de enlaces solo lista los MANUAL del perfil elegido', async () => {
    const link = (
      id: string,
      label: string,
      kind: 'MANUAL' | 'LINKEDIN_POST',
      revokedAt = null,
    ) => ({
      id,
      code: `code${id}`,
      label,
      portal: kind === 'MANUAL' ? 'get-on-board' : 'linkedin',
      kind,
      createdAt: '2026-11-01T00:00:00.000Z',
      revokedAt,
      opens: 0,
      lastOpenedAt: null,
    });
    const user = userEvent.setup();
    await openPage([], '/admin/postulaciones', [
      http.get(`${API}/admin/curated-profiles`, () =>
        HttpResponse.json([makeAdminCuratedProfile({ id: 'cp-1', slug: 'ejemplo-backend' })]),
      ),
      http.get(`${API}/admin/curated-profiles/:id/share-links`, () =>
        HttpResponse.json([
          link('1', 'Globex — RR. HH.', 'MANUAL'),
          link('2', 'Publicación en LinkedIn', 'LINKEDIN_POST'),
          link('3', 'Vieja', 'MANUAL', '2026-10-01T00:00:00.000Z' as unknown as null),
        ]),
      ),
    ]);
    const dialog = await openNewDialog(user);
    const linkSelect = within(dialog).getByLabelText('Enlace');
    expect(linkSelect).toBeDisabled();

    await waitFor(() =>
      expect(within(within(dialog).getByLabelText('Perfil')).getAllByRole('option')).toHaveLength(
        2,
      ),
    );
    await user.selectOptions(within(dialog).getByLabelText('Perfil'), 'cp-1');

    await waitFor(() => expect(linkSelect).toBeEnabled());
    await waitFor(() =>
      expect(
        within(linkSelect)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Sin enlace', 'Globex — RR. HH.', 'Vieja (revocado)']),
    );

    // Elegir un enlace con portal completa el portal vacío.
    await user.selectOptions(linkSelect, '1');
    expect(within(dialog).getByLabelText('Portal')).toHaveValue('get-on-board');
  });

  it('un 422 muestra el mensaje literal y el diálogo sigue abierto', async () => {
    const user = userEvent.setup();
    await openPage([makeApplication({ status: 'APPLIED' })], '/admin/postulaciones', [
      http.patch(`${API}/admin/applications/:id`, () =>
        HttpResponse.json(
          {
            statusCode: 422,
            message: 'Transición de estado inválida: APPLIED → OFFER',
            error: 'Unprocessable Entity',
          },
          { status: 422 },
        ),
      ),
    ]);
    await user.click(await screen.findByRole('button', { name: 'Editar Globex' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar postulación' });
    await user.selectOptions(within(dialog).getByLabelText('Estado'), 'OFFER');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(
      await within(dialog).findByText(
        'Ese cambio de estado no está permitido. Elegí uno de la lista.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Editar postulación' })).toBeInTheDocument();
  });

  it('un 409 muestra el mensaje literal y el diálogo sigue abierto', async () => {
    const user = userEvent.setup();
    await openPage([], '/admin/postulaciones', [
      http.post(`${API}/admin/applications`, () =>
        HttpResponse.json(
          {
            statusCode: 409,
            message: 'Enlace de seguimiento: ya está asociado',
            error: 'Conflict',
          },
          { status: 409 },
        ),
      ),
    ]);
    const dialog = await openNewDialog(user);
    await paste(user, within(dialog).getByLabelText('Empresa *'), 'Globex');
    await paste(user, within(dialog).getByLabelText('Puesto *'), 'Dev');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(
      await within(dialog).findByText('Ese enlace ya está asociado a otra postulación.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nueva postulación' })).toBeInTheDocument();
  });

  it('edita y avisa «Postulación actualizada»', async () => {
    let body: Record<string, unknown> | undefined;
    const user = userEvent.setup();
    await openPage([makeApplication({ status: 'APPLIED' })], '/admin/postulaciones', [
      http.patch(`${API}/admin/applications/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeApplication({ status: 'INTERVIEWING' }));
      }),
    ]);
    await user.click(await screen.findByRole('button', { name: 'Editar Globex' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar postulación' });
    await user.selectOptions(within(dialog).getByLabelText('Estado'), 'INTERVIEWING');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Postulación actualizada')).toBeInTheDocument();
    expect(body).toMatchObject({ status: 'INTERVIEWING', company: 'Globex' });
  });

  it('el aviso de no guardar datos de contacto está bajo las notas', async () => {
    const user = userEvent.setup();
    await openPage([]);
    const dialog = await openNewDialog(user);
    expect(
      within(dialog).getByText('No guardes datos de contacto de personas.'),
    ).toBeInTheDocument();
  });
});

describe('ApplicationsPage — borrar y exportar', () => {
  it('borrar pide confirmación y avisa «Postulación borrada»', async () => {
    let deleted: string | undefined;
    const user = userEvent.setup();
    await openPage([makeApplication({ id: 'a1' })], '/admin/postulaciones', [
      http.delete(`${API}/admin/applications/:id`, ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    ]);
    await user.click(await screen.findByRole('button', { name: 'Borrar Globex' }));
    expect(deleted).toBeUndefined();
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('Borrar postulación')).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Borrar' }));

    expect(await screen.findByText('Postulación borrada')).toBeInTheDocument();
    expect(deleted).toBe('a1');
  });

  describe('Exportar CSV', () => {
    let createObjectURL: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createObjectURL = vi.fn(() => 'blob:fake');
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    });

    it('pide el export con el filtro vigente y descarga el archivo', async () => {
      let url: string | undefined;
      const user = userEvent.setup();
      await openPage([makeApplication()], '/admin/postulaciones', [
        http.get(`${API}/admin/applications/export`, ({ request }) => {
          url = request.url;
          return new HttpResponse('﻿"Empresa"', {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="postulaciones-2026-11-20.csv"',
            },
          });
        }),
      ]);
      await screen.findByText('Globex');
      await user.click(screen.getByRole('button', { name: /Exportar CSV/ }));

      await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
      expect(url).toMatch(
        /\/api\/admin\/applications\/export\?status=DRAFT,APPLIED,INTERVIEWING,OFFER$/,
      );
    });

    it('un 500 muestra «No se pudo exportar. Intentá de nuevo.» y no descarga nada', async () => {
      const user = userEvent.setup();
      await openPage([makeApplication()], '/admin/postulaciones', [
        http.get(
          `${API}/admin/applications/export`,
          () => new HttpResponse('boom', { status: 500 }),
        ),
      ]);
      await screen.findByText('Globex');
      await user.click(screen.getByRole('button', { name: /Exportar CSV/ }));

      expect(await screen.findByText('No se pudo exportar. Intentá de nuevo.')).toBeInTheDocument();
      expect(createObjectURL).not.toHaveBeenCalled();
    });
  });
});
