import { parseEnabledProviders } from '../modules/integrations/domain/provider-catalog';
import { EnvironmentVariables, expiresInToSeconds, NodeEnv, validateEnv } from './env.validation';

export interface JwtConfig {
  secret: string;
  /** Tal como viene en el entorno (`1d`, `12h`, `3600`). */
  expiresIn: string;
  expiresInSeconds: number;
}

/** Límites de peticiones (spec `api-rate-limiting`). */
export interface ThrottleConfig {
  /** Ventana en segundos. */
  ttl: number;
  /** Peticiones por ventana e IP. */
  limit: number;
  /** Intentos de login por ventana e IP. */
  loginLimit: number;
}

/** Integraciones con terceros (change `add-integrations-foundation`). Todo apagado por defecto. */
export interface IntegrationsConfig {
  /** Ids de `INTEGRATIONS_ENABLED`, ya validados contra el catálogo. */
  enabledProviders: string[];
  /** `true` solo si este proceso debe registrar los timers (D2). */
  schedulerEnabled: boolean;
  syncCron: string;
  tickSeconds: number;
  jobTimeoutMs: number;
  runMaxMs: number;
  /** Keyring crudo (`k1:<base64>,…`): lo parsea `Keyring`; nunca se loguea. */
  keys: string | undefined;
  activeKeyId: string | undefined;
}

export interface AppConfig {
  databaseUrl: string;
  port: number;
  nodeEnv: EnvironmentVariables['NODE_ENV'];
  isProduction: boolean;
  frontendUrl: string;
  jwt: JwtConfig;
  /** Sal del HMAC de IP para analítica (default: JWT_SECRET). */
  analyticsSalt: string;
  throttle: ThrottleConfig;
  logLevel: string;
  /** `SameSite` de la cookie de sesión (spec `api-security-headers`). */
  sessionCookieSameSite: 'lax' | 'strict' | 'none';
  integrations: IntegrationsConfig;
}

/** Namespace bajo el que ConfigService expone la configuración tipada. */
export const APP_CONFIG = 'app';

export function loadConfiguration(): { [APP_CONFIG]: AppConfig } {
  const env = validateEnv(process.env);
  return {
    [APP_CONFIG]: {
      databaseUrl: env.DATABASE_URL,
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      isProduction: env.NODE_ENV === NodeEnv.Production,
      frontendUrl: env.FRONTEND_URL,
      jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
        expiresInSeconds: expiresInToSeconds(env.JWT_EXPIRES_IN),
      },
      analyticsSalt: env.ANALYTICS_SALT ?? env.JWT_SECRET,
      throttle: {
        ttl: env.THROTTLE_TTL,
        limit: env.THROTTLE_LIMIT,
        loginLimit: env.THROTTLE_LOGIN_LIMIT,
      },
      logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === NodeEnv.Production ? 'info' : 'debug'),
      // Por defecto `lax`: sirve para el desarrollo y para un despliegue en el mismo sitio.
      sessionCookieSameSite: env.SESSION_COOKIE_SAMESITE ?? 'lax',
      integrations: {
        enabledProviders: parseEnabledProviders(env.INTEGRATIONS_ENABLED),
        schedulerEnabled: env.INTEGRATIONS_SCHEDULER_ENABLED === 'true',
        syncCron: env.INTEGRATIONS_SYNC_CRON,
        tickSeconds: env.INTEGRATIONS_TICK_SECONDS,
        jobTimeoutMs: env.INTEGRATIONS_JOB_TIMEOUT_MS,
        runMaxMs: env.INTEGRATIONS_RUN_MAX_MS,
        keys: env.INTEGRATIONS_KEYS,
        activeKeyId: env.INTEGRATIONS_ACTIVE_KEY,
      },
    },
  };
}
