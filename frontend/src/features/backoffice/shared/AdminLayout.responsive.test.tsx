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

    expect(trigger).toHaveClass('xl:hidden');
    expect(nav).toHaveClass('hidden', 'xl:flex');
    // Si la lista crece, se desplaza dentro de la barra y no estira la página.
    expect(nav).toHaveClass('min-w-0', 'overflow-x-auto');
  });

  // add-application-tracking, D11: la barra pasa a ocho ítems. jsdom no mide el desborde (se mide
  // en Chrome, `verification/8.5-barra.txt`); aquí se fija que el ítem está y que, si no entrara,
  // la barra se desplaza dentro de sí misma en vez de estirar el header.
  it('la barra incluye Postulaciones con ícono y sin acortar su texto', async () => {
    const header = await renderHeader();
    const nav = within(header).getByRole('navigation', { name: 'Secciones' });
    const link = within(nav).getByRole('link', { name: 'Postulaciones' });
    expect(link).toHaveAttribute('href', '/admin/postulaciones');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(within(nav).getAllByRole('link')).toHaveLength(8);
    expect(nav).toHaveClass('overflow-x-auto', 'gap-0.5');
    // Padding compacto solo en la barra horizontal; el menú lateral conserva `px-3`.
    expect(link).toHaveClass('px-3', 'xl:px-1.5', 'whitespace-nowrap');
  });

  // 8.5 (D11): el header es más ancho que el contenido para que entren ocho secciones.
  it('el header usa max-w-7xl y el contenido sigue en max-w-6xl', async () => {
    const header = await renderHeader();
    expect(header.firstElementChild).toHaveClass('max-w-7xl');
    expect(screen.getByRole('main')).toHaveClass('max-w-6xl');
  });

  it('las acciones conservan su nombre accesible cuando muestran solo el ícono', async () => {
    const header = await renderHeader();
    const portfolio = within(header).getByRole('link', { name: 'Ver portafolio' });
    const account = within(header).getByRole('link', { name: 'Cuenta' });
    const logout = within(header).getByRole('button', { name: 'Cerrar sesión' });

    for (const action of [portfolio, account, logout]) {
      expect(action).toHaveAttribute('title', action.getAttribute('aria-label'));
      expect(action.querySelector('span')).toHaveClass('hidden', 'sm:inline', 'lg:hidden');
    }
    expect(within(header).getByTestId('admin-name')).toHaveClass('hidden');
    expect(within(header).getByTestId('admin-name')).not.toHaveClass('2xl:inline');
  });
});
