import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';
import type { AdminLanguage, AdminProfile, ProfilePreview } from '../shared/admin-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const PROFILE: AdminProfile = {
  id: 'p1',
  fullName: 'Ada Ejemplo',
  headline: { es: 'Ingeniera de software', en: 'Software engineer' },
  summary: { es: 'Resumen guardado.', en: 'Saved summary.' },
  location: 'Santa Cruz',
  timezone: 'GMT-4',
  email: 'ada@example.com',
  phone: null,
  yearsOfExperience: 12,
  availability: { modality: null, contractType: null, startDate: { es: 'Inmediata' } },
};

const LANGUAGES: AdminLanguage[] = [
  { id: 'l1', name: 'Español', nameI18n: null, level: 'Nativo', detail: null },
];

type Body = Record<string, unknown> & {
  headline: { es: string; en?: string };
  availability: Record<string, { es: string } | null>;
};

/** El backend resuelve el borrador al idioma: acá alcanza con tomar el `es`. */
function resolved(body: Body): ProfilePreview {
  return {
    id: 'p1',
    fullName: String(body.fullName),
    headline: body.headline.es,
    summary: (body.summary as { es: string }).es,
    location: String(body.location),
    timezone: String(body.timezone),
    email: String(body.email),
    phone: null,
    yearsOfExperience: Number(body.yearsOfExperience),
    availability: {
      modality: '',
      contractType: '',
      startDate: body.availability.startDate?.es ?? '',
    },
    languages: [],
  };
}

function handlers(log: { previews: Body[]; puts: Body[] }) {
  return [
    http.get(`${API}/admin/profile`, () => HttpResponse.json(PROFILE)),
    http.post(`${API}/admin/profile/preview`, async ({ request }) => {
      const body = (await request.json()) as Body;
      log.previews.push(body);
      return HttpResponse.json(resolved(body));
    }),
    http.put(`${API}/admin/profile`, async ({ request }) => {
      const body = (await request.json()) as Body;
      log.puts.push(body);
      return HttpResponse.json({ ...PROFILE, ...body });
    }),
    http.get(`${API}/admin/languages`, () => HttpResponse.json(LANGUAGES)),
    ...adminHandlers,
  ];
}

const openPage = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/portada' });
  return screen.findByTestId('hero-preview');
};

describe('PortadaPage', () => {
  it('carga el perfil base y muestra su hero', async () => {
    server.use(...handlers({ previews: [], puts: [] }));
    const preview = await openPage();

    expect(screen.getByLabelText('Nombre completo *')).toHaveValue('Ada Ejemplo');
    expect(await within(preview).findByText('Ingeniera de software')).toBeInTheDocument();
    expect(within(preview).getByText(/Inmediata/)).toBeInTheDocument();
  });

  it('editar el titular cambia la vista previa sin guardar', async () => {
    const log = { previews: [] as Body[], puts: [] as Body[] };
    server.use(...handlers(log));
    const user = userEvent.setup();
    const preview = await openPage();
    await within(preview).findByText('Ingeniera de software');

    const headline = screen.getByLabelText('Titular (es)');
    await user.clear(headline);
    await user.type(headline, 'Tech Lead');

    expect(await within(preview).findByText('Tech Lead', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(log.previews.at(-1)?.headline).toEqual({ es: 'Tech Lead', en: 'Software engineer' });
    expect(log.puts).toHaveLength(0);
  });

  it('guardar manda el perfil completo por PUT', async () => {
    const log = { previews: [] as Body[], puts: [] as Body[] };
    server.use(...handlers(log));
    const user = userEvent.setup();
    await openPage();

    const startDate = screen.getByLabelText('Fecha de inicio (es)');
    await user.clear(startDate);
    await user.type(startDate, 'En dos semanas');
    await user.click(screen.getByRole('button', { name: 'Guardar portada' }));

    await waitFor(() => expect(log.puts).toHaveLength(1));
    expect(log.puts[0]).toMatchObject({
      fullName: 'Ada Ejemplo',
      email: 'ada@example.com',
      phone: null,
      availability: { modality: null, contractType: null, startDate: { es: 'En dos semanas' } },
    });
  });

  it('un email vacío no se envía y muestra el error', async () => {
    const log = { previews: [] as Body[], puts: [] as Body[] };
    server.use(...handlers(log));
    const user = userEvent.setup();
    await openPage();

    await user.clear(screen.getByLabelText('Email *'));
    await user.click(screen.getByRole('button', { name: 'Guardar portada' }));

    expect(await screen.findByText('El email no es válido')).toBeInTheDocument();
    expect(log.puts).toHaveLength(0);
  });

  it('idiomas: agrega uno nuevo y borra con confirmación', async () => {
    let created: Record<string, unknown> | undefined;
    let deleted: string | undefined;
    server.use(
      http.post(`${API}/admin/languages`, async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'l2', ...created }, { status: 201 });
      }),
      http.delete(`${API}/admin/languages/:id`, ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
      ...handlers({ previews: [], puts: [] }),
    );
    const user = userEvent.setup();
    await openPage();
    const section = screen.getByRole('region', { name: 'Idiomas' });
    await within(section).findByText(/Español/);

    await user.click(within(section).getByRole('button', { name: 'Nuevo idioma' }));
    await user.type(screen.getByLabelText('Nombre *'), 'Inglés');
    await user.type(screen.getByLabelText('Nivel *'), 'B2');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(created).toBeDefined());
    expect(created).toEqual({ name: 'Inglés', nameI18n: null, level: 'B2', detail: null });

    await user.click(within(section).getByRole('button', { name: 'Borrar Español' }));
    await user.click(await screen.findByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(deleted).toBe('l1'));
  });
});
