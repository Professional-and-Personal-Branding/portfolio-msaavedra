import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminCuratedProfile } from '@/test/fixtures/admin';
import { makeJobPosting, makeSuggestion } from '@/test/fixtures/job-postings';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';
import type { JobPosting, JobPostingSuggestion } from '../shared/admin-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

interface Setup {
  list?: JobPosting[];
  posting?: JobPosting;
  suggestion?: JobPostingSuggestion;
  extra?: Parameters<typeof server.use>;
}

/** Abre la pantalla con la API simulada; devuelve lo que el servidor recibió. */
async function openPage(route = '/admin/perfiles/desde-vacante', setup: Setup = {}) {
  const calls = { imports: [] as unknown[], drafts: [] as unknown[], deletes: [] as string[] };
  const posting = setup.posting ?? makeJobPosting();
  server.use(
    ...(setup.extra ?? []),
    http.get(`${API}/admin/job-postings`, () => HttpResponse.json(setup.list ?? [])),
    http.get(`${API}/admin/job-postings/:id/suggestion`, () =>
      HttpResponse.json(setup.suggestion ?? makeSuggestion()),
    ),
    http.get(`${API}/admin/job-postings/:id`, () => HttpResponse.json(posting)),
    http.delete(`${API}/admin/job-postings/:id`, ({ params }) => {
      calls.deletes.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    ...adminHandlers,
  );
  const storage = JSON.stringify([
    Object.entries(localStorage).sort(),
    Object.entries(sessionStorage).sort(),
  ]);
  renderWithProviders(
    <>
      <AppRouter />
      <Probe />
    </>,
    { route },
  );
  await screen.findByRole('heading', { name: 'Crear desde una vacante' });
  return { calls, storage };
}

const importHandler = (
  calls: { imports: unknown[] },
  response: () => Response | Promise<Response>,
) =>
  http.post(`${API}/admin/job-postings`, async ({ request }) => {
    calls.imports.push(await request.json());
    return response();
  });

describe('JobPostingIntakePage — importación', () => {
  it('con la lista vacía dice «Todavía no importaste vacantes»', async () => {
    await openPage();
    expect(await screen.findByText('Todavía no importaste vacantes')).toBeInTheDocument();
  });

  it('analiza una URL, muestra la vacante, la cobertura y deja los sugeridos marcados', async () => {
    const user = userEvent.setup();
    const calls = { imports: [] as unknown[] };
    await openPage('/admin/perfiles/desde-vacante', {
      extra: [importHandler(calls, () => HttpResponse.json(makeJobPosting(), { status: 201 }))],
    });

    await user.type(screen.getByLabelText('URL de la vacante'), 'https://jobs.lever.co/acme/abc');
    await user.click(screen.getByRole('button', { name: 'Analizar vacante' }));

    expect((await screen.findAllByText('Vacante importada')).length).toBeGreaterThan(0);
    expect(calls.imports).toEqual([{ url: 'https://jobs.lever.co/acme/abc' }]);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/admin/perfiles/desde-vacante?vacante=jp-1',
      ),
    );

    expect(
      await screen.findByRole('heading', { name: 'Senior Platform Engineer' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Cubre 2 de 4 requisitos detectados (50 %)' }),
    ).toBeInTheDocument();

    // Con respaldo: casillas marcadas y evidencia; sin respaldo: sin casilla.
    expect(screen.getByRole('checkbox', { name: 'java' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'spring-boot' })).toBeChecked();
    expect(screen.getByText('en 3 ítems')).toBeInTheDocument();
    expect(screen.getByText('en 1 ítem')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'kubernetes' })).toBeNull();
    expect(screen.getByText('kubernetes')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Ver la vacante/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/El texto se borra el /)).toBeInTheDocument();
  });

  it('una vacante ya importada se anuncia como «Vacante actualizada» (200)', async () => {
    const user = userEvent.setup();
    const calls = { imports: [] as unknown[] };
    await openPage('/admin/perfiles/desde-vacante', {
      extra: [importHandler(calls, () => HttpResponse.json(makeJobPosting(), { status: 200 }))],
    });
    await user.type(screen.getByLabelText('URL de la vacante'), 'https://jobs.lever.co/acme/abc');
    await user.click(screen.getByRole('button', { name: 'Analizar vacante' }));
    expect((await screen.findAllByText('Vacante actualizada')).length).toBeGreaterThan(0);
  });

  it('valida en el cliente: URL vacía y http:// no llaman a la API', async () => {
    const user = userEvent.setup();
    const calls = { imports: [] as unknown[] };
    await openPage('/admin/perfiles/desde-vacante', {
      extra: [importHandler(calls, () => HttpResponse.json(makeJobPosting(), { status: 201 }))],
    });
    await user.click(screen.getByRole('button', { name: 'Analizar vacante' }));
    expect(await screen.findByText('Pegá la URL de la vacante')).toBeInTheDocument();

    await user.type(screen.getByLabelText('URL de la vacante'), 'http://x.acme.com/1');
    await user.click(screen.getByRole('button', { name: 'Analizar vacante' }));
    expect(await screen.findByText('Usá una URL que empiece con https://')).toBeInTheDocument();
    expect(calls.imports).toEqual([]);
  });

  it('un 422 de portal cerrado va en role="alert" y «Pegar el texto» pasa a Texto con la URL de referencia', async () => {
    const user = userEvent.setup();
    const calls = { imports: [] as unknown[] };
    const message =
      '«LinkedIn» no permite leer sus vacantes. Copiá el texto de la vacante y pegalo en «Texto».';
    await openPage('/admin/perfiles/desde-vacante', {
      extra: [
        importHandler(calls, () =>
          HttpResponse.json(
            { statusCode: 422, error: 'Unprocessable Entity', message },
            { status: 422 },
          ),
        ),
      ],
    });
    await user.type(
      screen.getByLabelText('URL de la vacante'),
      'https://www.linkedin.com/jobs/view/123',
    );
    await user.click(screen.getByRole('button', { name: 'Analizar vacante' }));

    const alert = await screen.findByText(message);
    expect(alert.closest('[role="alert"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Pegar el texto' }));
    expect(screen.getByRole('radio', { name: 'Texto' })).toBeChecked();
    expect(screen.getByLabelText('URL de referencia')).toHaveValue(
      'https://www.linkedin.com/jobs/view/123',
    );
    expect(screen.queryByText(message)).toBeNull();
  });

  it('un texto pegado manda text y la referencia, y no la URL', async () => {
    const user = userEvent.setup();
    const calls = { imports: [] as unknown[] };
    await openPage('/admin/perfiles/desde-vacante', {
      extra: [importHandler(calls, () => HttpResponse.json(makeJobPosting(), { status: 201 }))],
    });
    await user.click(screen.getByRole('radio', { name: 'Texto' }));
    await user.click(screen.getByLabelText('Texto de la vacante'));
    await user.paste('Líder técnico. '.repeat(5));
    await user.type(screen.getByLabelText('URL de referencia'), 'https://www.linkedin.com/jobs/1');
    await user.click(screen.getByRole('button', { name: 'Analizar vacante' }));

    await screen.findAllByText('Vacante importada');
    expect(calls.imports).toEqual([
      { text: 'Líder técnico. '.repeat(5).trim(), referenceUrl: 'https://www.linkedin.com/jobs/1' },
    ]);
  });

  it('un 429 muestra su mensaje literal', async () => {
    const user = userEvent.setup();
    const calls = { imports: [] as unknown[] };
    await openPage('/admin/perfiles/desde-vacante', {
      extra: [
        importHandler(calls, () =>
          HttpResponse.json(
            { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
            { status: 429 },
          ),
        ),
      ],
    });
    await user.type(screen.getByLabelText('URL de la vacante'), 'https://jobs.lever.co/acme/abc');
    await user.click(screen.getByRole('button', { name: 'Analizar vacante' }));
    expect(
      await screen.findByText('Hiciste muchas importaciones seguidas. Esperá un minuto.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pegar el texto' })).toBeNull();
  });
});

describe('JobPostingIntakePage — borrador', () => {
  it('Crear borrador manda solo los tags marcados y navega al constructor con el toast', async () => {
    const user = userEvent.setup();
    const drafts: unknown[] = [];
    await openPage('/admin/perfiles/desde-vacante?vacante=jp-1', {
      extra: [
        http.post(`${API}/admin/curated-profiles/from-job-posting`, async ({ request }) => {
          drafts.push(await request.json());
          return HttpResponse.json(makeAdminCuratedProfile({ id: 'cp-9', slug: 'borrador' }), {
            status: 201,
          });
        }),
        http.get(`${API}/admin/curated-profiles/:id`, () =>
          HttpResponse.json(makeAdminCuratedProfile({ id: 'cp-9', slug: 'borrador' })),
        ),
      ],
    });
    await screen.findByRole('heading', { name: /Cubre 2 de 4/ });
    await user.click(screen.getByRole('checkbox', { name: 'spring-boot' })); // desmarca
    await user.type(screen.getByLabelText('Slug (opcional)'), 'mi-borrador');
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }));

    expect(
      await screen.findByText('Borrador creado. Es privado hasta que lo publiques.'),
    ).toBeInTheDocument();
    expect(drafts).toEqual([
      {
        jobPostingId: 'jp-1',
        filterTags: ['java'],
        title: 'Senior Platform Engineer',
        slug: 'mi-borrador',
      },
    ]);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/perfiles/cp-9'),
    );
  });

  it('con cero tags elegidos dice «Elegí al menos un tag» y no llama a la API', async () => {
    const user = userEvent.setup();
    const drafts: unknown[] = [];
    await openPage('/admin/perfiles/desde-vacante?vacante=jp-1', {
      extra: [
        http.post(`${API}/admin/curated-profiles/from-job-posting`, async ({ request }) => {
          drafts.push(await request.json());
          return HttpResponse.json(makeAdminCuratedProfile(), { status: 201 });
        }),
      ],
    });
    await screen.findByRole('heading', { name: /Cubre 2 de 4/ });
    await user.click(screen.getByRole('checkbox', { name: 'java' }));
    await user.click(screen.getByRole('checkbox', { name: 'spring-boot' }));
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }));
    expect(await screen.findByText('Elegí al menos un tag')).toBeInTheDocument();
    expect(drafts).toEqual([]);
  });

  it('un 409 de slug ocupado se explica en pantalla sin navegar', async () => {
    const user = userEvent.setup();
    await openPage('/admin/perfiles/desde-vacante?vacante=jp-1', {
      extra: [
        http.post(`${API}/admin/curated-profiles/from-job-posting`, () =>
          HttpResponse.json(
            { statusCode: 409, message: 'Perfil curado: el slug "x" ya existe' },
            { status: 409 },
          ),
        ),
      ],
    });
    await screen.findByRole('heading', { name: /Cubre 2 de 4/ });
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }));
    expect(await screen.findByText('Perfil curado: el slug "x" ya existe')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/perfiles/desde-vacante');
  });

  it('sin requisitos detectados lo dice y no ofrece casillas', async () => {
    await openPage('/admin/perfiles/desde-vacante?vacante=jp-1', {
      suggestion: makeSuggestion({
        coverage: { covered: [], uncovered: [], detectedCount: 0, coveredCount: 0, ratio: null },
        suggestedFilterTags: [],
      }),
    });
    expect(
      await screen.findByRole('heading', {
        name: 'No detectamos requisitos conocidos en esta vacante',
      }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});

describe('JobPostingIntakePage — vacantes importadas', () => {
  const list = [
    makeJobPosting({ id: 'jp-1' }),
    makeJobPosting({ id: 'jp-2', title: 'Data Engineer', company: null, source: 'PASTED' }),
  ];

  it('Abrir pone ?vacante={id} en la URL y recargar con ella abre el análisis', async () => {
    const user = userEvent.setup();
    await openPage('/admin/perfiles/desde-vacante', { list });
    const row = (await screen.findByText('Data Engineer')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Texto pegado')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Abrir Data Engineer' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/perfiles/desde-vacante?vacante=jp-2',
    );
  });

  it('abrir la URL con ?vacante=jp-1 muestra el análisis sin hacer clic', async () => {
    await openPage('/admin/perfiles/desde-vacante?vacante=jp-1', { list });
    expect(
      await screen.findByRole('heading', { name: 'Senior Platform Engineer', level: 2 }),
    ).toBeInTheDocument();
  });

  it('una vacante que ya no existe (404) lo avisa en un alert', async () => {
    await openPage('/admin/perfiles/desde-vacante?vacante=jp-x', {
      extra: [
        http.get(`${API}/admin/job-postings/:id`, () =>
          HttpResponse.json({ statusCode: 404, message: 'no' }, { status: 404 }),
        ),
        http.get(`${API}/admin/job-postings/:id/suggestion`, () =>
          HttpResponse.json({ statusCode: 404, message: 'no' }, { status: 404 }),
        ),
      ],
    });
    expect(await screen.findByText('Esa vacante ya no existe.')).toBeInTheDocument();
  });

  it('Borrar pide confirmación y llama a la API solo al confirmar', async () => {
    const user = userEvent.setup();
    const { calls } = await openPage('/admin/perfiles/desde-vacante', { list });
    await user.click(await screen.findByRole('button', { name: 'Borrar Data Engineer' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(calls.deletes).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText('Vacante borrada')).toBeInTheDocument();
    expect(calls.deletes).toEqual(['jp-2']);
  });

  it('con el texto purgado dice cuándo se borró y no muestra la descripción', async () => {
    await openPage('/admin/perfiles/desde-vacante?vacante=jp-1', {
      posting: makeJobPosting({ description: null, textPurged: true }),
    });
    expect(await screen.findByText(/El texto se borró el /)).toBeInTheDocument();
    expect(screen.queryByText('Descripción de la vacante')).toBeNull();
  });

  it('no escribe en localStorage ni sessionStorage', async () => {
    const user = userEvent.setup();
    const { storage } = await openPage('/admin/perfiles/desde-vacante?vacante=jp-1', { list });
    await screen.findByRole('heading', { name: /Cubre 2 de 4/ });
    await user.click(screen.getByRole('checkbox', { name: 'java' }));
    expect(
      JSON.stringify([Object.entries(localStorage).sort(), Object.entries(sessionStorage).sort()]),
    ).toBe(storage);
  });
});
