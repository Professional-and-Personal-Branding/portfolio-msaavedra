import { EnvironmentVariables, expiresInToSeconds, validateEnv } from './env.validation';

export interface JwtConfig {
  secret: string;
  /** Tal como viene en el entorno (`1d`, `12h`, `3600`). */
  expiresIn: string;
  expiresInSeconds: number;
}

export interface AppConfig {
  databaseUrl: string;
  port: number;
  nodeEnv: EnvironmentVariables['NODE_ENV'];
  frontendUrl: string;
  jwt: JwtConfig;
  /** Sal del HMAC de IP para analítica (default: JWT_SECRET). */
  analyticsSalt: string;
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
      frontendUrl: env.FRONTEND_URL,
      jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
        expiresInSeconds: expiresInToSeconds(env.JWT_EXPIRES_IN),
      },
      analyticsSalt: env.ANALYTICS_SALT ?? env.JWT_SECRET,
    },
  };
}
