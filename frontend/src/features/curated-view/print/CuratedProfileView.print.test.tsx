import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const PRINT_BUTTON = { name: /imprimir \/ guardar pdf/i };

describe('CuratedProfileView — hoja imprimible', () => {
  it('en success monta la hoja, oculta el envoltorio de pantalla al imprimir y muestra el botón', async () => {
    const { container } = renderWithProviders(<AppRouter />, { route: '/demo' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });

    const sheet = container.querySelector('[data-print-sheet]');
    expect(sheet).not.toBeNull();
    expect(sheet?.classList.contains('print:block')).toBe(true);

    const screenWrapper = container.querySelector('main')?.closest('.print\\:hidden');
    expect(screenWrapper).not.toBeNull();
    expect(screenWrapper?.contains(sheet)).toBe(false);

    const root = container.querySelector('[data-theme]');
    expect(root?.classList.contains('print:min-h-0')).toBe(true);
    expect(root?.classList.contains('print:bg-transparent')).toBe(true);

    expect(screen.getByRole('button', PRINT_BUTTON)).toBeInTheDocument();
  });

  it('el botón también está en la home', async () => {
    renderWithProviders(<AppRouter />, { route: '/' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    expect(screen.getByRole('button', PRINT_BUTTON)).toBeInTheDocument();
  });

  it('el clic llama a window.print y no hace ninguna petición nueva', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const urls: string[] = [];
    server.use(
      http.all(`${API}/*`, ({ request }) => {
        urls.push(`${request.method} ${request.url}`);
        return HttpResponse.json(makeCuratedProfile({ slug: 'demo' }));
      }),
    );
    renderWithProviders(<AppRouter />, { route: '/demo' });
    await screen.findByRole('heading', { level: 1, name: 'Ada Ejemplo' });
    const before = urls.length;
    const title = document.title;

    await userEvent.click(screen.getByRole('button', PRINT_BUTTON));

    expect(print).toHaveBeenCalledTimes(1);
    // Margen para una petición en vuelo del propio montaje: se espera un instante.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(urls.length).toBe(before);
    expect(document.title).toBe(title);
  });

  it.each([
    ['loading', () => new Promise<never>(() => undefined)],
    [
      'notFound',
      () => HttpResponse.json({ statusCode: 404, message: 'x', error: 'x' }, { status: 404 }),
    ],
    [
      'error',
      () => HttpResponse.json({ statusCode: 500, message: 'x', error: 'x' }, { status: 500 }),
    ],
    [
      'needsToken',
      () => HttpResponse.json({ statusCode: 401, message: 'x', error: 'x' }, { status: 401 }),
    ],
  ])('en %s no hay hoja ni botón', async (estado, respuesta) => {
    server.use(http.get(`${API}/curated-profiles/:slug`, respuesta));
    const { container } = renderWithProviders(<AppRouter />, { route: '/protegido' });

    if (estado !== 'loading') {
      await waitFor(() => expect(container.querySelector('main')?.textContent).not.toBe(''));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(container.querySelector('[data-print-sheet]')).toBeNull();
    expect(screen.queryByRole('button', PRINT_BUTTON)).toBeNull();
  });
});
