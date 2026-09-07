import { createHmac } from 'node:crypto';

/**
 * Hash de IP para analítica (spec `profile-view-analytics`): HMAC-SHA256 con sal.
 * Nunca se persiste la IP en claro. Devuelve undefined si no hay IP.
 */
export function hashIp(ip: string | null | undefined, salt: string): string | undefined {
  if (!ip) return undefined;
  return createHmac('sha256', salt).update(ip).digest('hex');
}
