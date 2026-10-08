import { screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * jsdom no calcula layout, así que el desborde horizontal se verifica en el
 * navegador; aquí se fija el contrato de clases que lo evita.
 */
describe('AdminLayout responsive', () => {
  async function renderHeader() {
    server.use(...adminHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin' });
    await screen.findByRole('heading', { name: 'Dashboard' });
    // La página también tiene su propio <header>: se toma el del panel.
    return screen.getByRole('button', { name: 'Abrir menú' }).closest('header')!;
  }

  it('la barra de secciones y el botón del menú se alternan en el mismo breakpoint', async () => {
    const header = await renderHeader();
    const trigger = within(header).getByRole('button', { name: 'Abrir menú' });
    const nav = within(header).getByRole('navigation', { name: 'Secciones' });

    expect(trigger).toHaveClass('lg:hidden');
    expect(nav).toHaveClass('hidden', 'lg:flex');
    // Si la lista crece, se desplaza dentro de la barra y no estira la página.
    expect(nav).toHaveClass('min-w-0', 'overflow-x-auto');
  });

  it('las acciones conservan su nombre accesible cuando muestran solo el ícono', async () => {
    const header = await renderHeader();
    const portfolio = within(header).getByRole('link', { name: 'Ver portafolio' });
    const logout = within(header).getByRole('button', { name: 'Cerrar sesión' });

    for (const action of [portfolio, logout]) {
      expect(action).toHaveAttribute('title', action.getAttribute('aria-label'));
      expect(action.querySelector('span')).toHaveClass(
        'hidden',
        'sm:inline',
        'lg:hidden',
        'xl:inline',
      );
    }
    expect(within(header).getByTestId('admin-name')).toHaveClass('hidden', 'xl:inline');
  });
});
