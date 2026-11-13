import { screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AdminShell', () => {
  it('la navegación ofrece las ocho secciones, agrupadas por frecuencia de cambio', async () => {
    server.use(...adminHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin' });
    await screen.findByRole('heading', { name: 'Dashboard' });

    // En escritorio y en el menú móvil se usa la misma lista: basta la primera.
    const [nav] = screen.getAllByRole('navigation', { name: 'Secciones' });
    const links = within(nav!).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Portada',
      'Experiencias',
      'Skills',
      'Formación',
      'Proyectos',
      'Perfiles curados',
      'Postulaciones',
      'Revisión',
    ]);
    // D25 de `add-integrations-foundation`: Integraciones no suma un ítem a la barra.
    expect(within(nav!).queryByRole('link', { name: 'Integraciones' })).toBeNull();
    expect(within(nav!).getByRole('link', { name: 'Revisión' })).toHaveAttribute(
      'href',
      '/admin/revision',
    );
    expect(within(nav!).getByRole('link', { name: 'Formación' })).toHaveAttribute(
      'href',
      '/admin/formacion',
    );
  });
});
