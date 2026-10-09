import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './providers';
import { AppRouter } from './router';

/**
 * Data router mínimo (D1 de `polish-builder-and-edge`): una ruta comodín que monta
 * el `AppRouter` con sus `<Routes>` declarativas. Hace falta para `useBlocker`.
 */
const router = createBrowserRouter([{ path: '*', element: <AppRouter /> }]);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
