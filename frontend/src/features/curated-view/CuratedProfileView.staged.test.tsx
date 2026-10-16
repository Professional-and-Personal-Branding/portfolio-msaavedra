import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLayoutEffect, createElement, type ComponentProps } from 'react';
import { Link } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '@/app/router';
import type * as ProfileLayoutModule from '@/themes/layouts/ProfileLayout';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

/** Cada commit del layout: las secciones que recibió y si el relleno de alto de pantalla estaba. */
interface Commit {
  sections: string[];
  filler: boolean;
}
const commits: Commit[] = [];

// Registra lo que recibe el layout en cada commit y delega en el real.
vi.mock('@/themes/layouts/ProfileLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof ProfileLayoutModule>();
  function ProfileLayout(props: ComponentProps<typeof actual.ProfileLayout>) {
    useLayoutEffect(() => {
      commits.push({
        sections: [...props.sections],
        filler: document.querySelector('main div[aria-hidden="true"].min-h-screen') !== null,
      });
    });
    return createElement(actual.ProfileLayout, props);
  }
  return { ProfileLayout };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  commits.length = 0;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ALL = ['hero', 'stats', 'experience', 'skills', 'projects', 'education', 'contact'];

function serve() {
  server.use(
    http.get(`${API}/curated-profiles/:slug`, ({ params }) =>
      HttpResponse.json(makeCuratedProfile({ slug: String(params.slug), sections: ALL })),
    ),
  );
}

const onlyHero = (commit: Commit) => commit.sections.length === 1 && commit.sections[0] === 'hero';

// D1 de `improve-mobile-performance`: hero primero, el resto en una transición.
describe('CuratedProfileView — render en dos tiempos', () => {
  it('el primer render con datos es #hero + relleno; después todas las secciones, en orden y sin relleno', async () => {
    serve();
    const { container } = renderWithProviders(<AppRouter />, { route: '/demo' });

    await waitFor(() => expect(container.querySelector('#contact')).not.toBeNull());

    const [first, ...rest] = commits;
    expect(first).toEqual({ sections: ['hero'], filler: true });
    const last = commits.at(-1);
    expect(last).toEqual({ sections: ALL, filler: false });
    // Nunca vuelve a «solo hero» y el relleno desaparece al revelarse.
    expect(rest.every((commit) => !onlyHero(commit))).toBe(true);
    const ids = [...container.querySelectorAll('main section[id]')].map((s) => s.id);
    expect(ids).toEqual(ALL);
    expect(container.querySelector('main div[aria-hidden="true"].min-h-screen')).toBeNull();
  });

  it('cambiar el idioma con el perfil revelado no produce ningún render con solo el hero', async () => {
    serve();
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <>
        <Link to="/demo?lang=en">a inglés</Link>
        <AppRouter />
      </>,
      { route: '/demo?lang=es' },
    );
    await waitFor(() => expect(container.querySelector('#contact')).not.toBeNull());
    const before = commits.length;

    await user.click(screen.getByRole('link', { name: 'a inglés' }));
    await screen.findByRole('heading', { name: 'Professional Experience' });

    const after = commits.slice(before);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((commit) => commit.sections.length === ALL.length && !commit.filler)).toBe(
      true,
    );
  });

  it('navegar de un perfil a otro dentro de /:slug no pasa por «solo hero»', async () => {
    serve();
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <>
        <Link to="/tech-lead-dotnet">al otro perfil</Link>
        <AppRouter />
      </>,
      { route: '/dotnet-backend' },
    );
    await waitFor(() => expect(container.querySelector('#contact')).not.toBeNull());
    const before = commits.length;

    await user.click(screen.getByRole('link', { name: 'al otro perfil' }));
    await waitFor(() => expect(commits.length).toBeGreaterThan(before));
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });

    expect(commits.slice(before).some(onlyHero)).toBe(false);
    expect(container.querySelector('#contact')).not.toBeNull();
  });

  it.each([
    [
      'notFound',
      () => HttpResponse.json({ statusCode: 404, message: 'x' }, { status: 404 }),
      'Perfil no encontrado',
    ],
    [
      'needsToken',
      () => HttpResponse.json({ statusCode: 401, message: 'x' }, { status: 401 }),
      'Perfil protegido',
    ],
    ['error', () => HttpResponse.error(), 'No pudimos cargar el perfil'],
  ])('el estado %s no muestra el relleno', async (_name, respond, heading) => {
    server.use(http.get(`${API}/curated-profiles/:slug`, respond));
    const { container } = renderWithProviders(<AppRouter />, { route: '/demo' });

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(container.querySelector('main div[aria-hidden="true"].min-h-screen')).toBeNull();
    expect(commits).toEqual([]);
  });
});
