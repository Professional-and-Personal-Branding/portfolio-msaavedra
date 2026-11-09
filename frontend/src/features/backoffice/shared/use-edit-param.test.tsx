import { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { MISSING_ITEM_MESSAGE } from './use-edit-param';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

/** Como `renderWithProviders`, pero devuelve el router para mirar la URL. */
function renderAt(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
  const router = createMemoryRouter([{ path: '*', element: <AppRouter /> }], {
    initialEntries: [route],
  });
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

// change `add-cv-consistency-rules`, D12: `?editar=<id>` abre el diálogo del ítem y sale de la URL.
describe('?editar=<id> en las pantallas de listas', () => {
  const cases: Array<[string, string, string, string]> = [
    ['Experiencias', '/admin/experiencias', 'exp-1', 'Editar Acme Corp'],
    ['Skills (una skill)', '/admin/skills', 'sk-2', 'Editar skill'],
    ['Skills (una categoría)', '/admin/skills', 'cat-1', 'Editar categoría'],
    ['Formación (una formación)', '/admin/formacion', 'edu-1', 'Editar Ingeniería de Sistemas'],
    ['Formación (una certificación)', '/admin/formacion', 'cert-2', 'Editar Arquitecto Cloud'],
    ['Proyectos (un proyecto)', '/admin/proyectos', 'proj-1', 'Editar Portafolio'],
    ['Proyectos (un enlace)', '/admin/proyectos', 'sl-2', 'Editar YouTube'],
  ];

  it.each(cases)(
    '%s: abre el diálogo correcto y saca el parámetro',
    async (_name, path, id, title) => {
      server.use(...adminHandlers);
      const router = renderAt(`${path}?editar=${id}`);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveAccessibleName(expect.stringContaining(title));
      await waitFor(() => expect(router.state.location.search).toBe(''));
      expect(router.state.location.pathname).toBe(path);
    },
  );

  it.each([
    ['Experiencias', '/admin/experiencias', 'Experiencias'],
    ['Skills', '/admin/skills', 'Skills'],
    ['Formación', '/admin/formacion', 'Formación'],
    ['Proyectos', '/admin/proyectos', 'Proyectos'],
  ])('%s: un id inexistente avisa y no abre ningún diálogo', async (_name, path, heading) => {
    server.use(...adminHandlers);
    const error = vi.spyOn(toast, 'error');
    const router = renderAt(`${path}?editar=inexistente`);
    await screen.findByRole('heading', { name: heading, level: 1 });

    await waitFor(() => expect(error).toHaveBeenCalledWith(MISSING_ITEM_MESSAGE));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('el aviso se da una sola vez aunque la pantalla tenga dos listas', async () => {
    server.use(...adminHandlers);
    const error = vi.spyOn(toast, 'error');
    renderAt('/admin/formacion?editar=inexistente');
    await waitFor(() => expect(error).toHaveBeenCalledWith(MISSING_ITEM_MESSAGE));
    // Dejar pasar los renders posteriores a la carga de las dos listas.
    await screen.findByText('Arquitecto Cloud');
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('un id que existe en la otra lista no avisa (la certificación no se reporta como faltante)', async () => {
    server.use(...adminHandlers);
    const error = vi.spyOn(toast, 'error');
    renderAt('/admin/formacion?editar=cert-1');
    await screen.findByRole('dialog');
    await screen.findByText('Arquitecto Cloud');
    expect(error).not.toHaveBeenCalled();
  });

  it('sin el parámetro no abre nada ni avisa', async () => {
    server.use(...adminHandlers);
    const error = vi.spyOn(toast, 'error');
    renderAt('/admin/formacion');
    await screen.findByText('Arquitecto Cloud');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });
});
