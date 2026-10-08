import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminCuratedProfile } from '@/test/fixtures/admin';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const PUBLICADO = makeAdminCuratedProfile();
const DUPLICADO = makeAdminCuratedProfile({
  id: 'cp-2',
  slug: 'acme-backend-2',
  visibility: 'PRIVATE',
  listed: false,
  views: 0,
});

// add-curated-profile-lifecycle: duplicar y distinguir el estado de cada perfil.
describe('ProfilesPage', () => {
  it('distingue un perfil publicado de un duplicado y de un archivado', async () => {
    const archivado = makeAdminCuratedProfile({
      id: 'cp-3',
      slug: 'viejo',
      archivedAt: '2026-10-01T00:00:00.000Z',
    });
    server.use(
      http.get(`${API}/admin/curated-profiles`, () =>
        HttpResponse.json([PUBLICADO, DUPLICADO, archivado]),
      ),
      ...adminHandlers,
    );
    renderWithProviders(<AppRouter />, { route: '/admin/perfiles' });

    const fila = async (slug: string) =>
      (await screen.findByRole('link', { name: `Editar ${slug}` })).closest('li') as HTMLElement;

    const publicado = await fila('acme-backend');
    expect(within(publicado).getByText('Público')).toBeInTheDocument();
    expect(within(publicado).queryByText('No enumerado')).toBeNull();
    expect(within(publicado).queryByText('Archivado')).toBeNull();

    const duplicado = await fila('acme-backend-2');
    expect(within(duplicado).getByText('Privado')).toBeInTheDocument();
    expect(within(duplicado).getByText('No enumerado')).toBeInTheDocument();

    expect(within(await fila('viejo')).getByText('Archivado')).toBeInTheDocument();
  });

  it('Duplicar pide confirmación, crea la copia y abre el constructor sobre ella', async () => {
    let lista = [PUBLICADO];
    const duplicados: string[] = [];
    server.use(
      http.get(`${API}/admin/curated-profiles`, () => HttpResponse.json(lista)),
      http.post(`${API}/admin/curated-profiles/:id/duplicate`, ({ params }) => {
        duplicados.push(String(params.id));
        lista = [PUBLICADO, DUPLICADO];
        return HttpResponse.json(DUPLICADO, { status: 201 });
      }),
      ...adminHandlers,
    );
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin/perfiles' });

    await user.click(await screen.findByRole('button', { name: 'Duplicar acme-backend' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Nace privada y sin enumerar/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(duplicados).toEqual(['cp-1']));
    expect(await screen.findByLabelText('Slug *')).toHaveValue('acme-backend-2');
  });
});
