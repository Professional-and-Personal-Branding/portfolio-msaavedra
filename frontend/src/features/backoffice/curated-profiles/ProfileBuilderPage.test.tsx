import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminCuratedProfile } from '@/test/fixtures/admin';
import { makeCuratedProfile, makeExperience } from '@/test/fixtures/curated-profile';
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
    await user.click(screen.getByRole('button', { name: 'Copiar' }));

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

  describe('idioma de la vista previa', () => {
    type Call = { locale: string | null; body: Record<string, unknown> };

    /** Cuenta las peticiones de preview por idioma (`?locale=`). */
    function countByLocale(calls: Call[]) {
      return http.post(`${API}/admin/curated-profiles/preview`, async ({ request }) => {
        calls.push({
          locale: new URL(request.url).searchParams.get('locale'),
          body: (await request.json()) as Record<string, unknown>,
        });
        return HttpResponse.json(makeCuratedProfile());
      });
    }
    const switcher = () => screen.getByRole('tablist', { name: 'Idioma de la vista previa' });

    it('conmutar a EN pide el preview en inglés y el guardado no lleva el idioma', async () => {
      const calls: Call[] = [];
      let saved: Record<string, unknown> | undefined;
      server.use(
        http.patch(`${API}/admin/curated-profiles/:id`, async ({ request }) => {
          saved = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(makeAdminCuratedProfile());
        }),
        countByLocale(calls),
        ...adminHandlers,
      );
      const user = userEvent.setup();

      await openBuilder();
      expect(within(switcher()).getByRole('tab', { name: 'es' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await user.click(within(switcher()).getByRole('tab', { name: 'en' }));
      await waitFor(() => expect(calls.at(-1)?.locale).toBe('en'));

      await user.click(screen.getByRole('button', { name: /Guardar/ }));
      await waitFor(() => expect(saved).toBeDefined());
      expect(JSON.stringify(saved)).not.toMatch(/locale|lang/i);
      // El borrador que viaja al preview tampoco lleva el idioma: va en la query.
      expect(JSON.stringify(calls.at(-1)?.body)).not.toMatch(/locale|lang/i);
    });

    it('conmutar a EN y volver a ES no repite la petición (una por idioma)', async () => {
      const calls: Call[] = [];
      server.use(countByLocale(calls), ...adminHandlers);
      const user = userEvent.setup();

      await openBuilder();
      await waitFor(() => expect(calls).toHaveLength(1));

      await user.click(within(switcher()).getByRole('tab', { name: 'en' }));
      await waitFor(() => expect(calls).toHaveLength(2));
      await user.click(within(switcher()).getByRole('tab', { name: 'es' }));

      // Dar margen a que una petición espuria (de haberla) llegue antes de afirmar.
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(calls.map((call) => call.locale)).toEqual(['es', 'en']);
    });

    it('editar un filtro con el preview en EN recalcula en EN', async () => {
      const calls: Call[] = [];
      server.use(countByLocale(calls), ...adminHandlers);
      const user = userEvent.setup();

      await openBuilder();
      await user.click(within(switcher()).getByRole('tab', { name: 'en' }));
      await waitFor(() => expect(calls.at(-1)?.locale).toBe('en'));
      const before = calls.length;

      await user.click(screen.getByRole('tab', { name: 'Selección' }));
      await user.click(screen.getByRole('button', { name: 'java', pressed: false }));

      await waitFor(() => expect(calls.length).toBe(before + 1), { timeout: 3000 });
      expect(calls.at(-1)?.locale).toBe('en');
      expect(calls.at(-1)?.body).toMatchObject({
        filterTags: expect.arrayContaining(['nodejs', 'java']),
      });
    });
  });
});

// add-bilingual-builder-parity: aviso de faltantes en la pestaña Publicación.
describe('ProfileBuilderPage — aviso de faltantes de traducción', () => {
  const MISSING_EN = ['exp-1', 'exp-2', 'exp-3'].map((id) => ({
    entity: 'experience' as const,
    id,
    field: 'highlights',
  }));

  /** Responde por idioma: `missing` es el informe que devuelve para cada `?locale=`. */
  function previewWith(missing: Partial<Record<'es' | 'en', typeof MISSING_EN>>) {
    return http.post(`${API}/admin/curated-profiles/preview`, ({ request }) => {
      const locale = new URL(request.url).searchParams.get('locale') === 'en' ? 'en' : 'es';
      return HttpResponse.json({
        ...makeCuratedProfile({
          experiences: [
            makeExperience({ id: 'exp-1', company: 'Acme Corp', role: 'Senior Backend' }),
            makeExperience({ id: 'exp-2', company: 'Globex', role: 'Java Developer' }),
          ],
        }),
        missingTranslations: missing[locale] ?? [],
      });
    });
  }

  const openPublication = async (user: ReturnType<typeof userEvent.setup>) => {
    await openBuilder();
    await user.click(screen.getByRole('tab', { name: 'Publicación' }));
  };
  const toEnglish = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(
      within(screen.getByRole('tablist', { name: 'Idioma de la vista previa' })).getByRole('tab', {
        name: 'en',
      }),
    );

  it('perfil con faltantes en EN: conteo, tres entradas y Guardar habilitado', async () => {
    server.use(previewWith({ en: MISSING_EN }), ...adminHandlers);
    const user = userEvent.setup();

    await openPublication(user);
    await toEnglish(user);

    const notice = screen.getByTestId('missing-translations');
    await waitFor(() => expect(notice).toHaveTextContent('Faltan 3 traducciones en EN'));
    expect(within(notice).getAllByRole('listitem')).toHaveLength(3);
    expect(notice).toHaveTextContent('Acme Corp — Senior Backend: Logros');
    // Sin datos del preview para exp-3, cae al id.
    expect(notice).toHaveTextContent('exp-3: Logros');
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
  });

  // localize-language-level (D7): los idiomas del perfil entran en el informe y se nombran.
  const languageMissing = http.post(`${API}/admin/curated-profiles/preview`, () =>
    HttpResponse.json({
      ...makeCuratedProfile(),
      missingTranslations: [{ entity: 'language', id: 'l1', field: 'level' }],
    }),
  );

  it('un idioma sin el nivel en inglés se muestra como Idiomas con su nombre', async () => {
    server.use(
      languageMissing,
      http.get(`${API}/admin/languages`, () =>
        HttpResponse.json([
          {
            id: 'l1',
            name: 'Inglés',
            nameI18n: { es: 'Inglés', en: 'English' },
            level: { es: 'Intermedio' },
            detail: null,
          },
        ]),
      ),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPublication(user);
    await toEnglish(user);

    const notice = screen.getByTestId('missing-translations');
    await waitFor(() => expect(notice).toHaveTextContent('Falta 1 traducción en EN'));
    expect(notice).toHaveTextContent('Idiomas');
    await waitFor(() => expect(notice).toHaveTextContent('Inglés: Nivel'));
  });

  it('si la lista de idiomas no carga, el aviso nombra el idioma por su id', async () => {
    server.use(
      languageMissing,
      http.get(`${API}/admin/languages`, () => HttpResponse.json({}, { status: 500 })),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPublication(user);
    await toEnglish(user);

    const notice = screen.getByTestId('missing-translations');
    await waitFor(() => expect(notice).toHaveTextContent('l1: Nivel'));
  });

  it('perfil completo: lo dice explícitamente', async () => {
    server.use(previewWith({}), ...adminHandlers);
    const user = userEvent.setup();

    await openPublication(user);
    await toEnglish(user);

    await waitFor(() =>
      expect(screen.getByTestId('missing-translations')).toHaveTextContent(
        'Sin faltantes de traducción en EN',
      ),
    );
  });

  it('mientras el preview carga muestra un estado neutro, no "sin faltantes"', async () => {
    server.use(
      http.post(`${API}/admin/curated-profiles/preview`, async ({ request }) => {
        const en = new URL(request.url).searchParams.get('locale') === 'en';
        if (en) await new Promise((resolve) => setTimeout(resolve, 600));
        return HttpResponse.json({ ...makeCuratedProfile(), missingTranslations: [] });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPublication(user);
    await toEnglish(user);

    const notice = screen.getByTestId('missing-translations');
    expect(notice).toHaveTextContent('Comprobando traducciones en EN');
    expect(notice).not.toHaveTextContent('Sin faltantes');
    await waitFor(() => expect(notice).toHaveTextContent('Sin faltantes de traducción en EN'));
  });

  it('el aviso sigue al idioma del preview: de EN a ES pasa a sin faltantes', async () => {
    server.use(previewWith({ en: MISSING_EN }), ...adminHandlers);
    const user = userEvent.setup();

    await openPublication(user);
    await toEnglish(user);
    await waitFor(() =>
      expect(screen.getByTestId('missing-translations')).toHaveTextContent('Faltan 3'),
    );

    await user.click(
      within(screen.getByRole('tablist', { name: 'Idioma de la vista previa' })).getByRole('tab', {
        name: 'es',
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('missing-translations')).toHaveTextContent(
        'Sin faltantes de traducción en ES',
      ),
    );
  });

  it('publicar con faltantes en EN se completa con normalidad', async () => {
    let saves = 0;
    server.use(
      previewWith({ en: MISSING_EN }),
      http.patch(`${API}/admin/curated-profiles/:id`, () => {
        saves += 1;
        return HttpResponse.json(makeAdminCuratedProfile());
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPublication(user);
    await toEnglish(user);
    await waitFor(() =>
      expect(screen.getByTestId('missing-translations')).toHaveTextContent('Faltan 3'),
    );

    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(saves).toBe(1));
    // Puede quedar el aviso de una prueba anterior en pantalla: basta con que haya alguno.
    expect((await screen.findAllByText('Perfil guardado')).length).toBeGreaterThan(0);
  });
});

describe('ProfileBuilderPage — aviso de cambios sin guardar', () => {
  const DIALOG_TITLE = 'Tenés cambios sin guardar';

  const patchOk = () =>
    http.patch(`${API}/admin/curated-profiles/:id`, () =>
      HttpResponse.json(makeAdminCuratedProfile()),
    );

  const editTitle = async (user: ReturnType<typeof userEvent.setup>, text = ' X') =>
    user.type(screen.getByLabelText('Título (es)'), text);

  /** Dispara `beforeunload` y dice si la página lo canceló. */
  const unloadPrevented = () => {
    const event = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    return event.defaultPrevented;
  };

  it('Volver con cambios abre el diálogo y la ruta no cambia', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();
    await openBuilder();

    await editTitle(user);
    await user.click(screen.getByRole('link', { name: /Volver/ }));

    expect(await screen.findByText(DIALOG_TITLE)).toBeInTheDocument();
    expect(screen.getByLabelText('Título (es)')).toBeInTheDocument();
  });

  it('Seguir editando cierra el diálogo y conserva el borrador', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();
    await openBuilder();

    await editTitle(user);
    await user.click(screen.getByRole('link', { name: /Volver/ }));
    await user.click(await screen.findByRole('button', { name: 'Seguir editando' }));

    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument());
    expect(screen.getByLabelText('Título (es)')).toHaveValue('Backend en Acme X');
  });

  it('Salir sin guardar navega al listado sin modificar el perfil', async () => {
    let patches = 0;
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, () => {
        patches += 1;
        return HttpResponse.json(makeAdminCuratedProfile());
      }),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openBuilder();

    await editTitle(user);
    await user.click(screen.getByRole('link', { name: /Volver/ }));
    await user.click(await screen.findByRole('button', { name: 'Salir sin guardar' }));

    expect(await screen.findByRole('heading', { name: 'Perfiles curados' })).toBeInTheDocument();
    expect(patches).toBe(0);
  });

  it('beforeunload se cancela con cambios y no sin ellos', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();
    await openBuilder();

    expect(unloadPrevented()).toBe(false);
    await editTitle(user);
    expect(unloadPrevented()).toBe(true);
  });

  it('deshacer el cambio a mano vuelve a limpio: sin diálogo ni beforeunload', async () => {
    server.use(trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();
    await openBuilder();

    await editTitle(user, 'Z');
    await user.type(screen.getByLabelText('Título (es)'), '{Backspace}');
    expect(unloadPrevented()).toBe(false);

    await user.click(screen.getByRole('link', { name: /Volver/ }));
    expect(await screen.findByRole('heading', { name: 'Perfiles curados' })).toBeInTheDocument();
    expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument();
  });

  it('guardar deja la ficha limpia: navegar a otra sección no pregunta', async () => {
    server.use(patchOk(), trackPreviews([]), ...adminHandlers);
    const user = userEvent.setup();
    await openBuilder();

    await editTitle(user);
    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    expect((await screen.findAllByText('Perfil guardado')).length).toBeGreaterThan(0);
    expect(unloadPrevented()).toBe(false);

    await user.click(screen.getAllByRole('link', { name: /Experiencias/ })[0]!);
    expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument();
  });

  it('un perfil nuevo previsualiza sin slug y sin error', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(trackPreviews(bodies), ...adminHandlers);

    renderWithProviders(<AppRouter />, { route: '/admin/perfiles/nuevo' });
    await screen.findByTestId('preview-counts');

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(bodies[0]).not.toHaveProperty('slug');
    expect(screen.queryByText(/kebab-case/)).not.toBeInTheDocument();
  });

  it('crear un perfil no se bloquea a sí mismo', async () => {
    const creado = makeAdminCuratedProfile({ id: 'cp-9', slug: 'perfil-nuevo' });
    server.use(
      http.post(`${API}/admin/curated-profiles`, () => HttpResponse.json(creado)),
      http.get(`${API}/admin/curated-profiles`, () => HttpResponse.json([creado])),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin/perfiles/nuevo' });

    await user.type(await screen.findByLabelText('Slug *'), 'perfil-nuevo');
    await user.type(screen.getByLabelText('Título (es)'), 'Perfil nuevo');
    await user.click(screen.getByRole('button', { name: /Guardar/ }));

    expect(await screen.findByText('Perfil creado')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Slug *')).toHaveValue('perfil-nuevo'));
    expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument();
    expect(unloadPrevented()).toBe(false);
  });

  it('un guardado fallido (409) sigue sucio', async () => {
    server.use(
      http.patch(`${API}/admin/curated-profiles/:id`, () =>
        HttpResponse.json(
          { statusCode: 409, message: 'El slug ya existe', error: 'Conflict' },
          { status: 409 },
        ),
      ),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openBuilder();

    await user.type(screen.getByLabelText('Slug *'), '-2');
    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(await screen.findByText('Ya existe un perfil con ese slug')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Volver/ }));
    expect(await screen.findByText(DIALOG_TITLE)).toBeInTheDocument();
  });

  it('el idioma del preview y el archivado no ensucian', async () => {
    server.use(
      http.post(`${API}/admin/curated-profiles/:id/archive`, () =>
        HttpResponse.json(makeAdminCuratedProfile({ archivedAt: '2026-10-05T12:00:00.000Z' })),
      ),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openBuilder();

    await user.click(
      within(screen.getByRole('tablist', { name: 'Idioma de la vista previa' })).getByRole('tab', {
        name: 'en',
      }),
    );
    expect(unloadPrevented()).toBe(false);

    await user.click(screen.getByRole('tab', { name: 'Publicación' }));
    const archivado = screen.getByRole('region', { name: 'Archivado' });
    await user.click(within(archivado).getByRole('button', { name: /Archivar/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archivar' }),
    );
    await within(archivado).findByRole('button', { name: /Desarchivar/ });
    expect(unloadPrevented()).toBe(false);

    await user.click(screen.getByRole('link', { name: /Volver/ }));
    expect(await screen.findByRole('heading', { name: 'Perfiles curados' })).toBeInTheDocument();
    expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument();
  });

  it('cerrar sesión con cambios llega al login sin diálogo', async () => {
    let sesionActiva = true;
    server.use(
      http.get(`${API}/auth/me`, () =>
        sesionActiva
          ? HttpResponse.json({ id: 'a1', email: 'admin@example.com', name: 'Admin' })
          : HttpResponse.json(
              { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
              { status: 401 },
            ),
      ),
      http.post(`${API}/auth/logout`, () => {
        sesionActiva = false;
        return new HttpResponse(null, { status: 204 });
      }),
      trackPreviews([]),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openBuilder();

    await editTitle(user);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByLabelText(/Contraseña/)).toBeInTheDocument();
    expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument();
  });
});
