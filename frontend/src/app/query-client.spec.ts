import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/shared/lib/api-client';
import { createQueryClient, SESSION_QUERY_KEY } from './query-client';

/** Ejecuta una consulta que falla y devuelve cuántas veces se llamó a la función. */
async function runFailingQuery(queryKey: readonly unknown[], status: number) {
  const client = createQueryClient();
  const queryFn = vi.fn().mockRejectedValue(new HttpError(status, 'no'));
  await client.fetchQuery({ queryKey, queryFn }).catch(() => undefined);
  // deja correr posibles invalidaciones encadenadas
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { client, queryFn };
}

describe('createQueryClient', () => {
  it('un 401 en la consulta de sesión no la reintenta en bucle', async () => {
    const { queryFn } = await runFailingQuery(SESSION_QUERY_KEY, 401);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('un 401 en otra consulta invalida la sesión', async () => {
    const client = createQueryClient();
    const sessionFn = vi.fn().mockResolvedValue({ id: 'admin-1' });
    await client.fetchQuery({ queryKey: SESSION_QUERY_KEY, queryFn: sessionFn });

    await client
      .fetchQuery({
        queryKey: ['admin', 'experiences'],
        queryFn: () => Promise.reject(new HttpError(401, 'no')),
      })
      .catch(() => undefined);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(client.getQueryState(SESSION_QUERY_KEY)?.isInvalidated).toBe(true);
  });

  it('un 404 no reintenta y no toca la sesión', async () => {
    const { client, queryFn } = await runFailingQuery(['admin', 'curated-profiles'], 404);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(SESSION_QUERY_KEY)).toBeUndefined();
  });
});
