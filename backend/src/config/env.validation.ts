import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
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
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: true });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  - ');
    throw new Error(`Configuración de entorno inválida:\n  - ${details}`);
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
