import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '@/app/router';
import { makeAdminCuratedProfile } from '@/test/fixtures/admin';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { adminHandlers } from '@/test/msw-admin';
import { renderWithProviders } from '@/test/render';
import type { ShareLink } from '../shared/admin-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const ORIGIN = window.location.origin;

function makeLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'sl-1',
    code: 'k7m2q9xw4t',
    label: 'Acme — RR. HH.',
    portal: null,
    kind: 'MANUAL',
    createdAt: '2026-10-20T10:00:00.000Z',
    revokedAt: null,
    opens: 0,
    lastOpenedAt: null,
    ...overrides,
  };
}

/**
 * Estado de los enlaces del perfil `cp-1` en el servidor simulado: listar, crear, renombrar,
 * revocar y el enlace de LinkedIn. `calls` registra los métodos para comprobar qué se llamó.
 */
function shareLinksApi(initial: ShareLink[] = []) {
  const links = [...initial];
  const calls: string[] = [];
  const base = `${API}/admin/curated-profiles/:id/share-links`;
  server.use(
    http.get(base, () => {
      calls.push('GET');
      return HttpResponse.json(links);
    }),
    http.post(base, async ({ request }) => {
      calls.push('POST');
      const body = (await request.json()) as { label: string; portal?: string };
      const link = makeLink({
        id: `sl-${links.length + 1}`,
        code: `nuevo${String(links.length + 1).padStart(5, '0')}`,
        label: body.label,
        portal: body.portal ?? null,
      });
      links.unshift(link);
      return HttpResponse.json(link, { status: 201 });
    }),
    http.post(`${base}/linkedin`, () => {
      calls.push('LINKEDIN');
      const link = makeLink({
        id: 'sl-li',
        code: 'li0000abcd',
        label: 'Publicación en LinkedIn',
        portal: 'linkedin',
        kind: 'LINKEDIN_POST',
      });
      return HttpResponse.json(link, { status: 201 });
    }),
    http.patch(`${base}/:linkId`, async ({ params, request }) => {
      calls.push('PATCH');
      const body = (await request.json()) as { label: string };
      const link = links.find((l) => l.id === params.linkId);
      if (!link) return HttpResponse.json({ message: 'no' }, { status: 404 });
      link.label = body.label;
      return HttpResponse.json(link);
    }),
    http.post(`${base}/:linkId/revoke`, ({ params }) => {
      calls.push('REVOKE');
      const link = links.find((l) => l.id === params.linkId);
      if (!link) return HttpResponse.json({ message: 'no' }, { status: 404 });
      link.revokedAt = '2026-10-29T12:00:00.000Z';
      return HttpResponse.json(link);
    }),
  );
  return { links, calls };
}

const profileHandler = (overrides: Parameters<typeof makeAdminCuratedProfile>[0] = {}) =>
  http.get(`${API}/admin/curated-profiles`, () =>
    HttpResponse.json([makeAdminCuratedProfile(overrides)]),
  );

async function openPublication(route = '/admin/perfiles/cp-1') {
  renderWithProviders(<AppRouter />, { route });
  await screen.findByTestId('preview-counts');
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: 'Publicación' }));
  return user;
}

beforeEach(() => {
  // Los de cada test se agregan después y pisan a estos (el último registrado gana).
  server.use(
    ...adminHandlers,
    http.post(`${API}/admin/curated-profiles/preview`, () =>
      HttpResponse.json(makeCuratedProfile()),
    ),
  );
});

describe('Enlaces de seguimiento — pestaña Publicación', () => {
  it('crea un enlace, aparece con 0 aperturas y copia la URL absoluta con ?via=', async () => {
    shareLinksApi();
    const user = await openPublication();

    await user.type(await screen.findByLabelText('Etiqueta'), 'Acme — RR. HH.');
    await user.click(screen.getByRole('button', { name: 'Crear enlace' }));

    const list = await screen.findByRole('list', { name: 'Enlaces del perfil' });
    expect(within(list).getByText('Acme — RR. HH.')).toBeInTheDocument();
    expect(within(list).getByText('0')).toBeInTheDocument();
    expect(within(list).getByText('Sin aperturas todavía')).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: /Copiar el link de Acme/ }));
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(`${ORIGIN}/acme-backend?via=nuevo00001`),
    );
  });

  it('un perfil protegido copia el link con token y via', async () => {
    shareLinksApi([makeLink()]);
    server.use(profileHandler({ visibility: 'PROTECTED', accessToken: 'abc' }));
    const user = await openPublication();

    await user.click(await screen.findByRole('button', { name: /Copiar el link de Acme/ }));

    await waitFor(async () => {
      const copied = await navigator.clipboard.readText();
      expect(copied).toContain('token=abc');
      expect(copied).toContain('via=k7m2q9xw4t');
    });
  });

  it('lista las aperturas y la última; los revocados van al final, atenuados y sin copiar', async () => {
    shareLinksApi([
      makeLink({
        id: 'sl-rev',
        label: 'Viejo',
        revokedAt: '2026-10-25T00:00:00.000Z',
        opens: 5,
        lastOpenedAt: '2026-10-24T10:00:00.000Z',
      }),
      makeLink({ id: 'sl-act', label: 'Vigente', opens: 3, portal: 'linkedin' }),
    ]);
    await openPublication();

    const items = within(
      await screen.findByRole('list', { name: 'Enlaces del perfil' }),
    ).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Vigente');
    expect(items[0]).toHaveTextContent('linkedin');
    expect(items[0]).toHaveTextContent('3 aperturas');
    expect(items[1]).toHaveTextContent('Viejo');
    expect(items[1]).toHaveTextContent('Revocado');
    expect(items[1]).toHaveTextContent('5 aperturas');
    expect(within(items[1] as HTMLElement).queryByRole('button', { name: /Copiar/ })).toBeNull();
    expect(within(items[1] as HTMLElement).queryByRole('button', { name: /Revocar/ })).toBeNull();
  });

  it('revocar pide confirmación que avisa que el link sigue abriendo, y deja el enlace revocado', async () => {
    const api = shareLinksApi([makeLink({ opens: 2 })]);
    const user = await openPublication();

    await user.click(await screen.findByRole('button', { name: /Revocar el enlace Acme/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('sigue abriendo el perfil');
    expect(dialog).toHaveTextContent('no se deshace');
    expect(api.calls).not.toContain('REVOKE');

    await user.click(within(dialog).getByRole('button', { name: 'Revocar' }));

    await waitFor(() => expect(api.calls).toContain('REVOKE'));
    const item = (await screen.findByRole('list', { name: 'Enlaces del perfil' })).querySelector(
      'li',
    ) as HTMLElement;
    await waitFor(() => expect(item).toHaveTextContent('Revocado'));
    expect(within(item).queryByRole('button', { name: /Copiar/ })).toBeNull();
    expect(item).toHaveTextContent('2 aperturas');
  });

  it('cancelar la confirmación no revoca', async () => {
    const api = shareLinksApi([makeLink()]);
    const user = await openPublication();

    await user.click(await screen.findByRole('button', { name: /Revocar el enlace Acme/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }),
    );

    expect(api.calls).not.toContain('REVOKE');
  });

  it('cambia la etiqueta en el lugar', async () => {
    const api = shareLinksApi([makeLink()]);
    const user = await openPublication();

    await user.click(await screen.findByRole('button', { name: /Renombrar el enlace Acme/ }));
    const input = screen.getByLabelText(/Etiqueta del enlace Acme/);
    await user.clear(input);
    await user.type(input, 'Globex — Juan');
    await user.click(screen.getByRole('button', { name: 'Guardar etiqueta' }));

    await waitFor(() => expect(api.calls).toContain('PATCH'));
    expect(await screen.findByText('Globex — Juan')).toBeInTheDocument();
  });

  it('un perfil sin guardar indica que hay que guardar primero y no llama a la API', async () => {
    const api = shareLinksApi();
    renderWithProviders(<AppRouter />, { route: '/admin/perfiles/nuevo' });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Publicación' }));

    expect(
      await screen.findByText('Guardá el perfil primero para crear enlaces de seguimiento.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear enlace' })).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it('avisa que los links no resuelven si el perfil es privado', async () => {
    shareLinksApi();
    server.use(profileHandler({ visibility: 'PRIVATE' }));
    await openPublication();

    expect(
      await screen.findByText(/Los links no resuelven: un perfil privado/),
    ).toBeInTheDocument();
  });

  it('link genérico por portal: copia ?src= sin llamar a la API de creación', async () => {
    const api = shareLinksApi();
    const user = await openPublication();

    await user.selectOptions(await screen.findByLabelText('Link genérico por portal'), 'indeed');
    await user.click(screen.getByRole('button', { name: 'Copiar link por portal' }));

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(`${ORIGIN}/acme-backend?src=indeed`),
    );
    expect(api.calls).not.toContain('POST');
  });
});

describe('Compartir en LinkedIn', () => {
  const fakeTab = () => {
    const tab = { opener: 'panel' as unknown, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    return tab;
  };

  it('un perfil público abre share-offsite con la URL y el via del enlace de LinkedIn', async () => {
    const api = shareLinksApi();
    const tab = fakeTab();
    const user = await openPublication();

    await user.click(await screen.findByRole('button', { name: 'Compartir en LinkedIn' }));

    await waitFor(() => expect(tab.location.href).not.toBe(''));
    const target = new URL(tab.location.href);
    expect(target.origin + target.pathname).toBe('https://www.linkedin.com/sharing/share-offsite/');
    expect(target.searchParams.get('url')).toBe(`${ORIGIN}/acme-backend?via=li0000abcd`);
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
    expect(api.calls).toContain('LINKEDIN');
  });

  it('la pestaña se abre en el mismo clic, antes de pedir el enlace', async () => {
    shareLinksApi();
    const tab = fakeTab();
    const open = vi.mocked(window.open);
    const user = await openPublication();

    await user.click(await screen.findByRole('button', { name: 'Compartir en LinkedIn' }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(tab.location.href).not.toBe(''));
  });

  it('un perfil protegido deshabilita el botón y explica que publicaría el token', async () => {
    shareLinksApi();
    server.use(profileHandler({ visibility: 'PROTECTED', accessToken: 'abc' }));
    const open = vi.spyOn(window, 'open');
    await openPublication();

    const button = await screen.findByRole('button', { name: 'Compartir en LinkedIn' });
    expect(button).toBeDisabled();
    expect(screen.getByText(/expondría|publicarlo en LinkedIn/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('un perfil archivado también lo deshabilita y dice por qué', async () => {
    shareLinksApi();
    server.use(profileHandler({ archivedAt: '2026-10-01T00:00:00.000Z' }));
    await openPublication();

    expect(await screen.findByRole('button', { name: 'Compartir en LinkedIn' })).toBeDisabled();
    expect(screen.getByText('El perfil está archivado: su link responde 404.')).toBeInTheDocument();
  });

  it('un perfil sin guardar lo deshabilita', async () => {
    shareLinksApi();
    renderWithProviders(<AppRouter />, { route: '/admin/perfiles/nuevo' });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Publicación' }));

    expect(await screen.findByRole('button', { name: 'Compartir en LinkedIn' })).toBeDisabled();
  });

  it('si la API falla, cierra la pestaña nueva y muestra el error', async () => {
    shareLinksApi();
    server.use(
      http.post(`${API}/admin/curated-profiles/:id/share-links/linkedin`, () =>
        HttpResponse.json({ statusCode: 409, message: 'Solo PUBLIC' }, { status: 409 }),
      ),
    );
    const tab = fakeTab();
    const user = await openPublication();

    await user.click(await screen.findByRole('button', { name: 'Compartir en LinkedIn' }));

    await waitFor(() => expect(tab.close).toHaveBeenCalledTimes(1));
    expect(tab.location.href).toBe('');
  });
});
