import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { ADMIN_CATEGORIES } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const openPage = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/skills' });
  await screen.findByRole('region', { name: 'Lenguajes' });
};

describe('SkillsPage', () => {
  it('lista las categorías con sus skills', async () => {
    server.use(...adminHandlers);
    await openPage();

    const languages = screen.getByRole('region', { name: 'Lenguajes' });
    expect(within(languages).getByText('TypeScript')).toBeInTheDocument();
    expect(within(languages).getByText('Java')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Metodologías' })).toBeInTheDocument();
    for (const category of ADMIN_CATEGORIES) {
      expect(screen.getByRole('region', { name: category.name.es })).toBeInTheDocument();
    }
  });

  it('crea una skill dentro de su categoría', async () => {
    let body: Record<string, unknown> | undefined;
    let categoryId: string | undefined;
    server.use(
      http.post(`${API}/admin/skill-categories/:categoryId/skills`, async ({ request, params }) => {
        categoryId = String(params.categoryId);
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'sk-nueva', categoryId: 'cat-1', name: 'Go', tags: ['go'], order: 2 },
          { status: 201 },
        );
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    const languages = screen.getByRole('region', { name: 'Lenguajes' });
    await user.click(within(languages).getByRole('button', { name: /Skill/ }));

    await user.type(screen.getByLabelText('Nombre *'), 'Go');
    await user.type(screen.getByLabelText('Tags'), 'go');
    await user.click(screen.getByRole('button', { name: 'Agregar Tags' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(categoryId).toBe('cat-1');
    expect(body).toMatchObject({ name: 'Go', tags: ['go'] });
    expect(await screen.findByText('Skill creada')).toBeInTheDocument();
  });

  it('editar una skill envía solo el PATCH de esa skill', async () => {
    let body: Record<string, unknown> | undefined;
    let id: string | undefined;
    server.use(
      http.patch(`${API}/admin/skills/:id`, async ({ request, params }) => {
        id = String(params.id);
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'sk-2',
          categoryId: 'cat-1',
          name: 'Java',
          tags: ['java', 'jvm'],
          order: 1,
        });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Java' }));

    await user.type(screen.getByLabelText('Tags'), 'jvm');
    await user.click(screen.getByRole('button', { name: 'Agregar Tags' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(id).toBe('sk-2');
    expect(body?.tags).toEqual(['java', 'jvm']);
  });

  it('borrar una categoría advierte que arrastra sus skills', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete(`${API}/admin/skill-categories/:id`, ({ params }) => {
        deleted.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();

    await openPage();
    await user.click(screen.getByRole('button', { name: 'Borrar categoría Lenguajes' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('también sus 2 skills');

    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(deleted).toEqual(['cat-1']));
  });
});

// polish-views-updated-at-and-builder, P2: la cantidad de skills concuerda en número.
describe('SkillsPage — contador de skills', () => {
  it('una categoría con una sola skill usa el singular, también al borrar', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();

    await openPage();
    const metodologias = screen.getByRole('region', { name: 'Metodologías' });
    expect(within(metodologias).getByText('1 skill')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Lenguajes' })).getByText('2 skills'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Borrar categoría Metodologías' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('también su 1 skill.');
  });
});

describe('SkillsPage — aviso al descartar', () => {
  const PROMPT = 'Tenés cambios sin guardar';

  it('skill: la X con cambios avisa; Descartar cierra sin petición', async () => {
    let patched = false;
    server.use(
      http.patch(`${API}/admin/skills/:id`, () => {
        patched = true;
        return HttpResponse.json({});
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Editar Java' }));

    await user.type(screen.getByLabelText('Nombre *'), '21');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /close|cerrar/i }),
    );
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Java21');

    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patched).toBe(false);
  });

  it('categoría: un alta sin tocar nada cierra directo y con texto avisa', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: /Nueva categoría/ }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nueva categoría/ }));
    await user.type(screen.getByLabelText('Nombre (es)'), 'Cloud');
    await user.keyboard('{Escape}');
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });
});
