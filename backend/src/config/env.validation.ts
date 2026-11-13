import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateCronExpression } from 'cron';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import {
  isKnownProvider,
  parseEnabledProviders,
  PROVIDER_CATALOG,
} from '../modules/integrations/domain/provider-catalog';
import { EXAMPLE_INTEGRATIONS_KEY, parseKeyring } from './integrations-keys';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Variables de entorno requeridas por la API. Se validan al arrancar (fail-fast):
 * si falta una obligatoria o tiene un formato inválido, el proceso termina con
 * un mensaje que identifica la variable (spec `api-platform`).
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:5173';

  /** Secreto HS256 del JWT del backoffice. Obligatorio; Fase 6 exigirá un valor fuerte. */
  @IsString()
  @MinLength(16)
  JWT_SECRET!: string;

  /** Segundos o notación `30m`, `12h`, `1d`. */
  @Matches(/^\d+(s|m|h|d)?$/, { message: 'JWT_EXPIRES_IN must be seconds or like 30m, 12h, 1d' })
  JWT_EXPIRES_IN: string = '1d';

  /** Sal del hash de IP para analítica. Si falta, se usa JWT_SECRET. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  ANALYTICS_SALT?: string;

  /** Nivel de log (spec `api-observability`). */
  @IsOptional()
  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
  LOG_LEVEL?: string;

  /** Ventana del límite de peticiones, en segundos (spec `api-rate-limiting`). */
  @IsInt()
  @Min(1)
  THROTTLE_TTL: number = 60;

  /** Peticiones permitidas por ventana e IP. */
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 120;

  /** Intentos de login permitidos por ventana e IP. */
  @IsInt()
  @Min(1)
  THROTTLE_LOGIN_LIMIT: number = 5;

  /** `SameSite` de la cookie de sesión (spec `api-security-headers`). */
  @IsOptional()
  @IsIn(['lax', 'strict', 'none'])
  SESSION_COOKIE_SAMESITE?: 'lax' | 'strict' | 'none';

  /** Publica Swagger en producción cuando vale `true` (spec `api-platform`). */
  @IsOptional()
  @IsIn(['true', 'false'])
  ENABLE_API_DOCS?: string;

  /** Proveedores de integración habilitados, separados por comas (change `add-integrations-foundation`). */
  @IsOptional()
  @IsString()
  INTEGRATIONS_ENABLED?: string;

  /** Enciende los timers del planificador y del ejecutor en este proceso (default apagado, P1). */
  @IsOptional()
  @IsIn(['true', 'false'])
  INTEGRATIONS_SCHEDULER_ENABLED?: string;

  /** Cron del planificador diario, en UTC (default 06:00 en Bolivia). */
  @IsString()
  @IsNotEmpty()
  INTEGRATIONS_SYNC_CRON: string = '0 10 * * *';

  @IsInt()
  @Min(10)
  @Max(3600)
  INTEGRATIONS_TICK_SECONDS: number = 60;

  @IsInt()
  @Min(5000)
  @Max(600000)
  INTEGRATIONS_JOB_TIMEOUT_MS: number = 120000;

  @IsInt()
  @Min(10000)
  @Max(1800000)
  INTEGRATIONS_RUN_MAX_MS: number = 300000;

  /** Keyring `k1:<base64 de 32 bytes>,k2:…` para cifrar las credenciales. */
  @IsOptional()
  @IsString()
  INTEGRATIONS_KEYS?: string;

  @IsOptional()
  @IsString()
  INTEGRATIONS_ACTIVE_KEY?: string;
}

/** Valor de ejemplo del repositorio: jamás debe llegar a producción. */
export const EXAMPLE_JWT_SECRET = 'cambiar-por-un-secreto-fuerte-en-produccion';
const PRODUCTION_SECRET_MIN_LENGTH = 32;

/**
 * Reglas que solo aplican en producción (spec `api-platform` § Arranque seguro).
 * Los mensajes nombran la variable y NUNCA imprimen su valor.
 */
function productionIssues(env: EnvironmentVariables): string[] {
  if (env.NODE_ENV !== NodeEnv.Production) return [];
  const issues: string[] = [];

  if (env.JWT_SECRET === EXAMPLE_JWT_SECRET) {
    issues.push('JWT_SECRET: es el valor de ejemplo del repositorio; generá uno propio');
  } else if (env.JWT_SECRET.length < PRODUCTION_SECRET_MIN_LENGTH) {
    issues.push(
      `JWT_SECRET: en producción debe tener al menos ${PRODUCTION_SECRET_MIN_LENGTH} caracteres`,
    );
  }
  if (env.ANALYTICS_SALT && env.ANALYTICS_SALT === env.JWT_SECRET) {
    issues.push('ANALYTICS_SALT: debe ser distinto de JWT_SECRET');
  }
  if (!env.FRONTEND_URL.startsWith('https://')) {
    issues.push('FRONTEND_URL: en producción debe usar https');
  }
  return issues;
}

/**
 * Reglas de las integraciones (spec `api-platform`): lista contra el catálogo, secreto de cada
 * proveedor opcional (nunca se exige al arrancar), keyring y clave activa solo si hay habilitados, `fake`
 * prohibido en producción y el cron válido. Los mensajes nombran la variable y no el valor.
 */
function integrationIssues(env: EnvironmentVariables): string[] {
  const issues: string[] = [];
  const isProduction = env.NODE_ENV === NodeEnv.Production;
  const enabled = parseEnabledProviders(env.INTEGRATIONS_ENABLED);

  if (!validateCronExpression(env.INTEGRATIONS_SYNC_CRON).valid) {
    issues.push('INTEGRATIONS_SYNC_CRON: no es una expresión cron válida (5 o 6 campos)');
  }

  const unknown = enabled.filter((id) => !isKnownProvider(id));
  if (unknown.length > 0) {
    issues.push(
      `INTEGRATIONS_ENABLED: contiene un proveedor que no está en el catálogo (válidos: ${Object.keys(PROVIDER_CATALOG).join(', ')})`,
    );
  }
  for (const id of enabled.filter(isKnownProvider)) {
    const descriptor = PROVIDER_CATALOG[id];
    if (isProduction && !descriptor.allowedInProduction) {
      issues.push(`INTEGRATIONS_ENABLED: el proveedor "${id}" no puede habilitarse en producción`);
    }
  }

  const keyring = parseKeyring(env.INTEGRATIONS_KEYS);
  issues.push(...keyring.issues);
  if (enabled.length > 0) {
    if (!env.INTEGRATIONS_KEYS || env.INTEGRATIONS_KEYS.trim() === '') {
      issues.push('INTEGRATIONS_KEYS: obligatoria si INTEGRATIONS_ENABLED no está vacía');
    }
  }
  // Con claves en el keyring la activa es obligatoria aunque no haya proveedores (si no, la API caería
  // al instanciar el cifrador), y con proveedores habilitados también.
  if (
    (enabled.length > 0 || keyring.keys.size > 0) &&
    (!env.INTEGRATIONS_ACTIVE_KEY || env.INTEGRATIONS_ACTIVE_KEY.trim() === '')
  ) {
    issues.push(
      'INTEGRATIONS_ACTIVE_KEY: obligatoria si INTEGRATIONS_ENABLED no está vacía o INTEGRATIONS_KEYS tiene claves',
    );
  }
  if (env.INTEGRATIONS_JOB_TIMEOUT_MS > env.INTEGRATIONS_RUN_MAX_MS) {
    issues.push('INTEGRATIONS_JOB_TIMEOUT_MS: no puede superar INTEGRATIONS_RUN_MAX_MS');
  }
  if (
    env.INTEGRATIONS_ACTIVE_KEY &&
    keyring.issues.length === 0 &&
    keyring.keys.size > 0 &&
    !keyring.keys.has(env.INTEGRATIONS_ACTIVE_KEY)
  ) {
    issues.push('INTEGRATIONS_ACTIVE_KEY: no figura en INTEGRATIONS_KEYS');
  }
  if (isProduction) {
    if (keyring.rawValues.includes(EXAMPLE_INTEGRATIONS_KEY)) {
      issues.push('INTEGRATIONS_KEYS: contiene la clave de ejemplo del repositorio; generá otra');
    }
    if (keyring.rawValues.includes(env.JWT_SECRET)) {
      issues.push('INTEGRATIONS_KEYS: no puede repetir JWT_SECRET');
    }
  }
  return issues;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: true });

  const details = [
    ...errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`),
    // Las reglas de producción solo se evalúan si la forma básica ya es válida.
    ...(errors.length === 0 ? productionIssues(validated) : []),
    ...(errors.length === 0 ? integrationIssues(validated) : []),
  ];

  if (details.length > 0) {
    throw new Error(`Configuración de entorno inválida:\n  - ${details.join('\n  - ')}`);
  }
  return validated;
}

/** Convierte `JWT_EXPIRES_IN` a segundos. */
export function expiresInToSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(value);
  if (!match) throw new Error(`JWT_EXPIRES_IN inválido: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
  return amount * factor;
}
