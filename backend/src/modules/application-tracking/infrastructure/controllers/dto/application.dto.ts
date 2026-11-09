import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { APPLICATION_STATUSES, ApplicationStatus } from '../../../domain/application-status';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cuerpo de crear una postulación. Los topes son de forma (que no entre texto desmedido); las
 * reglas reales —recorte, 1 a 120 / 1 a 160, URL http(s), portal normalizable, fechas, vínculos—
 * las aplica el dominio y dan 400. Un campo desconocido (p. ej. `contactEmail`) también da 400.
 */
export class CreateApplicationDto {
  @ApiProperty({ description: 'Empresa (1 a 120 caracteres tras recortar)', example: 'Globex' })
  @IsString()
  @MaxLength(500)
  company!: string;

  @ApiProperty({ description: 'Puesto (1 a 160 caracteres)', example: 'Backend Senior' })
  @IsString()
  @MaxLength(500)
  role!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'URL absoluta http o https de la vacante (hasta 2048)',
    example: 'https://globex.example/jobs/1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  jobUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Portal (`[a-z0-9-]`, hasta 32 caracteres; se normaliza a minúsculas)',
    example: 'linkedin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  portal?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Notas libres (hasta 5000). No guardes datos de contacto de personas.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string | null;

  @ApiPropertyOptional({
    enum: APPLICATION_STATUSES,
    enumName: 'ApplicationStatus',
    default: 'DRAFT',
    description: 'Estado inicial; al crear se admite cualquiera',
  })
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      '`AAAA-MM-DD`. Nula con `DRAFT`; si falta en otro estado, el día UTC del reloj. No puede pasar de mañana (UTC).',
    example: '2026-11-20',
  })
  @IsOptional()
  @Matches(DAY, { message: 'appliedAt debe tener el formato AAAA-MM-DD' })
  appliedAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Id del perfil curado' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  curatedProfileId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Id de un enlace `MANUAL` de ese perfil; requiere `curatedProfileId`',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shareLinkId?: string | null;
}

/** Cambios parciales; `null` vacía lo opcional. El estado pasa por la máquina de transiciones. */
export class UpdateApplicationDto {
  @ApiPropertyOptional({ description: 'Empresa (1 a 120 caracteres tras recortar)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  company?: string;

  @ApiPropertyOptional({ description: 'Puesto (1 a 160 caracteres)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  role?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  jobUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  portal?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string | null;

  @ApiPropertyOptional({
    enum: APPLICATION_STATUSES,
    enumName: 'ApplicationStatus',
    description: 'Estado nuevo: una transición inválida da 422 y no cambia nada',
  })
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ type: String, nullable: true, description: '`AAAA-MM-DD`' })
  @IsOptional()
  @Matches(DAY, { message: 'appliedAt debe tener el formato AAAA-MM-DD' })
  appliedAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  curatedProfileId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shareLinkId?: string | null;
}

/** `?status=APPLIED,INTERVIEWING`: uno o varios estados separados por coma; sin valor, todos. */
export class ListApplicationsQuery {
  @ApiPropertyOptional({
    type: String,
    description: 'Estados separados por coma (`DRAFT,APPLIED,…`); sin valor, todas',
    example: 'APPLIED,INTERVIEWING',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
      : value,
  )
  @IsArray()
  @IsIn(APPLICATION_STATUSES, { each: true, message: 'status contiene un estado desconocido' })
  status?: ApplicationStatus[];
}
