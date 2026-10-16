import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// improve-a11y-and-performance: salto al contenido, landmarks y hero sin fundido.
describe('CuratedProfileView — accesibilidad y arranque', () => {
  function serve() {
    server.use(
      http.get(`${API}/curated-profiles/:slug`, () =>
        HttpResponse.json(makeCuratedProfile({ slug: 'demo' })),
      ),
    );
  }

  it('el primer Tab enfoca «Saltar al contenido» y activarlo lleva el foco al <main>', async () => {
    serve();
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/demo' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });

    await user.tab();
    const skip = screen.getByRole('link', { name: 'Saltar al contenido' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#contenido');

    await user.keyboard('{Enter}');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'contenido');
    expect(main).toHaveFocus();
  });

  it('con ?lang=en el enlace dice «Skip to content»', async () => {
    serve();
    renderWithProviders(<AppRouter />, { route: '/demo?lang=en' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
  });

  it('hay exactamente un <main>', async () => {
    serve();
    renderWithProviders(<AppRouter />, { route: '/demo' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('el hero no hace fundido de entrada y el resto de las secciones sí anima', async () => {
    serve();
    const { container } = renderWithProviders(<AppRouter />, { route: '/demo' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });

    const hero = container.querySelector('#hero');
    expect(hero).not.toBeNull();
    expect(hero).not.toHaveAttribute('data-motion', 'on');
    expect(hero).not.toHaveStyle({ opacity: '0' });

    await waitFor(() =>
      expect(container.querySelector('#experience')).toHaveAttribute('data-motion', 'on'),
    );
  });
});
