import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeCvConsistency, makeCvIssue } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';
import { experienceText, summaryText } from './revision-text';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const open = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/revision' });
  await screen.findByRole('heading', { name: 'Revisión' });
};

describe('RevisionPage', () => {
  it('muestra el resumen y la línea de experiencia', async () => {
    server.use(...adminHandlers);
    await open();
    expect(await screen.findByTestId('revision-summary')).toHaveTextContent(
      '1 error · 2 avisos · 1 sugerencia',
    );
    expect(
      screen.getByText('Experiencia: 10 años declarados; las fechas suman 8 años y 7 meses'),
    ).toBeInTheDocument();
  });

  it('agrupa en Errores, Avisos y Sugerencias en ese orden', async () => {
    server.use(...adminHandlers);
    await open();
    await screen.findByRole('heading', { name: 'Errores' });
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
      .filter((text) => ['Errores', 'Avisos', 'Sugerencias'].includes(text ?? ''));
    expect(headings).toEqual(['Errores', 'Avisos', 'Sugerencias']);
  });

  it('oculta los bloques vacíos', async () => {
    server.use(
      http.get(`${API}/admin/consistency`, () =>
        HttpResponse.json(makeCvConsistency({ issues: [makeCvIssue()] })),
      ),
      ...adminHandlers,
    );
    await open();
    await screen.findByRole('heading', { name: 'Avisos' });
    expect(screen.queryByRole('heading', { name: 'Errores' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sugerencias' })).not.toBeInTheDocument();
  });

  it('agrupa por tipo de entidad dentro de cada bloque', async () => {
    server.use(...adminHandlers);
    await open();
    const warnings = (await screen.findByRole('heading', { name: 'Avisos' })).closest('section')!;
    const groups = within(warnings)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(groups).toEqual(['Perfil', 'Experiencias']);
  });

  it('cada hallazgo tiene su etiqueta, su mensaje y un Abrir con el destino de issue-links', async () => {
    server.use(...adminHandlers);
    await open();
    const errors = (await screen.findByRole('heading', { name: 'Errores' })).closest('section')!;
    expect(within(errors).getByText('Globex')).toBeInTheDocument();
    expect(
      within(errors).getByText('La fecha de fin (2018-05) es anterior a la de inicio (2019-01).'),
    ).toBeInTheDocument();
    expect(within(errors).getByRole('link', { name: 'Abrir Globex' })).toHaveAttribute(
      'href',
      '/admin/experiencias?editar=exp-2',
    );
    expect(screen.getByRole('link', { name: 'Abrir Ada Administradora' })).toHaveAttribute(
      'href',
      '/admin/portada',
    );
    expect(screen.getByRole('link', { name: 'Abrir Scrum Master' })).toHaveAttribute(
      'href',
      '/admin/formacion?editar=cert-1',
    );
  });

  it('un hallazgo de un perfil curado enlaza a su ficha', async () => {
    server.use(
      http.get(`${API}/admin/consistency`, () =>
        HttpResponse.json(
          makeCvConsistency({
            issues: [
              makeCvIssue({
                code: 'curated.no-experiences',
                entityType: 'curatedProfile',
                entityId: 'cp-9',
                entityLabel: 'tech-lead',
                field: null,
                message: 'Con sus criterios actuales no muestra ninguna experiencia.',
                params: {},
              }),
            ],
          }),
        ),
      ),
      ...adminHandlers,
    );
    await open();
    expect(await screen.findByRole('link', { name: 'Abrir tech-lead' })).toHaveAttribute(
      'href',
      '/admin/perfiles/cp-9',
    );
  });

  it('sin hallazgos muestra el estado vacío y ningún bloque', async () => {
    server.use(
      http.get(`${API}/admin/consistency`, () =>
        HttpResponse.json(makeCvConsistency({ issues: [] })),
      ),
      ...adminHandlers,
    );
    await open();
    expect(await screen.findByText('No hay hallazgos: el CV es consistente.')).toBeInTheDocument();
    expect(screen.getByTestId('revision-summary')).toHaveTextContent(
      '0 errores · 0 avisos · 0 sugerencias',
    );
    for (const name of ['Errores', 'Avisos', 'Sugerencias']) {
      expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument();
    }
  });

  it('ante un error de la API muestra el estado de error con reintento', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/consistency`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ statusCode: 500, message: 'Falló' }, { status: 500 })
          : HttpResponse.json(makeCvConsistency());
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await open();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar los datos');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Errores' })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('Volver a revisar vuelve a pedir y la lista refleja el cambio', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/consistency`, () => {
        calls += 1;
        return HttpResponse.json(
          calls === 1 ? makeCvConsistency() : makeCvConsistency({ issues: [] }),
        );
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await open();
    await screen.findByRole('heading', { name: 'Errores' });

    await user.click(screen.getByRole('button', { name: 'Volver a revisar' }));

    expect(await screen.findByText('No hay hallazgos: el CV es consistente.')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('la severidad se lee como texto: cada bloque se nombra por rol y título', async () => {
    server.use(...adminHandlers);
    await open();
    for (const name of ['Errores', 'Avisos', 'Sugerencias']) {
      const heading = await screen.findByRole('heading', { name });
      expect(heading.closest('section')).toHaveAccessibleName(name);
    }
  });

  it('el ítem Revisión del menú queda marcado como activo', async () => {
    server.use(...adminHandlers);
    await open();
    const [nav] = screen.getAllByRole('navigation', { name: 'Secciones' });
    await waitFor(() =>
      expect(within(nav!).getByRole('link', { name: 'Revisión' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });

  it('axe: sin violaciones en la pantalla con los tres bloques', async () => {
    server.use(...adminHandlers);
    await open();
    await screen.findByRole('heading', { name: 'Sugerencias' });
    // jsdom no calcula estilos: el contraste lo verifica `a11y:check` sobre la app real.
    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('textos del resumen', () => {
  it('singular cuando el número es 1', () => {
    expect(summaryText({ error: 1, warning: 2, info: 1 })).toBe(
      '1 error · 2 avisos · 1 sugerencia',
    );
    expect(summaryText({ error: 0, warning: 1, info: 0 })).toBe(
      '0 errores · 1 aviso · 0 sugerencias',
    );
  });

  it('años y meses derivados de los meses fusionados', () => {
    expect(experienceText(11, 143)).toBe(
      'Experiencia: 11 años declarados; las fechas suman 11 años y 11 meses',
    );
    expect(experienceText(1, 13)).toBe(
      'Experiencia: 1 año declarado; las fechas suman 1 año y 1 mes',
    );
  });
});
