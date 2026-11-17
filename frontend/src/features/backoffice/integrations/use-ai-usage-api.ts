import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/lib/api-client';
import type { AiRun, AiUsage } from '../shared/admin-types';
import { adminKeys, invalidate } from '../shared/use-admin-api';

/** Gasto de IA del mes (change `add-ai-foundation`): solo lectura, responde también con la IA apagada. */
export function useAiUsage() {
  return useQuery({
    queryKey: adminKeys.aiUsage,
    queryFn: async (): Promise<AiUsage> => unwrap(await api.GET('/api/admin/ai/usage')),
  });
}

/** «Probar conexión»: corre la tarea de humo. Refresca el gasto y la tabla al terminar (también si falla). */
export function useAiSmoke() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<AiRun> => unwrap(await api.POST('/api/admin/ai/smoke')),
    onSettled: () => invalidate(client, adminKeys.aiUsage),
  });
}
