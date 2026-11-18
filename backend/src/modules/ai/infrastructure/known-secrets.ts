import { AppConfig } from '../../../config/configuration';

/**
 * Secretos exactos de la configuración que jamás pueden salir hacia el proveedor (D13): el
 * guardián los busca en cada payload y `redactSecrets` los quita de los mensajes. Incluye el
 * secreto del JWT, la sal de analítica, el keyring entero y cada una de sus claves, la clave de
 * Anthropic y los tokens de los proveedores de integración.
 */
/** Contraseña de una URL de conexión (`postgresql://usuario:clave@host/db`), ya decodificada; vacío si no hay. */
function passwordOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const password = decodeURIComponent(new URL(url).password);
    return password === '' ? undefined : password;
  } catch {
    return undefined;
  }
}

export function collectKnownSecrets(
  config: AppConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const secrets = new Set<string>();
  const add = (value: string | undefined): void => {
    if (value !== undefined && value.trim() !== '') secrets.add(value);
  };
  add(config.jwt.secret);
  add(config.analyticsSalt);
  add(config.ai.apiKey);
  add(config.integrations.keys);
  for (const entry of (config.integrations.keys ?? '').split(',')) {
    // `k1:<base64>`: se agrega la parte del secreto sola.
    const separator = entry.indexOf(':');
    if (separator > 0) add(entry.slice(separator + 1).trim());
  }
  add(passwordOf(config.databaseUrl));
  add(env.ADMIN_PASSWORD);
  add(env.GITHUB_SYNC_TOKEN);
  add(env.FAKE_PROVIDER_TOKEN);
  return [...secrets];
}
