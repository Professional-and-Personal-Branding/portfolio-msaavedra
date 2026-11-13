import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { API, http, HttpResponse, server } from '@/test/msw';
import { useSaveCredential } from './use-integrations-api';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SECRET = 'secreto-de-prueba-xyz-789';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useSaveCredential(), { wrapper }) };
}

/** B3: el secreto no queda en `variables` ni en la caché de mutaciones al terminar. */
describe('useSaveCredential', () => {
  it('tras guardar, `variables` ya no conserva el secreto y la caché de mutaciones queda vacía', async () => {
    server.use(
      http.put(
        `${API}/admin/integrations/:provider/credential`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { result, client } = setup();
    act(() => result.current.mutate({ provider: 'fake', secret: SECRET }));
    await waitFor(() => expect(result.current.variables).toBeUndefined());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('también si la API falla', async () => {
    server.use(
      http.put(`${API}/admin/integrations/:provider/credential`, () =>
        HttpResponse.json({ statusCode: 422, message: 'x' }, { status: 422 }),
      ),
    );
    const { result, client } = setup();
    act(() => result.current.mutate({ provider: 'fake', secret: SECRET }));
    await waitFor(() => expect(result.current.variables).toBeUndefined());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });
});
