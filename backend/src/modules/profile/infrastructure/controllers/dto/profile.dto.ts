import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewLanguageProps } from '../../../domain/entities/language.entity';
import { ProfileContent } from '../../../domain/entities/profile.entity';
import { Availability } from '../../../domain/value-objects/availability.vo';

/** Huso por defecto: el mismo que la columna de `schema.prisma`. */
export const DEFAULT_TIMEZONE = 'GMT-4';

export class AvailabilityDto {
  @ApiPropertyOptional({ type: LocalizedTextDto, nullable: true, description: 'Modalidad' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  modality?: LocalizedTextDto | null;

  @ApiPropertyOptional({ type: LocalizedTextDto, nullable: true, description: 'Tipo de contrato' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  contractType?: LocalizedTextDto | null;

  @ApiPropertyOptional({ type: LocalizedTextDto, nullable: true, description: 'Fecha de inicio' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  startDate?: LocalizedTextDto | null;
}

/**
 * Cuerpo del `PUT /api/admin/profile` (D1): reemplazo completo. Lo opcional que
 * no se manda queda vacío (o en su valor por defecto), y un campo desconocido es
 * 400 por la whitelist, nunca se ignora.
 */
export class ReplaceProfileDto {
  @ApiProperty({ example: 'Manuel Saavedra' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  headline!: LocalizedTextDto;

  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  summary!: LocalizedTextDto;

  @ApiProperty({ example: 'manuel@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Santa Cruz, Bolivia' })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiPropertyOptional({ nullable: true, type: String, example: '+591 70000000' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ default: DEFAULT_TIMEZONE })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ type: AvailabilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto;
}

/** Cuerpo de la vista previa: el mismo borrador que se guardaría. */
export class PreviewProfileDto extends ReplaceProfileDto {}

const optionalText = (dto: LocalizedTextDto | null | undefined) =>
  dto ? toLocalizedText(dto) : null;

export function toProfileContent(dto: ReplaceProfileDto): ProfileContent {
  return {
    fullName: dto.fullName,
    headline: toLocalizedText(dto.headline),
    summary: toLocalizedText(dto.summary),
    email: dto.email,
    location: dto.location,
    phone: dto.phone ?? null,
    timezone: dto.timezone ?? DEFAULT_TIMEZONE,
    yearsOfExperience: dto.yearsOfExperience ?? 0,
    availability: Availability.create({
      modality: optionalText(dto.availability?.modality),
      contractType: optionalText(dto.availability?.contractType),
      startDate: optionalText(dto.availability?.startDate),
    }),
  };
}

export class CreateLanguageDto {
  @ApiProperty({ example: 'Inglés', description: 'Nombre canónico; fallback de nameI18n' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ type: LocalizedTextDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  nameI18n?: LocalizedTextDto | null;

  @ApiProperty({ type: LocalizedTextDto, description: 'Nivel bilingüe; es obligatorio' })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  level!: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedTextDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  detail?: LocalizedTextDto | null;
}

/**
 * Edición parcial: todos los campos opcionales, mismas reglas. `null` en un
 * obligatorio se valida (400) en lugar de colarse hasta la base (500).
 */
export class UpdateLanguageDto extends PartialType(CreateLanguageDto, {
  skipNullProperties: false,
}) {}

export function toNewLanguageProps(dto: CreateLanguageDto): NewLanguageProps {
  return {
    name: dto.name,
    nameI18n: optionalText(dto.nameI18n),
    level: toLocalizedText(dto.level),
    detail: optionalText(dto.detail),
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar; null = vaciar). */
type MutableChanges = { -readonly [K in keyof NewLanguageProps]?: NewLanguageProps[K] };

export function toLanguageChanges(dto: UpdateLanguageDto): Partial<NewLanguageProps> {
  const changes: MutableChanges = {};
  if (dto.name !== undefined) changes.name = dto.name;
  if (dto.nameI18n !== undefined) changes.nameI18n = optionalText(dto.nameI18n);
  if (dto.level !== undefined) changes.level = toLocalizedText(dto.level);
  if (dto.detail !== undefined) changes.detail = optionalText(dto.detail);
  return changes;
}
