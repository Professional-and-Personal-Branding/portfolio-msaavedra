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
  /** Transporte del proveedor `github`: `http` (API real) o `fixture` (solo desarrollo y pruebas). */
  githubTransport: 'http' | 'fixture';
}

/** IA (change `add-ai-foundation`). Apagada por defecto. */
export interface AiConfig {
  enabled: boolean;
  provider: 'anthropic' | 'fake';
  /** Solo del entorno; nunca se loguea. */
  apiKey: string | undefined;
  monthlyBudgetUsd: number;
  requestTimeoutMs: number;
  maxConcurrency: number;
  maxInputTokens: number;
  fakeScenario: string;
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
  ai: AiConfig;
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
        githubTransport: env.GITHUB_TRANSPORT,
      },
      ai: {
        enabled: env.AI_ENABLED === 'true',
        provider: env.AI_PROVIDER,
        apiKey: env.ANTHROPIC_API_KEY === '' ? undefined : env.ANTHROPIC_API_KEY,
        monthlyBudgetUsd: env.AI_MONTHLY_BUDGET_USD,
        requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
        maxConcurrency: env.AI_MAX_CONCURRENCY,
        maxInputTokens: env.AI_MAX_INPUT_TOKENS,
        fakeScenario: env.AI_FAKE_SCENARIO ?? 'ok',
      },
    },
  };
}
