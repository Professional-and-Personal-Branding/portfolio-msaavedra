import { act, screen, waitFor, within } from '@testing-library/react';
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
  {
    id: 'l1',
    name: 'Español',
    nameI18n: null,
    level: { es: 'Nativo', en: 'Native' },
    detail: null,
  },
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

// El diálogo de idiomas tiene tres campos bilingües (nombre mostrado, nivel y detalle): el
// segundo juego de pestañas es el del nivel.
const levelEnglishTab = () => screen.getAllByRole('tab', { name: 'en' })[1]!;

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

    expect(
      await within(preview).findByText('Tech Lead', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
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
    await user.type(screen.getByLabelText('Nivel (es)'), 'Intermedio');
    await user.click(levelEnglishTab());
    await user.type(screen.getByLabelText('Nivel (en)'), 'Intermediate');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(created).toBeDefined());
    expect(created).toEqual({
      name: 'Inglés',
      nameI18n: null,
      level: { es: 'Intermedio', en: 'Intermediate' },
      detail: null,
    });

    await user.click(within(section).getByRole('button', { name: 'Borrar Español' }));
    await user.click(await screen.findByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(deleted).toBe('l1'));
  });
});

describe('PortadaPage — nivel del idioma en ES y EN (localize-language-level)', () => {
  const NEEDS_LEVEL = 'El nombre y el nivel son obligatorios';

  it('editar el inglés del nivel, guardar y reabrir conserva los dos idiomas', async () => {
    let languages: AdminLanguage[] = [...LANGUAGES];
    let patched: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API}/admin/languages`, () => HttpResponse.json(languages)),
      http.patch(`${API}/admin/languages/:id`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        languages = [{ ...languages[0]!, ...patched } as AdminLanguage];
        return HttpResponse.json(languages[0]);
      }),
      ...handlers({ previews: [], puts: [] }),
    );
    const user = userEvent.setup();
    await openPage();
    const section = screen.getByRole('region', { name: 'Idiomas' });
    // El listado muestra el nivel en español.
    expect(await within(section).findByText(/Nativo/)).toBeInTheDocument();
    expect(within(section).queryByText(/Native$/)).not.toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Editar Español' }));
    await user.click(levelEnglishTab());
    const english = screen.getByLabelText('Nivel (en)');
    expect(english).toHaveValue('Native');
    await user.clear(english);
    await user.type(english, 'Native speaker');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(patched).toBeDefined());
    expect(patched).toMatchObject({ level: { es: 'Nativo', en: 'Native speaker' } });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(within(section).getByRole('button', { name: 'Editar Español' }));
    expect(screen.getByLabelText('Nivel (es)')).toHaveValue('Nativo');
    await user.click(levelEnglishTab());
    expect(screen.getByLabelText('Nivel (en)')).toHaveValue('Native speaker');
  });

  it('sin el español del nivel no llama a la API y avisa', async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/admin/languages`, () => {
        calls += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
      ...handlers({ previews: [], puts: [] }),
    );
    const user = userEvent.setup();
    await openPage();
    const section = screen.getByRole('region', { name: 'Idiomas' });
    await within(section).findByText(/Español/);

    await user.click(within(section).getByRole('button', { name: 'Nuevo idioma' }));
    await user.type(screen.getByLabelText('Nombre *'), 'Inglés');
    await user.click(levelEnglishTab());
    await user.type(screen.getByLabelText('Nivel (en)'), 'Advanced');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(NEEDS_LEVEL)).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('con el nivel solo en español, la petición no lleva la clave en', async () => {
    let created: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API}/admin/languages`, async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'l2', ...created }, { status: 201 });
      }),
      ...handlers({ previews: [], puts: [] }),
    );
    const user = userEvent.setup();
    await openPage();
    const section = screen.getByRole('region', { name: 'Idiomas' });
    await within(section).findByText(/Español/);

    await user.click(within(section).getByRole('button', { name: 'Nuevo idioma' }));
    await user.type(screen.getByLabelText('Nombre *'), 'Inglés');
    await user.type(screen.getByLabelText('Nivel (es)'), 'Intermedio');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(created).toBeDefined());
    expect(created?.level).toEqual({ es: 'Intermedio' });
  });

  it('un nivel legado ("C1") se carga en ES con EN vacío y cerrar sin tocar no avisa', async () => {
    // El backend puede devolver el string de un dato legado (AdminLanguageResponse.level).
    const legacy = [
      { id: 'l9', name: 'Italiano', nameI18n: null, level: 'C1', detail: null },
    ] as unknown as AdminLanguage[];
    server.use(
      http.get(`${API}/admin/languages`, () => HttpResponse.json(legacy)),
      ...handlers({ previews: [], puts: [] }),
    );
    const user = userEvent.setup();
    await openPage();
    const section = screen.getByRole('region', { name: 'Idiomas' });
    expect(await within(section).findByText(/C1/)).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Editar Italiano' }));
    expect(screen.getByLabelText('Nivel (es)')).toHaveValue('C1');
    await user.click(levelEnglishTab());
    expect(screen.getByLabelText('Nivel (en)')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Tenés cambios sin guardar')).not.toBeInTheDocument();
  });
});

describe('PortadaPage — aviso de cambios sin guardar', () => {
  const DIALOG_TITLE = 'Tenés cambios sin guardar';
  const sidebarLink = () => screen.getAllByRole('link', { name: /Experiencias/ })[0]!;

  const unloadPrevented = () => {
    const event = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    return event.defaultPrevented;
  };

  it('ir a otra sección con cambios abre el diálogo y la ruta no cambia', async () => {
    server.use(...handlers({ previews: [], puts: [] }));
    const user = userEvent.setup();
    await openPage();

    await user.type(screen.getByLabelText('Titular (es)'), ' X');
    await user.click(sidebarLink());

    expect(await screen.findByText(DIALOG_TITLE)).toBeInTheDocument();
    expect(screen.getByLabelText('Titular (es)')).toHaveValue('Ingeniera de software X');

    await user.click(screen.getByRole('button', { name: 'Salir sin guardar' }));
    expect(await screen.findByRole('heading', { name: 'Experiencias' })).toBeInTheDocument();
  });

  it('cambiar el idioma de la vista previa no abre el diálogo y conserva el borrador', async () => {
    server.use(...handlers({ previews: [], puts: [] }));
    const user = userEvent.setup();
    await openPage();

    await user.type(screen.getByLabelText('Titular (es)'), ' X');
    await user.click(
      within(screen.getByRole('tablist', { name: 'Idioma de la vista previa' })).getByRole('tab', {
        name: 'en',
      }),
    );

    expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Titular (es)')).toHaveValue('Ingeniera de software X');
    expect(unloadPrevented()).toBe(true);
  });

  it('beforeunload se cancela solo con cambios', async () => {
    server.use(...handlers({ previews: [], puts: [] }));
    const user = userEvent.setup();
    await openPage();

    expect(unloadPrevented()).toBe(false);
    await user.type(screen.getByLabelText('Titular (es)'), ' X');
    expect(unloadPrevented()).toBe(true);
  });

  it('guardar deja la página limpia: navegar a otra sección no pregunta', async () => {
    const log = { previews: [] as Body[], puts: [] as Body[] };
    server.use(
      // El GET refleja lo último guardado, como el backend real.
      http.get(`${API}/admin/profile`, () =>
        HttpResponse.json({ ...PROFILE, ...(log.puts.at(-1) ?? {}) }),
      ),
      ...handlers(log),
    );
    const user = userEvent.setup();
    await openPage();

    await user.type(screen.getByLabelText('Titular (es)'), ' X');
    await user.click(screen.getByRole('button', { name: 'Guardar portada' }));
    await waitFor(() => expect(log.puts).toHaveLength(1));
    await waitFor(() => expect(unloadPrevented()).toBe(false));

    await user.click(sidebarLink());
    expect(await screen.findByRole('heading', { name: 'Experiencias' })).toBeInTheDocument();
    expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument();
  });
});

describe('PortadaPage — aviso al descartar un idioma', () => {
  const PROMPT = 'Tenés cambios sin guardar';

  it('Cancelar con cambios avisa; sin cambios cierra directo; Descartar no guarda', async () => {
    let patched = false;
    server.use(
      http.patch(`${API}/admin/languages/:id`, () => {
        patched = true;
        return HttpResponse.json({});
      }),
      ...handlers({ previews: [], puts: [] }),
    );
    const user = userEvent.setup();
    await openPage();
    const section = screen.getByRole('region', { name: 'Idiomas' });
    await within(section).findByText(/Español/);

    await user.click(within(section).getByRole('button', { name: 'Editar Español' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Editar Español' }));
    await user.type(screen.getByLabelText('Nivel (es)'), 'x');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patched).toBe(false);
  });
});
