import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

/** Página mínima: `dirty` se alterna con un botón; "Guardar" marca limpio y navega en el mismo tic. */
function Page() {
  const [dirty, setDirty] = useState(false);
  const navigate = useNavigate();
  const guard = useUnsavedChangesGuard(dirty);
  return (
    <>
      <button onClick={() => setDirty(true)}>Ensuciar</button>
      <button
        onClick={() => {
          guard.markSaved();
          setDirty(false);
          void navigate('/otra');
        }}
      >
        Guardar y salir
      </button>
      <Link to="/otra">Ir a otra</Link>
      <Link to="/editor?lang=en">Misma ruta</Link>
      <Link to="/admin/login">Login</Link>
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}

function setup() {
  const router = createMemoryRouter(
    [
      { path: '/editor', element: <Page /> },
      { path: '*', element: <p>destino</p> },
    ],
    { initialEntries: ['/editor'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const beforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe('useUnsavedChangesGuard', () => {
  it('bloquea al cambiar el pathname con cambios y ofrece las dos salidas', async () => {
    const router = setup();
    const user = userEvent.setup();
    await user.click(screen.getByText('Ensuciar'));
    await user.click(screen.getByText('Ir a otra'));

    expect(await screen.findByText('Tenés cambios sin guardar')).toBeInTheDocument();
    expect(
      screen.getByText('Si salís ahora, se descartan los cambios de esta página.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/editor');

    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.queryByText('Tenés cambios sin guardar')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/editor');

    await user.click(screen.getByText('Ir a otra'));
    await user.click(await screen.findByRole('button', { name: 'Salir sin guardar' }));
    expect(router.state.location.pathname).toBe('/otra');
  });

  it('sin cambios navega sin diálogo', async () => {
    const router = setup();
    await userEvent.setup().click(screen.getByText('Ir a otra'));
    expect(router.state.location.pathname).toBe('/otra');
  });

  it('no bloquea si solo cambia la query', async () => {
    const router = setup();
    const user = userEvent.setup();
    await user.click(screen.getByText('Ensuciar'));
    await user.click(screen.getByText('Misma ruta'));
    expect(router.state.location.search).toBe('?lang=en');
    expect(screen.queryByText('Tenés cambios sin guardar')).not.toBeInTheDocument();
  });

  it('no bloquea la navegación hacia /admin/login', async () => {
    const router = setup();
    const user = userEvent.setup();
    await user.click(screen.getByText('Ensuciar'));
    await user.click(screen.getByText('Login'));
    expect(router.state.location.pathname).toBe('/admin/login');
  });

  it('beforeunload se cancela solo con cambios', async () => {
    setup();
    expect(beforeUnload().defaultPrevented).toBe(false);
    fireEvent.click(screen.getByText('Ensuciar'));
    expect(beforeUnload().defaultPrevented).toBe(true);
  });

  it('markSaved permite navegar en el mismo tic', async () => {
    const router = setup();
    const user = userEvent.setup();
    await user.click(screen.getByText('Ensuciar'));
    await user.click(screen.getByText('Guardar y salir'));
    expect(router.state.location.pathname).toBe('/otra');
    expect(screen.queryByText('Tenés cambios sin guardar')).not.toBeInTheDocument();
  });
});
