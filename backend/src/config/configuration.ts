import { EnvironmentVariables, validateEnv } from './env.validation';

export interface AppConfig {
  databaseUrl: string;
  port: number;
  nodeEnv: EnvironmentVariables['NODE_ENV'];
  frontendUrl: string;
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
    },
  };
}
