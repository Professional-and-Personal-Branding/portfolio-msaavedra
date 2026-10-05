import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminCuratedProfile } from '@/test/fixtures/admin';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Registra los cuerpos de cada preview y responde con datos de prueba. */
function trackPreviews(bodies: Record<string, unknown>[]) {
  return http.post(`${API}/admin/curated-profiles/preview`, async ({ request }) => {
    bodies.push((await request.json()) as Record<string, unknown>);
    return HttpResponse.json(makeCuratedProfile());
  });
}

const openBuilder = async (route = '/admin/perfiles/cp-1') => {
  renderWithProviders(<AppRouter />, { route });
  await screen.findByTestId('preview-counts');
};

describe('ProfileBuilderPage', () => {
  it('carga el perfil guardado y previsualiza con sus criterios', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(trackPreviews(bodies), ...adminHandlers);

    await openBuilder();

    expect(screen.getByLabelText('Slug *')).toHaveValue('acme-backend');
    expect(screen.getByLabelText('Título (es)')).toHaveValue('Backend en Acme');
    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(bodies[0]).toMatchObject({ slug: 'acme-backend', filterTags: ['nodejs'] });
    expect(screen.getByTestId('preview-counts')).toHaveTextContent('2 experiencias');
  });

  it('cambiar tags vuelve a previsualizar, y varios cambios seguidos hacen una sola petición', async () => {
    const bodies: Record<string, unknown>[] = [];
    let saves = 0;
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, () => {
        saves += 1;
        return HttpResponse.json(makeAdminCuratedProfile());
      }),
      trackPreviews(bodies),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openBuilder();
    await waitFor(() => expect(bodies).toHaveLength(1));

    await user.click(screen.getByRole('tab', { name: 'Selección' }));
    await user.click(screen.getByRole('button', { name: 'java', pressed: false }));
    await user.click(screen.getByRole('button', { name: 'leadership', pressed: false }));
    await user.click(screen.getByRole('button', { name: 'legacy', pressed: false }));

    await waitFor(() => expect(bodies).toHaveLength(2), { timeout: 3000 });
    expect(bodies[1]).toMatchObject({
      filterTags: expect.arrayContaining(['nodejs', 'java', 'leadership', 'legacy']),
    });

    // Previsualizar no guarda nada.
    expect(saves).toBe(0);
  });

  it('varios tags alternados en la misma tanda no se pisan entre sí', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(trackPreviews(bodies), ...adminHandlers);
    const user = userEvent.setup();

    await openBuilder();
    await waitFor(() => expect(bodies).toHaveLength(1));
    await user.click(screen.getByRole('tab', { name: 'Selección' }));

    // Tres clics sincrónicos: React los agrupa en un solo renderizado.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'java', pressed: false }));
      fireEvent.click(screen.getByRole('button', { name: 'legacy', pressed: false }));
      fireEvent.click(screen.getByRole('button', { name: 'leadership', pressed: false }));
    });

    await waitFor(() => expect(bodies).toHaveLength(2), { timeout: 3000 });
    expect(bodies[1]?.filterTags).toEqual(
      expect.arrayContaining(['nodejs', 'java', 'legacy', 'leadership']),
    );
  });

  it('excluir una experiencia la manda en excludeIds', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(trackPreviews(bodies), ...adminHandlers);
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Selección' }));
    await user.click(screen.getByRole('button', { name: 'Excluir Globex' }));

    await waitFor(() => expect(bodies.at(-1)).toMatchObject({ excludeIds: ['exp-2'] }), {
      timeout: 3000,
    });
  });

  it('guarda con PATCH y avisa; un slug duplicado se muestra junto al campo', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        if (body.slug === 'repetido') {
          return HttpResponse.json(
            { statusCode: 409, message: 'El slug ya existe', error: 'Conflict' },
            { status: 409 },
          );
        }
        return HttpResponse.json(makeAdminCuratedProfile());
      }),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openBuilder();

    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(body).toBeDefined());
    expect(await screen.findByText('Perfil guardado')).toBeInTheDocument();

    const slug = screen.getByLabelText('Slug *');
    await user.clear(slug);
    await user.type(slug, 'repetido');
    await user.click(screen.getByRole('button', { name: /Guardar/ }));

    expect(await screen.findByText('Ya existe un perfil con ese slug')).toBeInTheDocument();
    expect(slug).toHaveValue('repetido');
  });

  it('un perfil protegido exige token antes de guardar y lo agrega al link', async () => {
    let called = false;
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, () => {
        called = true;
        return HttpResponse.json(makeAdminCuratedProfile());
      }),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Publicación' }));
    await user.click(screen.getByRole('combobox', { name: 'Visibilidad' }));
    await user.click(await screen.findByRole('option', { name: 'Protegido con token' }));

    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(
      await screen.findByText('Un perfil protegido necesita un token de acceso'),
    ).toBeInTheDocument();
    expect(called).toBe(false);

    await user.type(screen.getByLabelText('Token de acceso *'), 'secreto-123');
    expect(screen.getByText(/\?token=secreto-123/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(called).toBe(true));
  });

  it('copiar el link deja la URL pública en el portapapeles', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    // `userEvent.setup()` instala su propio portapapeles de pruebas.
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Publicación' }));
    await user.click(screen.getByRole('button', { name: /Copiar/ }));

    expect(await screen.findByText('Link copiado')).toBeInTheDocument();
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toContain('/acme-backend'),
    );
  });

  // unify-section-catalog: el bloque ofrece el catálogo completo del contrato.
  it('el bloque Secciones ofrece las nueve secciones del catálogo', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));

    const sections = screen.getByRole('region', { name: 'Secciones' });
    expect(within(sections).getAllByRole('listitem')).toHaveLength(9);
    for (const id of ['projects', 'presence']) {
      expect(within(sections).getByRole('switch', { name: `Mostrar ${id}` })).toBeInTheDocument();
    }
  });

  it('reordenar y ocultar secciones se refleja en el preview', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(trackPreviews(bodies), ...adminHandlers);
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));

    const sections = screen.getByRole('region', { name: 'Secciones' });
    await user.click(within(sections).getByRole('button', { name: 'Subir skills' }));
    await user.click(within(sections).getByRole('switch', { name: 'Mostrar stats' }));

    await waitFor(
      () => {
        const last = bodies.at(-1);
        expect(last?.sectionsHidden).toEqual(['stats']);
        expect((last?.sectionsOrder as string[]).indexOf('skills')).toBeLessThan(
          (last?.sectionsOrder as string[]).indexOf('experience'),
        );
      },
      { timeout: 3000 },
    );
  });
});

// add-curated-profile-lifecycle: los tres ejes en la pestaña Publicación.
describe('ProfileBuilderPage — ciclo de vida', () => {
  const openPublicacion = async (user: ReturnType<typeof userEvent.setup>) => {
    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Publicación' }));
  };

  it('visibilidad, enumeración y archivado son controles distintos, cada uno explicado', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();
    await openPublicacion(user);

    expect(screen.getByText(/quién puede abrir/)).toBeInTheDocument();
    const enumeracion = screen.getByRole('region', { name: 'Enumeración' });
    expect(within(enumeracion).getByText(/si se enumera/)).toBeInTheDocument();
    expect(within(enumeracion).getByRole('switch')).toBeChecked();
    const archivado = screen.getByRole('region', { name: 'Archivado' });
    expect(within(archivado).getByText(/si sigue vivo/)).toBeInTheDocument();
  });

  it('desactivar la enumeración viaja como listed: false al guardar', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminCuratedProfile({ listed: false }));
      }),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openPublicacion(user);

    await user.click(
      within(screen.getByRole('region', { name: 'Enumeración' })).getByRole('switch'),
    );
    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(body?.listed).toBe(false));
  });

  it('archivar pide confirmación, se refleja sin recargar y el link advierte que no resuelve', async () => {
    const archivados: string[] = [];
    server.use(
      http.post(`${API}/admin/curated-profiles/:id/archive`, ({ params }) => {
        archivados.push(String(params.id));
        return HttpResponse.json(
          makeAdminCuratedProfile({ archivedAt: '2026-10-05T12:00:00.000Z' }),
        );
      }),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openPublicacion(user);

    expect(screen.queryByText(/Este link no resuelve/)).toBeNull();
    const archivado = screen.getByRole('region', { name: 'Archivado' });
    await user.click(within(archivado).getByRole('button', { name: /Archivar/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/deja de funcionar/)).toBeInTheDocument();
    expect(within(dialog).getByText(/visitas se conservan/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Archivar' }));

    await waitFor(() => expect(archivados).toEqual(['cp-1']));
    expect(
      await within(archivado).findByRole('button', { name: /Desarchivar/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Este link no resuelve: el perfil está archivado/)).toBeInTheDocument();
  });

  it('un perfil privado también advierte que su link no resuelve', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();
    await openPublicacion(user);

    await user.click(screen.getByRole('combobox', { name: 'Visibilidad' }));
    await user.click(await screen.findByRole('option', { name: 'Privado' }));
    expect(await screen.findByText(/Este link no resuelve: un perfil privado/)).toBeInTheDocument();
  });
});

describe('ThemeCustomizerPanel', () => {
  it('cambiar un color no genera peticiones y guarda solo la diferencia', async () => {
    const previews: Record<string, unknown>[] = [];
    let saved: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminCuratedProfile());
      }),
      trackPreviews(previews),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openBuilder();
    await waitFor(() => expect(previews).toHaveLength(1));
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));

    const hex = screen.getByLabelText('Acento en hexadecimal');
    await user.clear(hex);
    await user.type(hex, '#ff5500');

    expect(hex).toHaveValue('#ff5500');
    // El preview se re-renderiza en el cliente: ninguna petición nueva.
    expect(previews).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(saved).toBeDefined());
    expect(saved?.themeOverrides).toEqual({ colors: { accent: '#ff5500' } });
  });

  it('un hexadecimal inválido se marca y no rompe el preview', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));

    const hex = screen.getByLabelText('Fondo en hexadecimal');
    await user.clear(hex);
    await user.type(hex, 'no-es-color');

    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('restablecer deja el perfil sin overrides', async () => {
    let saved: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAdminCuratedProfile());
      }),
      trackPreviews([]),
      http.get(`${API}/admin/curated-profiles`, () =>
        HttpResponse.json([
          makeAdminCuratedProfile({ themeOverrides: { colors: { accent: '#ff0000' } } }),
        ]),
      ),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));

    const reset = screen.getByRole('button', { name: /Restablecer/ });
    expect(reset).toBeEnabled();
    await user.click(reset);
    expect(reset).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(saved).toBeDefined());
    expect(saved?.themeOverrides).toBeNull();
  });

  it('cambiar el tema base con ajustes pide confirmación', async () => {
    server.use(
      trackPreviews([]),
      http.get(`${API}/admin/curated-profiles`, () =>
        HttpResponse.json([
          makeAdminCuratedProfile({ themeOverrides: { colors: { accent: '#ff0000' } } }),
        ]),
      ),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));

    await user.click(screen.getByRole('combobox', { name: 'Tema base' }));
    await user.click(await screen.findByRole('option', { name: 'Elegant' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('se perderán');
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar tema' }));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Tema base' })).toHaveTextContent('Elegant'),
    );
    expect(screen.getByRole('button', { name: /Restablecer/ })).toBeDisabled();
  });
});
