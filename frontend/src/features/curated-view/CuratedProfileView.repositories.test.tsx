import { waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';
import type * as LazyRepositoriesModule from '@/themes/layouts/lazy-repositories';

// Cuenta las precargas y delega en la real: el chunk de la sección llega de verdad.
const preload = vi.hoisted(() => vi.fn());
vi.mock('@/themes/layouts/lazy-repositories', async (importOriginal) => {
  const actual = await importOriginal<typeof LazyRepositoriesModule>();
  return {
    ...actual,
    preloadRepositories: () => {
      preload();
      return actual.preloadRepositories();
    },
  };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => preload.mockClear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const WITH = ['hero', 'experience', 'projects', 'repositories', 'contact'];
const WITHOUT = ['hero', 'experience', 'projects', 'contact'];

function serve(sections: string[]) {
  server.use(
    http.get(`${API}/curated-profiles/:slug`, ({ params }) =>
      HttpResponse.json(makeCuratedProfile({ slug: String(params.slug), sections })),
    ),
  );
}

// D8 de `add-featured-repositories`: el chunk de la sección se pide solo si el perfil la trae.
describe('CuratedProfileView — sección de repositorios', () => {
  it('con repositories en sections precarga el chunk y termina mostrando las tarjetas', async () => {
    serve(WITH);
    const { container } = renderWithProviders(<AppRouter />, { route: '/demo' });

    await waitFor(() =>
      expect(container.querySelectorAll('section#repositories > ul > li')).toHaveLength(2),
    );
    expect(preload).toHaveBeenCalledTimes(1);
    const ids = [...container.querySelectorAll('main section[id]')].map((s) => s.id);
    expect(ids).toEqual(WITH);
  });

  it('sin repositories en sections no llama a preload ni renderiza la sección', async () => {
    serve(WITHOUT);
    const { container } = renderWithProviders(<AppRouter />, { route: '/demo' });

    await waitFor(() => expect(container.querySelector('#contact')).not.toBeNull());
    expect(preload).not.toHaveBeenCalled();
    expect(container.querySelector('#repositories')).toBeNull();
  });

  it('con un solo repositorio resuelto el backend no trae la sección: no se pide el chunk', async () => {
    server.use(
      http.get(`${API}/curated-profiles/:slug`, ({ params }) => {
        const view = makeCuratedProfile({ slug: String(params.slug), sections: WITHOUT });
        return HttpResponse.json({ ...view, repositories: view.repositories.slice(0, 1) });
      }),
    );
    const { container } = renderWithProviders(<AppRouter />, { route: '/demo' });

    await waitFor(() => expect(container.querySelector('#contact')).not.toBeNull());
    expect(preload).not.toHaveBeenCalled();
    expect(container.querySelector('#repositories')).toBeNull();
  });
});
