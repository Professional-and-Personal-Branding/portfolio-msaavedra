import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { server } from '@/test/msw';
import { adminHandlers, anonymousHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// improve-a11y-and-performance: salto al contenido y un <main> en cada pantalla del panel.
describe('Panel — saltar al contenido y landmarks', () => {
  it('el primer Tab enfoca «Saltar al contenido» y activarlo lleva el foco al <main>', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin' });
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.tab();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveFocus();

    await user.keyboard('{Enter}');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'contenido');
    expect(main).toHaveFocus();
  });

  it('el panel tiene exactamente un <main>', async () => {
    server.use(...adminHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin' });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('al cerrar un diálogo con Escape el foco vuelve al botón que lo abrió', async () => {
    server.use(...adminHandlers);
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin/experiencias' });
    const opener = await screen.findByRole('button', { name: /Nueva experiencia/ });

    await user.click(opener);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('/admin/login envuelve el formulario en un <main>', async () => {
    server.use(...anonymousHandlers);
    renderWithProviders(<AppRouter />, { route: '/admin/login' });
    const main = await screen.findByRole('main');
    expect(main).toContainElement(screen.getByLabelText('Email'));
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
