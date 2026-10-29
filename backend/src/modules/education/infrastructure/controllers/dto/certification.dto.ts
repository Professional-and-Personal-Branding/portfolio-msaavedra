import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewCertificationProps } from '../../../domain/entities/certification.entity';
import {
  CERTIFICATION_DATE_REGEX,
  CREDENTIAL_ID_MAX,
  VERIFICATION_URL_MAX,
  YEAR_REGEX,
} from '../../../domain/services/validate-certification';

export class CreateCertificationDto {
  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name!: LocalizedTextDto;

  @ApiProperty({ example: 'CertifPro, Sunrise Florida, EEUU' })
  @IsString()
  @IsNotEmpty()
  issuer!: string;

  @ApiPropertyOptional({
    example: '2021',
    description: 'YYYY; omitir o null si no se conoce',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Matches(YEAR_REGEX, { message: 'year must be YYYY' })
  year?: string | null;

  @ApiPropertyOptional({
    example: 'https://www.credly.com/badges/00000000-0000-0000-0000-000000000000',
    description: 'URL https absoluta de la página pública de la credencial; null para quitarla',
    nullable: true,
    maxLength: VERIFICATION_URL_MAX,
    type: String,
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(VERIFICATION_URL_MAX)
  verificationUrl?: string | null;

  @ApiPropertyOptional({
    example: 'EJ-2023-0042',
    description: 'ID de la credencial en el emisor (texto plano); null para quitarlo',
    nullable: true,
    maxLength: CREDENTIAL_ID_MAX,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(CREDENTIAL_ID_MAX)
  credentialId?: string | null;

  @ApiPropertyOptional({
    example: '2029-06',
    description: 'Vencimiento YYYY-MM o YYYY; null si no vence',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Matches(CERTIFICATION_DATE_REGEX, { message: 'expiresAt must be YYYY-MM or YYYY' })
  expiresAt?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

/** Edición parcial: todos los campos opcionales, mismas reglas. */
export class UpdateCertificationDto extends PartialType(CreateCertificationDto) {}

/** Recorta espacios; vacío o ausente → null (quita el valor). */
export function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toNewCertificationProps(dto: CreateCertificationDto): NewCertificationProps {
  return {
    name: toLocalizedText(dto.name),
    issuer: dto.issuer,
    year: dto.year ?? null,
    verificationUrl: cleanText(dto.verificationUrl),
    credentialId: cleanText(dto.credentialId),
    expiresAt: cleanText(dto.expiresAt),
    order: dto.order ?? 0,
    visible: dto.visible ?? true,
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar). */
type MutableChanges = { -readonly [K in keyof NewCertificationProps]?: NewCertificationProps[K] };

export function toCertificationChanges(
  dto: UpdateCertificationDto,
): Partial<NewCertificationProps> {
  const changes: MutableChanges = {};
  if (dto.name !== undefined) changes.name = toLocalizedText(dto.name);
  if (dto.issuer !== undefined) changes.issuer = dto.issuer;
  if (dto.year !== undefined) changes.year = dto.year;
  if (dto.verificationUrl !== undefined) changes.verificationUrl = cleanText(dto.verificationUrl);
  if (dto.credentialId !== undefined) changes.credentialId = cleanText(dto.credentialId);
  if (dto.expiresAt !== undefined) changes.expiresAt = cleanText(dto.expiresAt);
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.visible !== undefined) changes.visible = dto.visible;
  return changes;
}
